/**
 * HistorySuggestAddon
 *
 * A lightweight xterm.js terminal addon that shows fish-shell-style inline
 * history suggestions. As the user types, the most-recently-used command
 * that starts with the current input is shown in dim gray to the right of
 * the cursor. Pressing → or End accepts the suggestion; any other key
 * continues typing normally.
 *
 * Implementation strategy
 * -----------------------
 * xterm.js doesn't expose a public "current line buffer" API. We therefore
 * track the typed input ourselves by intercepting every key event through
 * the `onKey` observable before it is sent to the PTY.
 *
 * We do NOT intercept data — we simply watch keystrokes. This means the
 * addon tracks what the user *typed*, not what the PTY *echoed*. That's
 * sufficient for the common case; edge cases (paste, multiline, ctrl-u
 * clear, history navigation) are handled by resetting `currentInput` and
 * hiding the suggestion. The downside is that complex sequences (e.g. a
 * completion that replaced the partial word) won't surface perfectly, but
 * that's acceptable for v1.
 *
 * The suggestion overlay is rendered by writing dim-styled text to the
 * terminal using an xterm.js `registerDecoration` call on the current
 * cursor position. On the next keystroke we remove the decoration and
 * re-evaluate. This avoids any DOM manipulation outside the xterm.js API.
 *
 * Note: `registerDecoration` only positions the decoration on a *line*, not
 * at a character column. For now we append the ghost text directly through
 * an overlay element added to the decoration's element. This is stable
 * across xterm.js 5.x.
 */

import type { IDisposable, ITerminalAddon, Terminal } from "@xterm/xterm";

const MAX_HISTORY = 500;

export class HistorySuggestAddon implements ITerminalAddon {
  private _term: Terminal | null = null;
  private _history: string[] = [];
  private _currentInput = "";
  /** True while we're inside a command (between OSC 133 B/C and D). */
  private _inCommand = false;
  private _disposables: IDisposable[] = [];
  private _decorationEl: HTMLElement | null = null;
  private _decorationDisposable: IDisposable | null = null;
  private _enabled = true;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Push a completed command into the history ring. */
  addHistoryEntry(cmd: string): void {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    // Remove duplicate, then push to front.
    const idx = this._history.indexOf(trimmed);
    if (idx !== -1) this._history.splice(idx, 1);
    this._history.unshift(trimmed);
    if (this._history.length > MAX_HISTORY) this._history.length = MAX_HISTORY;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) this._hideSuggestion();
  }

  /** Called by osc-handlers when OSC 133 B fires (command start). */
  onCommandStart(): void {
    this._inCommand = true;
    this._currentInput = "";
    this._hideSuggestion();
  }

  /** Called by osc-handlers when OSC 133 D fires (command done). */
  onCommandEnd(): void {
    this._inCommand = false;
    this._currentInput = "";
    this._hideSuggestion();
  }

  // ---------------------------------------------------------------------------
  // ITerminalAddon
  // ---------------------------------------------------------------------------

  activate(term: Terminal): void {
    this._term = term;

    // Intercept keystrokes.
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
  // Private
  // ---------------------------------------------------------------------------

  private _handleKey(e: { key: string; domEvent: KeyboardEvent }): void {
    if (!this._enabled || !this._term) return;

    const { domEvent } = e;
    const key = domEvent.key;

    // While in a command (after Enter), don't track new keystrokes.
    if (this._inCommand) return;

    // Accept suggestion
    if (
      (key === "ArrowRight" || key === "End") &&
      this._decorationEl !== null
    ) {
      const suggestion = this._currentSuggestion();
      if (suggestion) {
        const remaining = suggestion.slice(this._currentInput.length);
        if (remaining) {
          // Write the remaining characters to the PTY via the terminal's
          // writeln is private; we emit a custom event the session handler
          // can subscribe to. Instead, abuse the public API by emitting
          // a custom DOM event that our session wrapper listens for.
          this._term.element?.dispatchEvent(
            new CustomEvent("opincode:accept-suggestion", {
              detail: remaining,
              bubbles: true,
            }),
          );
        }
        // Don't clear currentInput — the PTY will echo the chars back,
        // which will update the terminal buffer but we won't see those as
        // keystrokes (they come via PTY data). Reset so we don't keep
        // computing suggestions for old partial input.
        this._currentInput = suggestion;
        this._hideSuggestion();
        return;
      }
    }

    // Ctrl combinations (except Ctrl+A, Ctrl+E) — reset.
    if (domEvent.ctrlKey && key !== "a" && key !== "e") {
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }

    // Escape, arrow keys (up/down) — reset.
    if (
      key === "Escape" ||
      key === "ArrowUp" ||
      key === "ArrowDown"
    ) {
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }

    if (key === "Enter") {
      this._inCommand = true;
      this._currentInput = "";
      this._hideSuggestion();
      return;
    }

    if (key === "Backspace") {
      this._currentInput = this._currentInput.slice(0, -1);
    } else if (key === "ArrowLeft") {
      // Cursor moved left; hide suggestion (can't easily know position).
      this._hideSuggestion();
      return;
    } else if (key.length === 1) {
      // Printable character.
      this._currentInput += key;
    }

    this._updateSuggestion();
  }

  private _currentSuggestion(): string | null {
    if (!this._currentInput.trim()) return null;
    for (const h of this._history) {
      if (h.startsWith(this._currentInput) && h !== this._currentInput) {
        return h;
      }
    }
    return null;
  }

  private _updateSuggestion(): void {
    const suggestion = this._currentSuggestion();
    if (!suggestion) {
      this._hideSuggestion();
      return;
    }

    const term = this._term;
    if (!term) return;

    const remaining = suggestion.slice(this._currentInput.length);
    if (!remaining) {
      this._hideSuggestion();
      return;
    }

    // Remove previous overlay.
    this._hideSuggestion();

    // Create a new decoration at the current cursor row.
    try {
      const decoration = term.registerDecoration({
        marker: term.registerMarker(0),
        overviewRulerOptions: undefined,
      });
      if (!decoration) return;

      this._decorationDisposable = decoration;

      decoration.onRender((el) => {
        if (this._decorationEl === el) return;
        this._decorationEl = el;
        // Clear previous overlay children.
        while (el.firstChild) el.removeChild(el.firstChild);

        // Measure cell size (width per character).
        const dims = (term as unknown as { _core?: { _renderService?: { dimensions?: { actualCellWidth?: number } } } })
          ._core?._renderService?.dimensions;
        const cellWidth = dims?.actualCellWidth ?? 8;
        const col = term.buffer.active.cursorX;

        const ghost = document.createElement("span");
        ghost.textContent = remaining;
        ghost.style.cssText = [
          `position:absolute`,
          `left:${col * cellWidth}px`,
          `top:0`,
          `color:rgba(150,150,150,0.5)`,
          `pointer-events:none`,
          `white-space:pre`,
          `font:inherit`,
          `z-index:1`,
        ].join(";");
        el.appendChild(ghost);
      });
    } catch {
      // registerDecoration may throw in some versions; fail silently.
    }
  }

  private _hideSuggestion(): void {
    this._decorationEl = null;
    if (this._decorationDisposable) {
      this._decorationDisposable.dispose();
      this._decorationDisposable = null;
    }
  }
}
