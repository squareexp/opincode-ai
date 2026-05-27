export { TabBar } from "./TabBar";
export {
  MAX_PANES_PER_TAB,
  useTabs,
  serializeTabLayout,
  deserializeTabLayout,
  type Tab,
  type TerminalTab,
  type EditorTab,
  type PreviewTab,
  type MarkdownTab,
  type AiDiffTab,
  type GitDiffTab,
  type GitHistoryTab,
  type GitCommitFileDiffTab,
  type AiDiffStatus,
  type TabPatch,
} from "./lib/useTabs";
export { usePersistedTabs } from "./lib/usePersistedTabs";
export { loadTabLayout, clearTabLayout } from "./lib/layoutStore";
export { useWorkspaceCwd } from "./lib/useWorkspaceCwd";
