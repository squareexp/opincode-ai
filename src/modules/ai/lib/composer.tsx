import { invoke } from "@tauri-apps/api/core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWhisperRecording } from "@/modules/ai/hooks/useWhisperRecording";
import { expandSnippetTokens, type Snippet } from "@/modules/ai/lib/snippets";
import { tryRunSlashCommand, type SlashCommandMeta } from "@/modules/ai/lib/slashCommands";
import { findSkill, runSkill, type ResolvedSkill } from "@/modules/ai/lib/skills";
import { toast } from "sonner";
import { getOrCreateChat, useChatStore } from "@/modules/ai/store/chatStore";
import { useSnippetsStore } from "@/modules/ai/store/snippetsStore";
import { currentWorkspaceEnv } from "@/modules/workspace";

export type FileAttachment = {
  id: string;
  name: string;
  kind: "image" | "text" | "selection" | "folder";
  mediaType: string;
  url?: string;
  text?: string;
  size: number;
  /** For kind === "selection": which surface it came from. */
  source?: "terminal" | "editor";
};

type MessagePart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; url: string; filename?: string };

export const MAX_TEXT_INLINE = 200_000;
export const ACCEPTED_FILES =
  "image/*,.txt,.md,.json,.yaml,.yml,.toml,.sh,.zsh,.bash,.py,.js,.jsx,.ts,.tsx,.rs,.go,.java,.c,.cpp,.h,.hpp,.html,.css,.csv,.log,.env,.config,.conf,.ini,Dockerfile,.dockerfile";

type Voice = ReturnType<typeof useWhisperRecording>;

type ComposerCtx = {
  editorRef: React.RefObject<HTMLDivElement | null>;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  files: FileAttachment[];
  addFiles: (list: FileList | null) => Promise<void>;
  /** Attach a file by absolute path — used by the file explorer's "Attach to Agent". */
  attachFileByPath: (path: string) => Promise<void>;
  removeFile: (id: string) => void;
  pickedSnippets: Snippet[];
  addSnippet: (s: Snippet) => void;
  removeSnippet: (id: string) => void;
  pickedCommands: SlashCommandMeta[];
  addCommand: (c: SlashCommandMeta) => void;
  removeCommand: (name: string) => void;
  pickedSkills: ResolvedSkill[];
  addSkill: (s: ResolvedSkill) => void;
  removeSkill: (name: string) => void;
  isBusy: boolean;
  submit: () => void;
  stop: () => void;
  voice: Voice;
  canSend: boolean;
};

const Ctx = createContext<ComposerCtx | null>(null);

export function useComposer(): ComposerCtx {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useComposer must be used inside <AiComposerProvider>");
  return ctx;
}

type ProviderProps = {
  children: React.ReactNode;
};

export function AiComposerProvider({ children }: ProviderProps) {
  const sessionId = useChatStore((s) => s.activeSessionId);
  const status = useChatStore((s) => s.agentMeta.status);
  const isBusy = status === "thinking" || status === "streaming";

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [pickedSnippets, setPickedSnippets] = useState<Snippet[]>([]);
  const [pickedCommands, setPickedCommands] = useState<SlashCommandMeta[]>([]);
  const [pickedSkills, setPickedSkills] = useState<ResolvedSkill[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);

  const focusSignal = useChatStore((s) => s.focusSignal);
  const pendingPrefill = useChatStore((s) => s.pendingPrefill);
  const consumePrefill = useChatStore((s) => s.consumePrefill);
  const pendingSelections = useChatStore((s) => s.pendingSelections);
  const consumeSelections = useChatStore((s) => s.consumeSelections);

  useEffect(() => {
    if (focusSignal === 0) return;
    editorRef.current?.focus();
    if (pendingPrefill != null) {
      const text = consumePrefill();
      if (text) setValue((v) => (v ? `${text}${v}` : text));
    }
  }, [focusSignal, pendingPrefill, consumePrefill]);

  // Re-focus the textarea whenever the agent finishes a response
  const prevIsBusyRef = useRef(false);
  useEffect(() => {
    if (prevIsBusyRef.current && !isBusy) {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
    prevIsBusyRef.current = isBusy;
  }, [isBusy, editorRef]);

  // Listen for explorer's "Attach to Agent" event.
  useEffect(() => {
    const onAttach = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (typeof path === "string" && path.length > 0) {
        void attachFileByPath(path);
      }
    };
    window.addEventListener("opincode:ai-attach-file", onAttach);
    return () => window.removeEventListener("opincode:ai-attach-file", onAttach);
    // attachFileByPath is stable for our purposes (closes over setFiles only)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingSelections.length === 0) return;
    const drained = consumeSelections();
    if (drained.length === 0) return;
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.id));
      const next: FileAttachment[] = [];
      for (const sel of drained) {
        if (existing.has(sel.id)) continue;
        next.push({
          id: sel.id,
          name:
            sel.source === "editor"
              ? "Editor selection"
              : "Terminal selection",
          kind: "selection",
          mediaType: "text/plain",
          text: sel.text,
          size: sel.text.length,
          source: sel.source,
        });
      }
      return next.length ? [...prev, ...next] : prev;
    });
  }, [pendingSelections, consumeSelections]);

  const voice = useWhisperRecording({
    onResult: (transcript: string) => {
      setValue((v) => (v ? `${v} ${transcript}` : transcript));
      requestAnimationFrame(() => editorRef.current?.focus());
    },
  });

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: FileAttachment[] = [];
    for (const f of Array.from(list)) {
      const att = await readAttachment(f);
      if (att) next.push(att);
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const addSnippet = (s: Snippet) =>
    setPickedSnippets((prev) =>
      prev.some((p) => p.id === s.id) ? prev : [...prev, s],
    );
  const removeSnippet = (id: string) =>
    setPickedSnippets((prev) => prev.filter((s) => s.id !== id));

  const addCommand = (cmd: SlashCommandMeta) =>
    setPickedCommands((prev) =>
      prev.some((p) => p.name === cmd.name) ? prev : [...prev, cmd],
    );
  const removeCommand = (name: string) =>
    setPickedCommands((prev) => prev.filter((c) => c.name !== name));

  const addSkill = (s: ResolvedSkill) =>
    setPickedSkills((prev) =>
      prev.some((p) => p.name === s.name) ? prev : [...prev, s],
    );
  const removeSkill = (name: string) =>
    setPickedSkills((prev) => prev.filter((s) => s.name !== name));

  const attachFileByPath = async (path: string) => {
    try {
      const isFolder = path.endsWith("/");
      if (isFolder) {
        const folderPath = path.slice(0, -1);
        type ListFilesResult = { files: string[]; truncated: boolean };
        type ReadResult =
          | { kind: "text"; content: string; size: number }
          | { kind: "binary"; size: number }
          | { kind: "toolarge"; size: number; limit: number };
        const result = await invoke<ListFilesResult>("fs_list_files", {
          root: folderPath,
          workspace: currentWorkspaceEnv(),
        });
        // Read actual content of each file in the folder
        const fileContentBlocks: string[] = [];
        let totalSize = 0;
        for (const relPath of result.files) {
          // Skip directories (they end with "/" in our fs_list_files output)
          if (relPath.endsWith("/")) continue;
          const absFilePath = `${folderPath}/${relPath}`;
          try {
            const fileResult = await invoke<ReadResult>("fs_read_file", {
              path: absFilePath,
              workspace: currentWorkspaceEnv(),
            });
            if (fileResult.kind === "text") {
              const fileName = relPath.split("/").pop() || relPath;
              fileContentBlocks.push(
                `<file name="${fileName}" path="${relPath}">\n${fileResult.content}\n</file>`,
              );
              totalSize += fileResult.size;
            }
          } catch {
            // Skip unreadable files silently
          }
        }
        // Fall back to path list if no files could be read
        const folderText =
          fileContentBlocks.length > 0
            ? fileContentBlocks.join("\n\n")
            : result.files.join("\n");
        const name = folderPath.split("/").pop() || folderPath;
        const id = `path-${path}`;
        setFiles((prev) => {
          if (prev.some((f) => f.id === id)) return prev;
          const att: FileAttachment = {
            id,
            name,
            kind: "folder",
            mediaType: "text/plain",
            text: folderText,
            size: totalSize || folderText.length,
          };
          return [...prev, att];
        });
      } else {
        type ReadResult =
          | { kind: "text"; content: string; size: number }
          | { kind: "binary"; size: number }
          | { kind: "toolarge"; size: number; limit: number };
        const result = await invoke<ReadResult>("fs_read_file", {
          path,
          workspace: currentWorkspaceEnv(),
        });
        if (result.kind !== "text") {
          // Binary/oversize files: skip (could surface a toast in future).
          console.warn("attachFileByPath: skipped non-text file", path, result);
          return;
        }
        const name = path.split("/").pop() || path;
        const id = `path-${path}`;
        setFiles((prev) => {
          if (prev.some((f) => f.id === id)) return prev;
          const att: FileAttachment = {
            id,
            name,
            kind: "text",
            mediaType: "text/plain",
            text: result.content,
            size: result.size,
          };
          return [...prev, att];
        });
      }
      // Open the AI panel & focus the input so the user sees the chip.
      useChatStore.getState().focusInput();
    } catch (e) {
      console.error("attachFileByPath failed:", e);
    }
  };

  const submit = async () => {
    if (isBusy) return;
    const trimmed = value.trim();
    if (
      !trimmed &&
      files.length === 0 &&
      pickedSnippets.length === 0 &&
      pickedCommands.length === 0 &&
      pickedSkills.length === 0
    )
      return;

    // Slash-command interception. `/plan` toggles plan mode; `/init` rewrites
    // the prompt to the OPINCODE.md scan template before sending.
    let effectiveText = trimmed;
    let commandMarker: string | null = null;
    let commandSource = trimmed;

    // Check for picked skill command (pills)
    if (pickedSkills.length > 0) {
      const workspaceRoot = useChatStore.getState().live.getWorkspaceRoot();
      const skill = pickedSkills[0];
      try {
        let remainingText = trimmed;
        const skillNameLower = skill.name.toLowerCase();
        if (trimmed.toLowerCase().startsWith(skillNameLower)) {
          remainingText = trimmed.slice(skill.name.length).trim();
        }
        const skillBody = await runSkill(skill, remainingText, workspaceRoot);
        const isScript = ["sh", "bash", "zsh", "py", "js"].includes((skill.ext ?? "").toLowerCase());
        // Wrap in a skill block so the message display strips it and shows a pill,
        // and append the user's actual prompt text so it displays in the chat.
        effectiveText = `<skill name="${skill.name}" isScript="${isScript}">\n${skillBody}\n</skill>${remainingText ? `\n\n${remainingText}` : ""}`;
        commandSource = effectiveText;
      } catch (err: any) {
        toast.error(`Failed to run skill $${skill.name}: ${err?.message || err}`);
        return;
      }
    } else if (trimmed.startsWith("$") || trimmed.startsWith("/")) {
      // Check for typed skill command trigger ($prefix or /prefix)
      const match = trimmed.match(/^[\$/]([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+([\s\S]*))?$/);
      if (match) {
        const skillName = match[1];
        const remainingText = match[2] ? match[2].trim() : "";
        const workspaceRoot = useChatStore.getState().live.getWorkspaceRoot();
        const isSlashCmd = trimmed.startsWith("/") && ["plan", "init", "claude-code"].includes(skillName.toLowerCase());
        if (!isSlashCmd) {
          try {
            const skill = await findSkill(skillName, workspaceRoot);
            if (skill) {
              const skillBody = await runSkill(skill, remainingText, workspaceRoot);
              const isScript = ["sh", "bash", "zsh", "py", "js"].includes((skill.ext ?? "").toLowerCase());
              // Wrap in a skill block so the message display strips it and shows a pill,
              // and append the user's actual prompt text so it displays in the chat.
              effectiveText = `<skill name="${skill.name}" isScript="${isScript}">\n${skillBody}\n</skill>${remainingText ? `\n\n${remainingText}` : ""}`;
              commandSource = effectiveText;
            } else if (trimmed.startsWith("$")) {
              toast.error(`Skill not found: $${skillName}`);
              return;
            }
          } catch (err: any) {
            toast.error(`Failed to run skill $${skillName}: ${err?.message || err}`);
            return;
          }
        }
      }
    }
    if (pickedCommands.length > 0 && !trimmed.startsWith("/") && !trimmed.startsWith("#")) {
      commandSource = `#${pickedCommands[0].name} ${trimmed}`.trim();
    }
    if (commandSource.startsWith("/") || commandSource.startsWith("#")) {
      const outcome = tryRunSlashCommand(commandSource);
      if (outcome.kind === "handled") {
        setValue("");
        if (outcome.toast) console.info(outcome.toast);
        return;
      }
      if (outcome.kind === "send-prompt") {
        effectiveText = outcome.prompt;
        if (outcome.commandName) {
          commandMarker = `<opincode-command name="${outcome.commandName}" />`;
        }
      }
    }

    const parts: MessagePart[] = [];
    const fileBlocks = files
      .filter((f) => f.kind === "text")
      .map(
        (f) =>
          `<file name="${f.name}" mediaType="${f.mediaType}">\n${f.text ?? ""}\n</file>`,
      );
    const folderBlocks = files
      .filter((f) => f.kind === "folder")
      .map(
        (f) =>
          `<folder name="${f.name}">\n${f.text ?? ""}\n</folder>`,
      );
    const selectionBlocks = files
      .filter((f) => f.kind === "selection")
      .map(
        (f) =>
          `<selection source="${f.source ?? "terminal"}">\n${f.text ?? ""}\n</selection>`,
      );
    // Extract skill blocks from effectiveText so they compose correctly
    const skillBlocksFromText: string[] = [];
    let textWithoutSkillBlocks = effectiveText;
    const SKILL_BLOCK_RE = /<skill\s+name="([^"]+)">\n?[\s\S]*?\n?<\/skill>/g;
    if (SKILL_BLOCK_RE.test(effectiveText)) {
      SKILL_BLOCK_RE.lastIndex = 0;
      textWithoutSkillBlocks = effectiveText.replace(SKILL_BLOCK_RE, (match) => {
        skillBlocksFromText.push(match);
        return "";
      }).trim();
    }
    const { body: bodyAfterTokens, blocks: snippetBlocks } = expandSnippetTokens(
      textWithoutSkillBlocks,
      useSnippetsStore.getState().snippets,
    );
    const seenHandles = new Set<string>();
    const allSnippetBlocks: string[] = [];
    for (const s of pickedSnippets) {
      if (seenHandles.has(s.handle)) continue;
      seenHandles.add(s.handle);
      allSnippetBlocks.push(
        `<snippet name="${s.handle}">\n${s.content}\n</snippet>`,
      );
    }
    for (const block of snippetBlocks) {
      const m = block.match(/^<snippet name="([^"]+)"/);
      if (m && seenHandles.has(m[1])) continue;
      if (m) seenHandles.add(m[1]);
      allSnippetBlocks.push(block);
    }
    const composed = [
      commandMarker ?? "",
      skillBlocksFromText.join("\n\n"),
      allSnippetBlocks.join("\n\n"),
      selectionBlocks.join("\n\n"),
      folderBlocks.join("\n\n"),
      fileBlocks.join("\n\n"),
      bodyAfterTokens,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (composed) parts.push({ type: "text", text: composed });

    for (const f of files) {
      if (f.kind === "image" && f.url) {
        parts.push({
          type: "file",
          mediaType: f.mediaType,
          url: f.url,
          filename: f.name,
        });
      }
    }

    if (!sessionId) return;
    const chat = getOrCreateChat(sessionId);
    void chat.sendMessage({ role: "user", parts } as Parameters<
      typeof chat.sendMessage
    >[0]);
    const store = useChatStore.getState();
    store.patchAgentMeta({ hitStepCap: false, compactionNotice: null });
    if (!store.mini.open) store.openMini();
    setValue("");
    setFiles([]);
    setPickedSnippets([]);
    setPickedCommands([]);
    setPickedSkills([]);
    // Re-focus immediately after submit so the user can type a follow-up
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const stop = () => {
    if (!sessionId) return;
    void getOrCreateChat(sessionId).stop();
  };

  const canSend =
    !isBusy &&
    (value.trim().length > 0 ||
      files.length > 0 ||
      pickedSnippets.length > 0 ||
      pickedCommands.length > 0 ||
      pickedSkills.length > 0);

  const ctx: ComposerCtx = {
    editorRef,
    value,
    setValue,
    files,
    addFiles,
    attachFileByPath,
    removeFile,
    pickedSnippets,
    addSnippet,
    removeSnippet,
    pickedCommands,
    addCommand,
    removeCommand,
    pickedSkills,
    addSkill,
    removeSkill,
    isBusy,
    submit,
    stop,
    voice,
    canSend,
  };

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

async function readAttachment(file: File): Promise<FileAttachment | null> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  if (file.type.startsWith("image/")) {
    const url = await readAsDataURL(file);
    return {
      id,
      name: file.name,
      kind: "image",
      mediaType: file.type || "image/png",
      url,
      size: file.size,
    };
  }
  if (file.size > MAX_TEXT_INLINE) return null;
  const text = await file.text();
  return {
    id,
    name: file.name,
    kind: "text",
    mediaType: file.type || "text/plain",
    text,
    size: file.size,
  };
}

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
