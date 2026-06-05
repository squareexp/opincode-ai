import { HugeiconsIcon } from "@hugeicons/react";
import {
  Key01Icon,
  Add01Icon,
  Attachment01Icon,
  Mic01Icon,
  StopCircleIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useComposer, ACCEPTED_FILES } from "@/modules/ai/lib/composer";
import { useWorkspaceFiles } from "@/modules/ai/hooks/useWorkspaceFiles";
import { SLASH_COMMANDS } from "@/modules/ai/lib/slashCommands";
import { useChatStore } from "@/modules/ai/store/chatStore";
import { useSnippetsStore } from "@/modules/ai/store/snippetsStore";
import { AgentSwitcher } from "@/modules/ai/components/AgentSwitcher";
import {
  FilePickerContent,
  SnippetPickerContent,
  SkillPickerContent,
  type PickerItem,
} from "@/modules/ai/components/UnifiedPicker";
import { listAllSkills, type ResolvedSkill } from "@/modules/ai/lib/skills";
import {
  RichInputEditor,
  type RichInputEditorHandle,
  type PillData,
} from "@/modules/ai/components/RichInputEditor";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setYoloMode } from "@/modules/settings/store";
import { cn } from "@/lib/utils";
import { YOLOIcon } from "../lib/icons";
import { ArrowUp } from "iconsax-react";

// ── Trigger detection ─────────────────────────────────────────────────────

type SnippetTrigger = { start: number; end: number; query: string };
type FileTrigger    = { start: number; end: number; query: string };
type SkillTrigger   = { start: number; end: number; query: string };

function detectSnippetTrigger(value: string, caret: number): SnippetTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "#") {
      const prev = i === 0 ? " " : value[i - 1];
      if (!/\s/.test(prev)) return null;
      const slice = value.slice(i + 1, caret);
      if (!/^[a-z0-9-]*$/i.test(slice)) return null;
      return { start: i, end: caret, query: slice.toLowerCase() };
    }
    if (/\s/.test(ch)) return null;
    if (!/[a-z0-9-]/i.test(ch)) return null;
  }
  return null;
}

function detectFileTrigger(value: string, caret: number): FileTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "@") {
      const prev = i === 0 ? " " : value[i - 1];
      if (!/\s/.test(prev)) return null;
      const slice = value.slice(i + 1, caret);
      return { start: i, end: caret, query: slice };
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

function detectSkillTrigger(value: string, caret: number): SkillTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = value[i];
    if (ch === "$" || ch === "/") {
      // Allow $ or / at start of input OR after whitespace
      const prev = i === 0 ? " " : value[i - 1];
      if (!/\s/.test(prev)) return null;
      const slice = value.slice(i + 1, caret);
      if (!/^[a-z0-9_-]*$/i.test(slice)) return null;
      return { start: i, end: caret, query: slice.toLowerCase() };
    }
    if (/\s/.test(ch)) return null;
    if (!/[a-z0-9_-]/i.test(ch)) return null;
  }
  return null;
}

// ── AiInputBar ────────────────────────────────────────────────────────────

export function AiInputBar() {
  const c = useComposer();
  const snippets = useSnippetsStore((s) => s.snippets);
  const workspaceRoot = useChatStore((s) => s.live.getWorkspaceRoot());

  // Rich editor ref
  const editorRef = useRef<RichInputEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const yoloMode = usePreferencesStore((s) => s.yoloMode);

  // Caret state for trigger detection
  const [editorText, setEditorText] = useState("");

  // Trigger states
  const [trigger, setTrigger]           = useState<SnippetTrigger | null>(null);
  const [fileTrigger, setFileTrigger]   = useState<FileTrigger | null>(null);
  const [skillTrigger, setSkillTrigger] = useState<SkillTrigger | null>(null);
  const [availableSkills, setAvailableSkills] = useState<ResolvedSkill[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const workspaceFiles = useWorkspaceFiles(workspaceRoot, fileTrigger !== null);

  // Debounce file query
  const [fileQuery, setFileQuery] = useState("");
  useEffect(() => {
    if (!fileTrigger) { setFileQuery(""); return; }
    const q = fileTrigger.query;
    const t = window.setTimeout(() => setFileQuery(q), 50);
    return () => window.clearTimeout(t);
  }, [fileTrigger]);

  // Load skills when trigger opens
  useEffect(() => {
    if (skillTrigger) {
      listAllSkills(workspaceRoot).then(setAvailableSkills).catch(console.error);
    }
  }, [skillTrigger, workspaceRoot]);

  // Update triggers whenever text or caret changes
  const updateTriggers = useCallback((text: string, caret: number) => {
    setEditorText(text);
    setTrigger(detectSnippetTrigger(text, caret));
    setFileTrigger(detectFileTrigger(text, caret));
    setSkillTrigger(detectSkillTrigger(text, caret));
  }, []);

  // Keep c.value in sync for composer submit logic
  useEffect(() => {
    c.setValue(editorText);
  }, [editorText, c.setValue]);

  // Focus from chatStore focus signals
  const focusSignal = useChatStore((s) => s.focusSignal);
  useEffect(() => {
    if (focusSignal === 0) return;
    editorRef.current?.focus();
  }, [focusSignal]);

  // Re-focus after agent finishes
  const isBusy = useChatStore((s) => {
    const st = s.agentMeta.status;
    return st === "thinking" || st === "streaming";
  });
  const prevBusy = useRef(false);
  useEffect(() => {
    if (prevBusy.current && !isBusy) {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
    prevBusy.current = isBusy;
  }, [isBusy]);

  // Clear editor after submit
  const prevValue = useRef("");
  useEffect(() => {
    // When composer clears value after submit, also clear the DOM
    if (c.value === "" && prevValue.current !== "") {
      editorRef.current?.clear();
    }
    prevValue.current = c.value;
  }, [c.value]);

  // ── Filtered lists ──────────────────────────────────────────────────────

  const filteredSkills = useMemo(() => {
    if (!skillTrigger) return [];
    const q = skillTrigger.query;
    if (!q) return availableSkills;
    return availableSkills.filter((s) => s.name.toLowerCase().includes(q));
  }, [skillTrigger, availableSkills]);

  const filteredItems = useMemo<PickerItem[]>(() => {
    if (!trigger) return [];
    const q = trigger.query;
    const cmdItems: PickerItem[] = Object.values(SLASH_COMMANDS)
      .filter((c) => !q || c.name.includes(q) || c.label.toLowerCase().includes(q))
      .map((command) => ({ kind: "command", command }));
    const snipItems: PickerItem[] = snippets
      .filter(
        (s) =>
          !q ||
          s.handle.includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      )
      .map((snippet) => ({ kind: "snippet", snippet }));
    return [...cmdItems, ...snipItems];
  }, [trigger, snippets]);

  const FILE_PICKER_CAP = 30;
  const filteredFiles = useMemo<string[]>(() => {
    if (!fileTrigger) return [];
    const q = fileQuery.toLowerCase();
    if (!q) return workspaceFiles.files.slice(0, FILE_PICKER_CAP);
    const out: string[] = [];
    for (const f of workspaceFiles.files) {
      if (f.toLowerCase().includes(q)) {
        out.push(f);
        if (out.length >= FILE_PICKER_CAP) break;
      }
    }
    return out;
  }, [fileTrigger, fileQuery, workspaceFiles.files]);

  const fileTriggerOpen    = fileTrigger !== null;
  const snippetTriggerOpen = trigger !== null;
  const skillTriggerOpen   = skillTrigger !== null;
  useEffect(() => { setActiveIndex(0); }, [snippetTriggerOpen, fileTriggerOpen, skillTriggerOpen, fileQuery]);

  const pickerOpen = trigger !== null || fileTrigger !== null || skillTrigger !== null;

  // ── Picker callbacks ────────────────────────────────────────────────────

  const onPickSkill = useCallback((skill: ResolvedSkill) => {
    if (!skillTrigger) return;
    const pill: PillData = { kind: "skill", skill };
    const triggerStart = skillTrigger.start;
    const triggerEnd = skillTrigger.end;
    setSkillTrigger(null);
    setActiveIndex(0);
    c.addSkill(skill);
    editorRef.current?.insertPill(pill, { start: triggerStart, end: triggerEnd });
  }, [skillTrigger, c]);

  const onPickItem = useCallback((item: PickerItem) => {
    if (!trigger) return;
    const triggerStart = trigger.start;
    const triggerEnd = trigger.end;
    setTrigger(null);
    setActiveIndex(0);
    if (item.kind === "snippet") {
      const pill: PillData = { kind: "snippet", snippet: item.snippet };
      c.addSnippet(item.snippet);
      editorRef.current?.insertPill(pill, { start: triggerStart, end: triggerEnd });
    } else {
      const pill: PillData = { kind: "command", command: item.command };
      c.addCommand(item.command);
      editorRef.current?.insertPill(pill, { start: triggerStart, end: triggerEnd });
    }
  }, [trigger, c]);

  const onPickFile = useCallback(async (filePath: string) => {
    if (!fileTrigger || !workspaceRoot) return;
    const triggerStart = fileTrigger.start;
    const triggerEnd = fileTrigger.end;
    setFileTrigger(null);
    setActiveIndex(0);
    const fullPath = workspaceRoot.endsWith("/")
      ? `${workspaceRoot}${filePath}`
      : `${workspaceRoot}/${filePath}`;

    const isFolder = filePath.endsWith("/");
    const cleanPath = isFolder ? filePath.slice(0, -1) : filePath;
    const name = cleanPath.split("/").pop() ?? cleanPath;

    const pill: PillData = {
      kind: "file",
      file: {
        id: `path-${fullPath}`,
        name,
        kind: isFolder ? "folder" : "text",
        mediaType: "text/plain",
        size: 0,
      },
    };
    editorRef.current?.insertPill(pill, { start: triggerStart, end: triggerEnd });

    await c.attachFileByPath(fullPath);
  }, [fileTrigger, workspaceRoot, c]);

  const pickActive = useCallback(() => {
    if (fileTrigger) {
      const file = filteredFiles[activeIndex];
      if (file) void onPickFile(file);
      return;
    }
    if (skillTrigger) {
      const skill = filteredSkills[activeIndex];
      if (skill) onPickSkill(skill);
      return;
    }
    const it = filteredItems[activeIndex];
    if (it) onPickItem(it);
  }, [fileTrigger, skillTrigger, filteredFiles, filteredSkills, filteredItems, activeIndex, onPickFile, onPickSkill, onPickItem]);

  // ── Build unified pill list for onPillRemove callback ───────────────────

  const allPills = useMemo<PillData[]>(() => {
    const out: PillData[] = [];
    for (const s of c.pickedSkills) out.push({ kind: "skill", skill: s });
    for (const sn of c.pickedSnippets) out.push({ kind: "snippet", snippet: sn });
    for (const cmd of c.pickedCommands) out.push({ kind: "command", command: cmd });
    for (const f of c.files) out.push({ kind: "file", file: f });
    return out;
  }, [c.pickedSkills, c.pickedSnippets, c.pickedCommands, c.files]);

  const onPillRemove = useCallback((pill: PillData) => {
    if (pill.kind === "skill")    c.removeSkill(pill.skill.name);
    if (pill.kind === "snippet")  {
      c.removeSnippet(pill.snippet.id);
      const re = new RegExp(`(^|\\s)#${pill.snippet.handle}\\b ?`);
      c.setValue((v) => v.replace(re, (_m, lead: string) => lead));
    }
    if (pill.kind === "command")  c.removeCommand(pill.command.name);
    if (pill.kind === "file")     c.removeFile(pill.file.id);
  }, [c]);

  const voiceLabel = c.voice.recording
    ? "Listening…"
    : c.voice.transcribing
      ? "Transcribing…"
      : null;

  return (
    <div className="shrink-0 bg-card/40 px-3 py-2">
      <div className="flex flex-col gap-1.5 px-1 py-1">
        <Popover open={pickerOpen}>
          <PopoverAnchor asChild>
            <div
              onClick={() => editorRef.current?.focus()}
              className="flex max-w-4xl flex-col items-stretch rounded-2xl bg-gray-400/10 px-3.5 py-2.5 border border-transparent focus-within:border-border/60 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_FILES}
                className="hidden"
                onChange={(e) => {
                  void c.addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="flex items-start gap-2">
                <RichInputEditor
                  ref={editorRef}
                  pills={allPills}
                  onPillRemove={onPillRemove}
                  onChange={(text) => setEditorText(text)}
                  onCaretChange={updateTriggers}
                  placeholder="Ask OpinCode anything   -   # snippets · @ files · / skills"
                  onKeyDown={(e) => {
                    if (pickerOpen) {
                      const items = fileTrigger
                        ? filteredFiles
                        : skillTrigger
                          ? filteredSkills
                          : filteredItems;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((i) =>
                          Math.min(i + 1, Math.max(0, items.length - 1)),
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((i) => Math.max(0, i - 1));
                        return;
                      }
                      if (e.key === "Tab" || e.key === "Enter") {
                        if (items.length > 0) {
                          e.preventDefault();
                          pickActive();
                          return;
                        }
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setTrigger(null);
                        setFileTrigger(null);
                        setSkillTrigger(null);
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      c.submit();
                    }
                  }}
                  className="flex-1"
                />
              </div>

              {/* Bottom controls bar inside rich input field capsule */}
              <div
                className="mt-2.5 flex items-center justify-between border-t border-border/10 pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Left group: Plus button, Document picker, Yolo Mode */}
                <div className="flex items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        title="Add context or actions..."
                        className="size-5.5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors hover:bg-accent"
                      >
                        <HugeiconsIcon
                          icon={Add01Icon}
                          strokeWidth={1.75}
                          size={12}
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-40 text-xs"
                    >
                      <DropdownMenuItem
                        onSelect={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <HugeiconsIcon
                          icon={Attachment01Icon}
                          strokeWidth={1.75}
                          size={12}
                        />
                        <span>Attach files...</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          if (editorRef.current?.el) {
                            const el = editorRef.current.el;
                            el.focus();
                            document.execCommand("insertText", false, "/");
                          }
                        }}
                        className="gap-2 font-mono"
                      >
                        <span>/</span>
                        <span>Run skill...</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          if (editorRef.current?.el) {
                            const el = editorRef.current.el;
                            el.focus();
                            document.execCommand("insertText", false, "#");
                          }
                        }}
                        className="gap-2 font-mono"
                      >
                        <span>#</span>
                        <span>Run command / snippet...</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    id="input-yolo-mode-toggle"
                    title={
                      yoloMode
                        ? "YOLO mode ON - all tool approvals are auto-accepted. Click to disable."
                        : "YOLO mode - auto-approve all AI tool calls without prompts"
                    }
                    onClick={() => void setYoloMode(!yoloMode)}
                    className={cn(
                      "relative flex h-5.5 items-center gap-1 rounded-full border px-1.5 text-[9.5px] font-medium transition-all select-none",
                      yoloMode
                        ? "border-green-500/60 bg-green-500/10 text-green-500 hover:bg-green-500/20"
                        : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {yoloMode && (
                      <span className="absolute inset-0 rounded-full ring-1 ring-green-500/40 animate-pulse pointer-events-none" />
                    )}
                    <YOLOIcon
                      size={14}
                      className={cn(
                        yoloMode ? "text-green-500" : "text-muted-foreground",
                      )}
                    />
                    Full Access
                  </button>
                </div>

                {/* Right group: AgentSwitcher, Mic, Send/Stop */}
                <div className="flex items-center gap-2">
                  <AgentSwitcher />
                  {c.voice.supported && (
                    <button
                      type="button"
                      title={
                        !c.voice.hasKey
                          ? "Voice needs an OpenAI key"
                          : c.voice.recording
                            ? "Stop & transcribe"
                            : c.voice.transcribing
                              ? "Transcribing…"
                              : "Voice input"
                      }
                      onClick={() =>
                        c.voice.recording
                          ? c.voice.stop()
                          : void c.voice.start()
                      }
                      disabled={
                        c.isBusy || c.voice.transcribing || !c.voice.hasKey
                      }
                      className={cn(
                        "size-6 rounded-full flex items-center justify-center text-muted-foreground hover:border-border/60 hover:text-foreground transition-colors hover:bg-accent disabled:opacity-50",
                        c.voice.recording &&
                          "bg-destructive/10 text-destructive hover:bg-destructive/15",
                      )}
                    >
                      {c.voice.recording ? (
                        <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                      ) : c.voice.transcribing ? (
                        <Spinner className="size-3" />
                      ) : (
                        <HugeiconsIcon
                          icon={Mic01Icon}
                          strokeWidth={1.75}
                          size={14}
                        />
                      )}
                    </button>
                  )}

                  {isBusy ? (
                    <button
                      type="button"
                      onClick={c.stop}
                      className="size-5.5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Stop"
                    >
                      <HugeiconsIcon
                        icon={StopCircleIcon}
                        strokeWidth={1.75}
                        size={14}
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={c.submit}
                      disabled={!c.canSend}
                      className={cn(
                        "border-border/60 h-6 flex items-center justify-center w-6 rounded-full border  bg-transparent px-1.5 text-[9.5px] font-medium transition-colors",
                        c.canSend
                          ? "bg-white/6 text-gray-500 hover:bg-accent cursor-pointer hover:text-foreground "
                          : " ",
                      )}
                      title="Send (Enter)"
                    >
                      <ArrowUp color="currentColor" className="text-foreground" size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </PopoverAnchor>

          {fileTrigger ? (
            <FilePickerContent
              files={filteredFiles}
              activeIndex={activeIndex}
              indexing={workspaceFiles.indexing}
              truncated={workspaceFiles.truncated}
              hasWorkspace={workspaceRoot !== null}
              onPick={(f) => void onPickFile(f)}
              onHover={setActiveIndex}
            />
          ) : skillTrigger ? (
            <SkillPickerContent
              skills={filteredSkills}
              activeIndex={activeIndex}
              onPick={onPickSkill}
              onHover={setActiveIndex}
            />
          ) : (
            <SnippetPickerContent
              items={filteredItems}
              activeIndex={activeIndex}
              onPick={onPickItem}
              onHover={setActiveIndex}
            />
          )}
        </Popover>

        <AnimatePresence initial={false}>
          {voiceLabel && (
            <motion.div
              key={voiceLabel}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
            >
              {c.voice.recording ? (
                <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
              ) : (
                <Spinner className="size-3" />
              )}
              <span className="truncate">{voiceLabel}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type AiInputBarProps = { tabId: number };

export function AiInputBarConnect({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="shrink-0 border-t border-border/60 bg-card/40 px-3 py-2">
      <div className="flex h-10 items-center justify-between gap-3 rounded-lg px-3 text-xs">
        <span className="text-muted-foreground">
          Connect any AI provider (or use local models) - your key stays in your
          OS keychain.
        </span>
        <Button size="xs" onClick={onAdd}>
          <HugeiconsIcon icon={Key01Icon} strokeWidth={1.75} />
          Connect provider
        </Button>
      </div>
    </div>
  );
}
