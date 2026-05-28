/**
 * HistorySuggestAddon — v2
 *
 * Fish-shell-style inline history suggestions with a smarter ranking engine:
 *
 *  • Prefix match (highest priority) — "git pu" → "git push origin main"
 *  • Word-boundary match — "gpm" matches "git push main" (first letters)
 *  • Substring match — "push" anywhere in a command
 *
 * Scoring accounts for both recency (position in history ring) and
 * frequency (how many times a command was run). The highest-scoring
 * candidate is shown as ghost text after the cursor.
 *
 * Pressing → or End accepts the ghost text. Any reset key (Escape,
 * ArrowUp/Down, Ctrl+C, etc.) clears the overlay cleanly.
 *
 * Implementation notes
 * --------------------
 * xterm.js doesn't expose a public "current line buffer" API, so we track
 * typed input ourselves via onKey. Paste / ctrl-u / history navigation reset
 * the tracked input; that's acceptable for v1.
 *
 * The ghost text is rendered as an absolutely-positioned DOM overlay element
 * attached to an xterm.js decoration at the cursor row. This is the same
 * approach used by VS Code's ghost-text feature and is stable across xterm 5.x.
 */

import type { IDisposable, ITerminalAddon, Terminal } from "@xterm/xterm";
import { persistHistory } from "./historyPersist";

const MAX_HISTORY = 500;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Returns a match score for `candidate` against `input`, or null if no match.
 * Higher score = better suggestion. Returns null to skip this candidate.
 *
 * Priority tiers (higher is better):
 *  3 — exact prefix match
 *  2 — word-boundary / abbreviation match (first letters of words)
 *  1 — substring match anywhere in the command
 */
function scoreMatch(candidate: string, input: string): number | null {
  if (candidate === input) return null; // exact equal — nothing to complete
  const lo = input.toLowerCase();
  const clo = candidate.toLowerCase();

  // Tier 3: prefix
  if (clo.startsWith(lo)) return 3;

  // Tier 2: word-boundary abbreviation (each char of input matches the first
  // char of a word in candidate). E.g. "gpo" → "git push origin"
  if (lo.length >= 2) {
    const words = candidate.split(/\s+/);
    let wIdx = 0;
    let matched = true;
    for (let i = 0; i < lo.length; i++) {
      let found = false;
      while (wIdx < words.length) {
        if (words[wIdx]?.[0]?.toLowerCase() === lo[i]) {
          wIdx++;
          found = true;
          break;
        }
        wIdx++;
      }
      if (!found) { matched = false; break; }
    }
    if (matched) return 2;
  }

  // Tier 1: substring match (only kick in after ≥ 3 chars to avoid noise)
  if (lo.length >= 3 && clo.includes(lo)) return 1;

  return null;
}

/**
 * Pick the best candidate from history.
 * Ranking: tier first, then recency (index in ring, 0 = most recent),
 * then frequency (how many times an entry appears — tracked via _freq map).
 */
function bestMatch(
  history: string[],
  freq: Map<string, number>,
  input: string,
): string | null {
  let bestCmd: string | null = null;
  let bestTier = 0;
  let bestRecency = Infinity;
  let bestFreq = 0;

  for (let i = 0; i < history.length; i++) {
    const cmd = history[i];
    if (!cmd) continue;
    const tier = scoreMatch(cmd, input);
    if (tier === null) continue;

    const f = freq.get(cmd) ?? 1;
    const better =
      tier > bestTier ||
      (tier === bestTier && f > bestFreq) ||
      (tier === bestTier && f === bestFreq && i < bestRecency);

    if (better) {
      bestTier = tier;
      bestFreq = f;
      bestRecency = i;
      bestCmd = cmd;
    }
  }

  return bestCmd;
}

// ---------------------------------------------------------------------------
// Addon
// ---------------------------------------------------------------------------

export class HistorySuggestAddon implements ITerminalAddon {
  private _term: Terminal | null = null;
  private _history: string[] = [];
  /** Frequency map: command → run count */
  private _freq = new Map<string, number>();
  private _currentInput = "";
  /** True while we're inside a running command (between OSC 133 B and D). */
  private _inCommand = false;
  private _disposables: IDisposable[] = [];
  private _decorationEl: HTMLElement | null = null;
  private _decorationDisposable: IDisposable | null = null;
  private _enabled = true;
  /** Last rendered ghost text (to avoid unnecessary re-renders). */
  private _lastGhost = "";

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Push a completed command into the history ring. */
  addHistoryEntry(cmd: string): void {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Bump frequency counter.
    this._freq.set(trimmed, (this._freq.get(trimmed) ?? 0) + 1);

    // Remove duplicate, then push to front.
    const idx = this._history.indexOf(trimmed);
    if (idx !== -1) this._history.splice(idx, 1);
    this._history.unshift(trimmed);
    if (this._history.length > MAX_HISTORY) {
      const evicted = this._history.pop();
      if (evicted && !this._history.includes(evicted)) {
        this._freq.delete(evicted);
      }
    }

    // Debounce-persist to disk.
    persistHistory(this._history);
  }

  /**
   * Seed the history ring from a persisted array loaded at startup.
   * Merges without duplicates, keeping most-recently-used order intact.
   * Frequency is estimated as 1 per entry (real counts are rebuilt at runtime).
   */
  seedHistory(entries: string[]): void {
    for (let i = entries.length - 1; i >= 0; i--) {
      const cmd = entries[i]?.trim();
      if (!cmd) continue;
      const idx = this._history.indexOf(cmd);
      if (idx !== -1) this._history.splice(idx, 1);
      this._history.push(cmd);
      if (!this._freq.has(cmd)) this._freq.set(cmd, 1);
    }
    if (this._history.length > MAX_HISTORY) this._history.length = MAX_HISTORY;
  }

  /** Return a snapshot of the current history ring (most-recent first). */
  getHistory(): readonly string[] {
    return this._history;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) this._hideSuggestion();
  }

  // ---------------------------------------------------------------------------
  // ITerminalAddon
  // ---------------------------------------------------------------------------

  activate(term: Terminal): void {
    this._term = term;
    const keyDisposable = term.onKey((e) => this._handleKey(e));
    this._disposables.push(keyDisposable);
  }

  dispose(): void {
    this._hideSuggestion();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
    this._term = null;
  }

  // ---------------------------------------------------------------------------
  // Private — key handling
  // ---------------------------------------------------------------------------

  private _handleKey(e: { key: string; domEvent: KeyboardEvent }): void {
    if (!this._enabled || !this._term) return;

    const { domEvent } = e;
    const key = domEvent.key;

    // ── Accept ghost text with → or End ─────────────────────────────────────
    if ((key === "ArrowRight" || key === "End") && this._decorationEl !== null) {
      const suggestion = this._getBestSuggestion();
      if (suggestion) {
        const remaining = suggestion.slice(this._currentInput.length);
        if (remaining) {
          this._term.element?.dispatchEvent(
            new CustomEvent("opincode:accept-suggestion", {
              detail: remaining,
              bubbles: true,
            }),
          );
        }
        this._currentInput = suggestion;
        this._hideSuggestion();
        return;
      }
    }

    // ── Enter — command is running ───────────────────────────────────────────
    if (key === "Enter") {
      this._inCommand = true;
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }

    // ── OSC 133 D — command finished, back to prompt ─────────────────────────
    // (also toggled by onCommandEnd() called externally)
    if (this._inCommand) {
      // Once command ends we get OSC 133 A → onCommandEnd() is called.
      // Until then, suppress suggestions.
      return;
    }

    // ── Ctrl combos ──────────────────────────────────────────────────────────
    if (domEvent.ctrlKey) {
      if (key === "u" || key === "k" || key === "w") {
        // These clear (part of) the line.
        this._currentInput = key === "w"
          ? this._currentInput.replace(/\S+\s*$/, "")  // ctrl-w: erase last word
          : "";
        this._updateSuggestion();
        return;
      }
      if (key === "a") {
        // ctrl-a: cursor to start — keep input, hide ghost (can't know position).
        this._hideSuggestion();
        return;
      }
      if (key === "e") {
        // ctrl-e: cursor to end — re-evaluate.
        this._updateSuggestion();
        return;
      }
      // Any other ctrl — reset.
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }

    // ── Navigation / reset keys ──────────────────────────────────────────────
    if (key === "Escape") {
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }
    if (key === "ArrowUp" || key === "ArrowDown") {
      // Shell history navigation — we can't know what the shell will show.
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }
    if (key === "ArrowLeft") {
      // Cursor moved left — can't know position, hide ghost.
      this._hideSuggestion();
      return;
    }
    if (key === "Tab") {
      // Shell tab-completion may alter the line; reset tracking.
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }

    // ── Printable / Backspace ────────────────────────────────────────────────
    if (key === "Backspace") {
      if (domEvent.altKey) {
        // alt-backspace: erase last word
        this._currentInput = this._currentInput.replace(/\S+\s*$/, "");
      } else {
        this._currentInput = this._currentInput.slice(0, -1);
      }
    } else if (key.length === 1 && !domEvent.altKey) {
      this._currentInput += key;
    }

    this._updateSuggestion();
  }

  // ---------------------------------------------------------------------------
  // Private — suggestion engine
  // ---------------------------------------------------------------------------

  private _getBestSuggestion(): string | null {
    const input = this._currentInput;
    if (!input.trim()) return null;
    return bestMatch(this._history, this._freq, input);
  }

  private _updateSuggestion(): void {
    const suggestion = this._getBestSuggestion();
    const input = this._currentInput;

    if (!suggestion) {
      this._hideSuggestion();
      return;
    }

    const term = this._term;
    if (!term) return;

    // For word-boundary / substring matches, show the full command as ghost
    // (replacing the input is handled at accept-time by writing the full cmd).
    // The ghost text we render is whatever comes AFTER what they typed,
    // OR the full command if it's a non-prefix match (so they see the full cmd).
    let ghost: string;
    const tier = scoreMatch(suggestion, input);
    if (tier === 3) {
      // Prefix match — append the completion
      ghost = suggestion.slice(input.length);
    } else {
      // Non-prefix match — show the full command dimmed so the user can decide
      ghost = " → " + suggestion;
    }

    if (!ghost) {
      this._hideSuggestion();
      return;
    }

    // Skip re-render if the ghost text hasn't changed.
    if (ghost === this._lastGhost && this._decorationEl !== null) return;

    this._lastGhost = ghost;
    this._hideSuggestion();

    try {
      const decoration = term.registerDecoration({
        marker: term.registerMarker(0),
        overviewRulerOptions: undefined,
      });
      if (!decoration) return;

      this._decorationDisposable = decoration;

      decoration.onRender((el) => {
        this._decorationEl = el;
        while (el.firstChild) el.removeChild(el.firstChild);

        const dims = (
          term as unknown as {
            _core?: {
              _renderService?: {
                dimensions?: { actualCellWidth?: number };
              };
            };
          }
        )._core?._renderService?.dimensions;
        const cellWidth = dims?.actualCellWidth ?? 8;
        const col = term.buffer.active.cursorX;

        const span = document.createElement("span");
        span.textContent = ghost;
        span.style.cssText = [
          "position:absolute",
          `left:${col * cellWidth}px`,
          "top:0",
          "color:rgba(148,163,184,0.45)",
          "pointer-events:none",
          "white-space:pre",
          "font:inherit",
          "z-index:1",
          "letter-spacing:inherit",
        ].join(";");
        el.appendChild(span);
      });
    } catch {
      // registerDecoration may throw in some xterm versions; fail silently.
    }
  }

  private _hideSuggestion(): void {
    this._lastGhost = "";
    this._decorationEl = null;
    if (this._decorationDisposable) {
      this._decorationDisposable.dispose();
      this._decorationDisposable = null;
    }
  }

  // Called externally from osc-handlers
  onCommandStart(): void {
    this._inCommand = true;
    this._currentInput = "";
    this._hideSuggestion();
  }

  onCommandEnd(): void {
    this._inCommand = false;
    this._currentInput = "";
    this._hideSuggestion();
  }
}
