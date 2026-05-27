import { LazyStore } from "@tauri-apps/plugin-store";

/**
 * Persists tab layout (terminal tabs + active id) across app restarts.
 * Stored inside the same opincode-settings.json file for simplicity;
 * keyed under "tabsLayout" to keep it namespaced.
 *
 * Only TerminalTab entries are serialized — editor/diff/preview/git tabs
 * are ephemeral and don't need session memory.
 */

const store = new LazyStore("opincode-settings.json", {
  defaults: {},
  autoSave: false,
});

const KEY = "tabsLayout";
const SCHEMA_VERSION = 1;

export type PersistedPaneNode =
  | { kind: "leaf"; id: number; cwd?: string }
  | {
      kind: "split";
      id: number;
      dir: "row" | "col";
      children: PersistedPaneNode[];
    };

export type PersistedTerminalTab = {
  id: number;
  title: string;
  cwd?: string;
  paneTree: PersistedPaneNode;
  activeLeafId: number;
  private?: boolean;
};

export type PersistedTabLayout = {
  version: number;
  activeId: number;
  nextId: number;
  tabs: PersistedTerminalTab[];
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 500;

export async function saveTabLayout(
  layout: PersistedTabLayout,
): Promise<void> {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await store.set(KEY, layout);
      await store.save();
    } catch (e) {
      console.warn("[opincode] saveTabLayout failed:", e);
    }
  }, SAVE_DEBOUNCE_MS);
}

export async function loadTabLayout(): Promise<PersistedTabLayout | null> {
  try {
    const raw = await store.get<PersistedTabLayout>(KEY);
    if (!raw || raw.version !== SCHEMA_VERSION) return null;
    if (!Array.isArray(raw.tabs) || raw.tabs.length === 0) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function clearTabLayout(): Promise<void> {
  try {
    await store.delete(KEY);
    await store.save();
  } catch {
    // non-fatal
  }
}
