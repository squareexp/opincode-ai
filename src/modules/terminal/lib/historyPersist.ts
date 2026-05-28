/**
 * Terminal command history persistence.
 *
 * Saves the global command history ring to disk using the same LazyStore
 * infrastructure as user preferences. History is shared across all terminal
 * sessions and persists across app restarts.
 *
 * Design decisions:
 * - Max 500 entries on disk (matches MAX_HISTORY in historyAddon.ts).
 * - Debounced writes: we flush at most every DEBOUNCE_MS after a new entry.
 * - Single JSON array keyed at "history" in its own store file so it doesn't
 *   pollute the settings store.
 */

import { LazyStore } from "@tauri-apps/plugin-store";

const HISTORY_STORE_PATH = "opincode-cmd-history.json";
const HISTORY_KEY = "history";
const MAX_ENTRIES = 500;
const DEBOUNCE_MS = 1500;

const historyStore = new LazyStore(HISTORY_STORE_PATH, {
  defaults: {},
  autoSave: 2000,
});

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingHistory: string[] | null = null;

/** Load the persisted history ring from disk. Returns [] if not found. */
export async function loadHistory(): Promise<string[]> {
  try {
    const stored = await historyStore.get<string[]>(HISTORY_KEY);
    if (Array.isArray(stored)) {
      return stored.slice(0, MAX_ENTRIES);
    }
  } catch (e) {
    console.warn("[opincode] failed to load cmd history:", e);
  }
  return [];
}

/** Schedule a debounced disk write for the current history ring. */
export function persistHistory(history: string[]): void {
  pendingHistory = history.slice(0, MAX_ENTRIES);
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const toWrite = pendingHistory;
    pendingHistory = null;
    if (!toWrite) return;
    historyStore
      .set(HISTORY_KEY, toWrite)
      .then(() => historyStore.save())
      .catch((e) => console.warn("[opincode] failed to persist cmd history:", e));
  }, DEBOUNCE_MS);
}

/** Immediately flush any pending write (call on app quit / session dispose). */
export function flushHistory(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!pendingHistory) return;
  const toWrite = pendingHistory;
  pendingHistory = null;
  historyStore
    .set(HISTORY_KEY, toWrite)
    .then(() => historyStore.save())
    .catch((e) => console.warn("[opincode] failed to flush cmd history:", e));
}
