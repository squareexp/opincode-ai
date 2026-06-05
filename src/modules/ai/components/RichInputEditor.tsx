/**
 * RichInputEditor - A contenteditable-based input that renders pills
 * (skills, files, code snippets) inline with text, exactly like the
 * screenshot reference (Notion-style @mentions).
 *
 * Architecture:
 * - The component maintains a flat list of "segments": either {type:"text"}
 *   or {type:"pill"} entries.
 * - We serialize that into DOM: text nodes + non-editable <span> pills.
 * - On every input/mutation we parse the DOM back into segments and push
 *   the plain-text representation up via onChange.
 * - Pills are rendered as contenteditable="false" spans so the browser
 *   treats them as atomic units for cursor movement and deletion.
 */

import { CloseCircle } from "iconsax-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  FolderLibraryIcon,
  HashtagIcon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import type { ResolvedSkill } from "@/modules/ai/lib/skills";
import type { FileAttachment } from "@/modules/ai/lib/composer";
import type { Snippet } from "@/modules/ai/lib/snippets";
import type { SlashCommandMeta } from "@/modules/ai/lib/slashCommands";
import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";
import { fileIconUrl, folderIconUrl } from "@/modules/explorer/lib/iconResolver";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PillKind = "skill" | "file" | "snippet" | "command";

export type PillData =
  | { kind: "skill"; skill: ResolvedSkill }
  | { kind: "file"; file: FileAttachment }
  | { kind: "snippet"; snippet: Snippet }
  | { kind: "command"; command: SlashCommandMeta };

// ── Pill rendering helpers ─────────────────────────────────────────────────

function pillId(pill: PillData): string {
  switch (pill.kind) {
    case "skill":    return `pill-skill-${pill.skill.name}`;
    case "file":     return `pill-file-${pill.file.id}`;
    case "snippet":  return `pill-snippet-${pill.snippet.id}`;
    case "command":  return `pill-cmd-${pill.command.name}`;
  }
}

function pillLabel(pill: PillData): string {
  switch (pill.kind) {
    case "skill":    return pill.skill.name;
    case "file":     return pill.file.kind === "folder" ? `${pill.file.name}/` : pill.file.name;
    case "snippet":  return `#${pill.snippet.handle}`;
    case "command":  return `#${pill.command.name}`;
  }
}

function pillClasses(kind: PillKind): string {
  if (kind === "skill") {
    return "text-blue-600 dark:text-blue-400 capitalize ";
  }
  return "text-blue-600 dark:text-blue-400";
}

function PillIcon({ pill }: { pill: PillData }) {
  if (pill.kind === "skill") {
    return (
      <HugeiconsIcon icon={SparklesIcon} size={11} strokeWidth={2} className="shrink-0 opacity-80" />
    );
  }
  if (pill.kind === "file") {
    if (pill.file.kind === "selection") {
      return (
        <HugeiconsIcon
          icon={pill.file.source === "editor" ? CodeIcon : TerminalIcon}
          size={11}
          strokeWidth={2}
          className="shrink-0 opacity-80"
        />
      );
    }
    if (pill.file.kind === "image" && pill.file.url) {
      return <img src={pill.file.url} alt="" className="size-3.5 rounded object-cover shrink-0" />;
    }
    if (pill.file.kind === "folder") {
      return <img src={folderIconUrl(pill.file.name, false)} alt="" className="size-3.5 object-contain shrink-0" />;
    }
    return (
      <HugeiconsIcon icon={FolderLibraryIcon} size={11} strokeWidth={2} className="shrink-0 opacity-80" />
    );
  }
  if (pill.kind === "snippet") {
    return (
      <HugeiconsIcon icon={HashtagIcon} size={11} strokeWidth={2} className="shrink-0 opacity-80" />
    );
  }
  // command
  return (
    <HugeiconsIcon icon={pill.command.icon} size={11} strokeWidth={2} className="shrink-0 opacity-80" />
  );
}

// ── PILL DATA ATTRIBUTES ────────────────────────────────────────────────────
// We embed the pill data in data-pill-id and data-pill-json attributes on the
// span so we can reconstruct pill state from the DOM on mutations.

// ── RichInputEditor API ────────────────────────────────────────────────────

export type RichInputEditorHandle = {
  /** Insert a pill at the current caret position. */
  insertPill(pill: PillData, replaceRange?: { start: number; end: number }): void;
  /** Focus the editor. */
  focus(): void;
  /** Return the current plain-text content. */
  getText(): string;
  /** Clear all content. */
  clear(): void;
  /** The underlying contenteditable div. */
  el: HTMLDivElement | null;
};

export type RichInputEditorProps = {
  placeholder?: string;
  pills: PillData[];
  onPillRemove: (pill: PillData) => void;
  onChange: (text: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onCaretChange?: (text: string, caretOffset: number) => void;
  className?: string;
  minRows?: number;
};

// ── Data-serialised pill node ──────────────────────────────────────────────

/** Create a pill <span> DOM node for insertion. Must be kept in sync with renderPillHtml. */
function createPillNode(pill: PillData): HTMLSpanElement {
  const id = pillId(pill);
  const label = pillLabel(pill);
  const kind = pill.kind;

  const outer = document.createElement("span");
  outer.contentEditable = "false";
  outer.dataset.pillId = id;
  outer.dataset.pillKind = kind;
  outer.dataset.pillLabel = label;
  outer.dataset.pillJson = JSON.stringify(pill);
  outer.className = `inline-flex items-center gap-0.5 text-[12px] font-medium select-none mx-0.5 align-baseline ${pillClasses(kind as PillKind)}`;

  const iconSpan = document.createElement("span");
  iconSpan.className = "flex h-3.5 shrink-0 items-center justify-center select-none";

  if (kind === "skill") {
    const s = (pill as any).skill;
    const isScript = ["sh", "bash", "zsh", "py", "js"].includes((s?.ext ?? "").toLowerCase());
    if (isScript) {
      iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>`;
    } else {
      iconSpan.innerHTML = `<svg style="height: 12px; width: 9.2px;" viewBox="0 0 721.84 939.22" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M364.59.02c2.91-.28,6.7,1.93,9.17,3.38,36.8,30.98,82.23,55.76,114.06,91.94,14.07,15.99,26.44,33.57,40.05,49.95,34.14,41.09,72.55,71.63,75.97,129.03.99,16.72-3.75,39.15,7.03,52.97,9.97,12.77,22.57,22.78,32.79,37.21,31.52,44.5,31.91,86.8,49.44,135.56,18.28,50.84,34.76,78.47,26.58,136.09-6.37,44.83-18.37,115.29-48.32,149.68-45.48,52.21-142,125.61-208.75,144.25-43.15,12.05-132.11,10.64-177.12,4.6-72.18-9.69-168.16-78.1-217.16-130.84-40.33-43.42-52.47-109.35-65-166-12.55-56.78,13.29-96.31,27.02-148,11.56-43.51,8.22-84.74,44.48-117.52,9.32-8.43,20.68-13.16,24.72-26.28,5.84-18.94,4.05-50.89,6.3-71.7,5.65-52.21,59.84-45.36,79.16-86.84,16.58-35.57,13.37-49.94,44.3-79.7,22.84-21.98,49.25-43.13,74.07-62.93,15.26-12.18,37.56-32.03,53.55-41.45,2-1.18,5.43-3.17,7.65-3.38ZM344.85,328.81c-.02-2.54.85-4.93,1.05-7.46,3.55-46.36-2.7-97.25-.09-144.09-.69-35.36,4.46-77.13,1.11-112.01-.22-2.26-.1-4.11-2.55-5.18-18.06,12.26-36.1,24.92-52.99,38.76-22.11,18.11-68.07,56.59-57.98,88.93,3.96,12.7,23.49,27.9,32.97,38.03,20.59,22.03,41.74,44.56,57.9,70.1,5.75,9.09,11.84,23.65,17.76,31.24.86,1.11,1,2.08,2.82,1.67ZM386.84,289.81c15.32-29.83,36.13-56.31,54.04-84.47,20.58-32.35,39.23-62.08,10-96.05-11.63-13.52-45.86-40.63-61.69-48.31-1.21-.59-2.28-1.35-3.73-1.23-1.39.25-1.59,9.59-1.66,11.51-1.57,42.43.36,86.45.1,129.1-.16,25.76-2.41,52.12-1.08,78.01.06,1.23.6,13.86,4.01,11.43ZM497.62,187.01c-7.93,1.13-21.61,21.96-26.18,28.89-24.88,37.71-49.48,83.49-68.44,124.56-15.15,32.82-19.94,50.15-21.18,86.82-.54,16.12-1.7,41.7,0,57.09.17,1.51.1,2.48,1.55,3.43,13.44-15.41,24.65-32.6,37.52-48.46,17.41-21.45,36.38-41.59,56.96-60.04,23.43-21,75.71-55.31,85.76-83.24,14.86-41.28-6.96-67.75-36.73-92.76-6.81-5.72-20.19-17.59-29.25-16.29ZM198.63,237.09c-25.5.33-53.4,17.46-60.06,42.95-3.79,14.52-2.48,45.53,4.42,59.14,9.19,18.11,56.61,43.43,75.17,56.83,42.89,30.95,82.95,68.81,115.67,110.33,2.82,2.87,4.63,1.8,5.06-1.96,1.76-15.12-.11-37.12-.09-53.09,0-2.58,1.07-5.05,1.08-7.91.18-43.06-26.46-94.02-49.63-129.47-18.75-28.69-53.94-77.3-91.64-76.82ZM571.65,361.12c-39.43,3.66-106.43,78.1-129.18,109.81-28.02,39.05-50.12,83.28-56.48,131.52-1.35,10.21-4.26,32.54-3.14,41.9.26,2.19.72,4.03,2.53,5.48,1.5.34,2.11-1.29,2.89-2.1,10.51-10.85,20.29-26.24,31.08-37.92,44.95-48.63,107.88-87.67,170.26-109.74,13.29-4.7,39.2-9.25,47.7-20.3,7.4-9.62,3.24-24.04,1.24-35.13-6.36-35.23-20.96-87.78-66.89-83.52ZM335.87,660.82c2.18-.78,2.75-2.34,3.03-4.45,1.99-14.67.07-46.11-3.35-60.76-15.08-64.55-114.19-156.8-171.68-187.32-27.53-14.62-59.45-23.95-79.22,7.83-10.1,16.23-15.15,52.12-2.31,67.7,12.17,14.77,61.51,32.04,80.87,41.13,27.09,12.73,53.47,26.82,77.96,44.04,35.39,24.89,69.07,57.09,94.7,91.82ZM625.65,532.12c-85.88,7.04-198.62,107.97-231.97,185.03-14.41,33.29-12.45,71.14-13.86,107.13-.2,5.12,0,14.66,5.06,6.07,5.24-8.88,9.51-19.9,14.81-29.19,36.1-63.38,101.94-128.82,175.16-144.84,25.22-5.52,66.53-4.88,87.68-15.32,25.47-12.56,19.19-48.2,13.84-71.19-7.21-30.98-18.01-40.37-50.71-37.69ZM336.86,845.32v-101c-41.33-88.21-116.18-165.05-210.21-195.79-22.64-7.4-64.52-20.17-75.8,8.77-9.82,25.19-10.55,84.54,4.2,107.84,20.73,32.74,91.92,44.29,127.61,56.39,65.74,22.29,116.74,64.6,151.18,124.82l3.03-1.03ZM412.01,889.67c21.45-1.02,43.06-8.91,62.53-17.68,28.48-12.83,57.44-31.09,83.05-48.95,36.74-25.64,99.82-71.08,105.17-118.83,1.86-16.61-1.47-19.19-17.41-20.38-67.63-5.06-117.12,26.49-161,73.97-27.12,29.35-63.21,82.91-71.99,122-.73,3.24-2.1,6.76-.34,9.87ZM244.51,799.16c-43.99-42.57-107.24-56.83-165.29-69.31-8.26-.09-2.55,10.65-.54,14.64,14.92,29.54,56.73,62.32,83.85,81.15,35.13,24.39,82.1,50.94,124.13,59.87,3.33.71,17.17,4.8,17.2-.14.01-1.9-7.3-15.42-8.84-18.22-13.14-23.87-30.94-49.03-50.52-67.98Z"/></svg>`;
    }
  } else if (kind === "file") {
    const f = (pill as any).file;
    if (f && f.kind === "image" && f.url) {
      iconSpan.innerHTML = `<img src="${f.url}" alt="" class="size-3 rounded object-cover" />`;
    } else if (f && f.kind === "folder") {
      iconSpan.innerHTML = `<img src="${folderIconUrl(f.name, false)}" alt="" class="size-3 object-contain" />`;
    } else {
      iconSpan.innerHTML = `<img src="${fileIconUrl(f?.name ?? '')}" alt="" class="size-3 object-contain" />`;
    }
  } else if (kind === "snippet" || kind === "command") {
    iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
  }

  outer.appendChild(iconSpan);

  // Build inner label span
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  outer.appendChild(labelSpan);

  return outer;
}

// ── Main component ──────────────────────────────────────────────────────────

export const RichInputEditor = forwardRef<RichInputEditorHandle, RichInputEditorProps>(
  function RichInputEditor(
    { placeholder, pills, onPillRemove, onChange, onKeyDown, onCaretChange, className },
    ref,
  ) {
    const divRef = useRef<HTMLDivElement>(null);
    // Track if we're composing (IME) to avoid parsing mid-composition
    const composing = useRef(false);

    // ── Expose handle ────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      insertPill(pill, replaceRange) {
        const el = divRef.current;
        if (!el) return;
        el.focus();

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        // If we have a replaceRange (the trigger token e.g. "$foo"), we need to
        // delete those characters before inserting. We do this by finding the
        // text node and adjusting the range.
        if (replaceRange) {
          // Walk text nodes to find the span of characters to replace
          const textNodes = getTextNodes(el);
          let offset = 0;
          for (const tn of textNodes) {
            const len = tn.textContent?.length ?? 0;
            if (offset + len >= replaceRange.start) {
              const localStart = replaceRange.start - offset;
              const localEnd = Math.min(replaceRange.end - offset, len);
              const deleteRange = document.createRange();
              deleteRange.setStart(tn, localStart);
              deleteRange.setEnd(tn, localEnd);
              sel.removeAllRanges();
              sel.addRange(deleteRange);
              break;
            }
            offset += len;
          }
        }

        // Delete the current selection (trigger token)
        sel.getRangeAt(0).deleteContents();

        // Insert the pill node
        const pillNode = createPillNode(pill);
        sel.getRangeAt(0).insertNode(pillNode);

        // Move cursor after the pill (append a space text node to prevent cursor snapping bugs)
        const parent = pillNode.parentNode;
        if (parent) {
          const textNode = document.createTextNode(" ");
          parent.insertBefore(textNode, pillNode.nextSibling);

          requestAnimationFrame(() => {
            el.focus();
            const newSel = window.getSelection();
            if (newSel) {
              const after = document.createRange();
              after.setStart(textNode, 1);
              after.collapse(true);
              newSel.removeAllRanges();
              newSel.addRange(after);
            }
            notifyChange();
          });
        } else {
          requestAnimationFrame(() => {
            el.focus();
            const newSel = window.getSelection();
            if (newSel) {
              const after = document.createRange();
              after.setStartAfter(pillNode);
              after.collapse(true);
              newSel.removeAllRanges();
              newSel.addRange(after);
            }
            notifyChange();
          });
        }
      },
      focus() {
        divRef.current?.focus();
      },
      getText() {
        return extractText(divRef.current);
      },
      clear() {
        if (divRef.current) {
          divRef.current.innerHTML = "";
          notifyChange();
        }
      },
      get el() {
        return divRef.current;
      },
    }));

    // ── Extract plain text (strips pill labels, keeps surrounding text) ──────
    function extractText(el: HTMLDivElement | null): string {
      if (!el) return "";
      // Walk child nodes: text nodes contribute their content, pill spans
      // contribute their label so the AI sees "$skillname" inline.
      let result = "";
      function walk(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent ?? "";
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.dataset.pillId) {
            result += el.dataset.pillLabel ?? "";
          } else if (el.tagName === "BR") {
            result += "\n";
          } else if (el.tagName === "DIV") {
            // contenteditable wraps new lines in divs
            if (result && !result.endsWith("\n")) result += "\n";
            for (const child of Array.from(el.childNodes)) walk(child);
          } else {
            for (const child of Array.from(el.childNodes)) walk(child);
          }
        }
      }
      for (const child of Array.from(el.childNodes)) walk(child);
      return result;
    }

    // ── Get caret offset in plain text ───────────────────────────────────────
    function getCaretOffset(el: HTMLDivElement): number {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return 0;
      const range = sel.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.endContainer, range.endOffset);
      return preRange.toString().length;
    }

    const updateEmptyAttribute = useCallback(() => {
      const el = divRef.current;
      if (!el) return;
      const isEmpty = el.textContent === "" && el.querySelectorAll("[data-pill-id]").length === 0;
      if (isEmpty) {
        el.setAttribute("data-empty", "true");
      } else {
        el.removeAttribute("data-empty");
      }
    }, []);

    const notifyChange = useCallback(() => {
      const el = divRef.current;
      if (!el) return;
      
      updateEmptyAttribute();
      
      const text = extractText(el);
      onChange(text);

      // Find all pill IDs currently in the DOM
      const pillSpans = el.querySelectorAll("[data-pill-id]");
      const currentPillIds = new Set(Array.from(pillSpans).map((span) => (span as HTMLElement).dataset.pillId));

      // Check if any of the passed pills are no longer in the DOM
      for (const p of pills || []) {
        const id = pillId(p);
        if (!currentPillIds.has(id)) {
          onPillRemove?.(p);
        }
      }

      const caret = getCaretOffset(el);
      onCaretChange?.(text, caret);
    }, [onChange, onCaretChange, pills, onPillRemove, updateEmptyAttribute]);

    // ── Handle input event ───────────────────────────────────────────────────
    const handleInput = useCallback(() => {
      if (composing.current) return;
      notifyChange();
    }, [notifyChange]);

    // ── Handle keydown ────────────────────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Notify caret change
        requestAnimationFrame(() => {
          const el = divRef.current;
          if (!el) return;
          const text = extractText(el);
          const caret = getCaretOffset(el);
          onCaretChange?.(text, caret);
        });

        // Let parent handle e.g. Enter, Escape, Arrow keys for picker
        onKeyDown?.(e);
      },
      [onKeyDown, onCaretChange],
    );

    // ── Handle click/select ──────────────────────────────────────────────────
    const handleSelectionChange = useCallback(() => {
      const el = divRef.current;
      if (!el || !el.contains(document.activeElement) && el !== document.activeElement) return;
      const text = extractText(el);
      const caret = getCaretOffset(el);
      onCaretChange?.(text, caret);
    }, [onCaretChange]);

    useEffect(() => {
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => document.removeEventListener("selectionchange", handleSelectionChange);
    }, [handleSelectionChange]);

    // ── Prevent paste of HTML, only allow plain text ─────────────────────────
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    }, []);

    // ── Handle drop ──────────────────────────────────────────────────────────
    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      if (text) document.execCommand("insertText", false, text);
    }, []);

    useEffect(() => {
      updateEmptyAttribute();
    }, [updateEmptyAttribute]);

    const handleCompositionStart = useCallback(() => { composing.current = true; }, []);
    const handleCompositionEnd = useCallback(() => {
      composing.current = false;
      notifyChange();
    }, [notifyChange]);

    return (
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        data-rich-input
        data-empty="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        spellCheck={false}
        className={cn(
          "min-h-[44px] max-h-40 overflow-y-auto flex-1 outline-none text-[13px] leading-relaxed whitespace-pre-wrap break-words",
          className,
        )}
      />
    );
  },
);

// ── Pill chips rendered by React (for pills passed as props) ──────────────

/** Displays a pill inline as a React component. Used when rendering existing pills. */
export function InlinePill({
  pill,
  onRemove,
}: {
  pill: PillData;
  onRemove: () => void;
}) {
  const label = pillLabel(pill);
  const classes = pillClasses(pill.kind as PillKind);
  return (
    <span
      contentEditable={false}
      className={cn(
        "group inline-flex items-center gap-0.5 text-[12px] font-medium select-none mx-0.5 align-baseline",
        classes,
      )}
    >
      <PillIcon pill={pill} />
      <span>{label}</span>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 opacity-40 hover:opacity-100 transition-opacity"
        aria-label={`Remove ${label}`}
      >
        <CloseCircle variant="Linear" size={10} color="currentColor" />
      </button>
    </span>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────────

function getTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    // Skip text inside pill spans
    let parent = node.parentElement;
    let inPill = false;
    while (parent && parent !== root) {
      if (parent.dataset.pillId) { inPill = true; break; }
      parent = parent.parentElement;
    }
    if (!inPill) nodes.push(node as Text);
  }
  return nodes;
}
