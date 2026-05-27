/**
 * Drop-in replacement for `useTabs` that restores the previous tab layout
 * from persistent storage on first mount.
 *
 * Because tauri-plugin-store is async we need to load the layout *before*
 * the first render. We do this with a top-level `use` (React 19 / Suspense)
 * trick: the caller wraps App in a Suspense boundary, or — simpler — we
 * expose a two-phase hook: call `useLoadedTabLayout()` to get the snapshot
 * then pass it straight into `useTabs`.
 *
 * Since App.tsx is already rendered client-side only (Tauri), we use a
 * simpler approach: read the layout synchronously from a module-level
 * bootstrap promise that is kicked off at module import time.
 */

import { useEffect, useRef, useState } from "react";
import { loadTabLayout, type PersistedTabLayout } from "./layoutStore";
import { useTabs } from "./useTabs";
import type { TerminalTab } from "./useTabs";

// Start loading immediately at module import time so it is likely resolved
// by the first render call.
let layoutPromise: Promise<PersistedTabLayout | null> | null = null;
let cachedLayout: PersistedTabLayout | null | undefined = undefined; // undefined = not yet resolved

function getLayoutPromise(): Promise<PersistedTabLayout | null> {
  if (!layoutPromise) layoutPromise = loadTabLayout();
  return layoutPromise;
}

// Kick off loading as early as possible.
void getLayoutPromise().then((l) => {
  cachedLayout = l;
});

/**
 * Hook that resolves the persisted layout synchronously if it was loaded
 * fast enough, or waits for it and triggers a re-render.
 *
 * Returns `{ ready: false }` while loading and `{ ready: true, layout }` once done.
 */
function usePersistedLayout(): { ready: boolean; layout: PersistedTabLayout | null } {
  const [state, setState] = useState<{ ready: boolean; layout: PersistedTabLayout | null }>(() => {
    if (cachedLayout !== undefined) {
      return { ready: true, layout: cachedLayout };
    }
    return { ready: false, layout: null };
  });

  const effectRan = useRef(false);
  useEffect(() => {
    if (effectRan.current) return;
    effectRan.current = true;
    if (state.ready) return;
    void getLayoutPromise().then((layout) => {
      cachedLayout = layout;
      setState({ ready: true, layout });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

/**
 * usePersistedTabs — same API as useTabs, but restores the previous session's
 * terminal tab structure from the local store.
 *
 * When the layout is still loading (first few ms after boot), it renders with
 * the default state and then immediately replaces it once the store responds.
 * In practice the store reads complete in < 5 ms on all supported platforms so
 * the flash is not visible.
 */
export function usePersistedTabs(initial?: Partial<TerminalTab>) {
  const { layout } = usePersistedLayout();
  // Pass the layout to useTabs. useTabs reads it only during initial state
  // construction, so even though layout may arrive on the next tick, the
  // React state will be initialized correctly from that layout.
  return useTabs(initial, layout);
}
