/**
 * UnifiedPicker - One popover component used for all three trigger modes:
 *   $ → skills      (SkillIcon leading)
 *   @ → files       (file-type icon leading)
 *   # → snippets / commands
 *
 * All modes share the same container shape, row layout, and active-state
 * style as the current SkillPicker.
 */

import { HugeiconsIcon } from "@hugeicons/react";
import { HashtagIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { fileIconUrl, folderIconUrl } from "@/modules/explorer/lib/iconResolver";
import { SkillLeafIcon } from "@/modules/ai/lib/icons";
import type { ResolvedSkill } from "@/modules/ai/lib/skills";
import type { SlashCommandMeta } from "@/modules/ai/lib/slashCommands";
import type { Snippet } from "@/modules/ai/lib/snippets";
import { useEffect, useRef } from "react";

// ── Re-export PickerItem so AiInputBar doesn't need to change its import ──
export type PickerItem =
  | { kind: "snippet"; snippet: Snippet }
  | { kind: "command"; command: SlashCommandMeta };

// ── Shared container ───────────────────────────────────────────────────────

function PickerShell({
  label,
  empty,
  emptyLabel,
  children,
}: {
  label: string;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <PopoverContent
      side="top"
      align="start"
      sideOffset={6}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      className="w-72 overflow-hidden rounded-3xl border border-border/60 bg-popover/50 p-3 shadow-xl backdrop-blur-xl"
    >
      {empty ? (
        <div className="px-1 py-1 text-[11px] text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {label}
          </div>
          <hr className="my-2 border-border/30" />
          {children}
        </div>
      )}
    </PopoverContent>
  );
}

// ── Shared row ─────────────────────────────────────────────────────────────

function PickerRow({
  active,
  onClick,
  onHover,
  icon,
  primary,
  secondary,
  tertiary,
  noBgBorder,
}: {
  active: boolean;
  onClick: () => void;
  onHover: () => void;
  icon: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  tertiary?: React.ReactNode;
  noBgBorder?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "flex w-full rounded-xl items-center gap-1  px-2 py-1.5 text-left text-[11px] transition-colors",
        noBgBorder
          ? ""
          : active
            ? "bg-accent border border-foreground/15"
            : "hover:bg-accent/60",
      )}
    >
      {/* Mand: !!! Leading icon - fixed 16×16 slot */}
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>

      {/* Text column */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5 leading-tight">
          <span className="truncate font-mono text-[10px] text-foreground/80">
            {primary}
          </span>
          {secondary && (
            <span className="truncate text-[10px] text-muted-foreground">
              {secondary}
            </span>
          )}
        </span>
        {tertiary && (
          <span className="line-clamp-1 text-[10px] text-muted-foreground">
            {tertiary}
          </span>
        )}
      </span>
    </button>
  );
}

// ── SKILL PICKER ───────────────────────────────────────────────────────────

type SkillPickerProps = {
  skills: readonly ResolvedSkill[];
  activeIndex: number;
  onPick: (skill: ResolvedSkill) => void;
  onHover: (index: number) => void;
};

export function SkillPickerContent({ skills, activeIndex, onPick, onHover }: SkillPickerProps) {
  return (
    <PickerShell label="Skills" empty={skills.length === 0} emptyLabel="No skills found">
      <ul>
        {skills.map((s, i) => {
          const isScript = ["sh", "bash", "zsh", "py", "js"].includes(s.ext.toLowerCase());
          const active = i === activeIndex;
          return (
            <li key={`skill-${s.name}`}>
              <PickerRow
                active={active}
                onClick={() => onPick(s)}
                onHover={() => onHover(i)}
                noBgBorder={true}
                icon={
                  isScript ? (
                    <HugeiconsIcon
                      icon={SparklesIcon}
                      size={13}
                      strokeWidth={1.75}
                      className={cn(active ? "text-white " : "text-white ")}
                    />
                  ) : (
                    <SkillLeafIcon
                      color="currentColor"
                      className={cn(
                        "h-3 w-[9.2px]",
                        active ? "text-white" : "text-white/32 ",
                      )}
                    />
                  )
                }
                primary={
                  <span
                    className={cn(
                      "capitalize",
                      active
                        ? "text-white font-bold"
                        : "text-gray-600/60  dark:text-white/50 font-medium ",
                    )}
                  >
                    {s.name}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
    </PickerShell>
  );
}

// ── FILE PICKER ────────────────────────────────────────────────────────────

type FilePickerProps = {
  files: readonly string[];
  activeIndex: number;
  indexing: boolean;
  truncated: boolean;
  hasWorkspace: boolean;
  onPick: (file: string) => void;
  onHover: (index: number) => void;
};

export function FilePickerContent({
  files,
  activeIndex,
  indexing,
  truncated,
  hasWorkspace,
  onPick,
  onHover,
}: FilePickerProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const isEmpty = !hasWorkspace || (files.length === 0 && !indexing);
  const emptyLabel = !hasWorkspace
    ? "No workspace open"
    : "No matching files";

  return (
    <PickerShell label="Workspace files" empty={isEmpty} emptyLabel={emptyLabel}>
      <>
        {indexing && files.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted-foreground">
            <Spinner className="size-3" />
            <span>Indexing workspace…</span>
          </div>
        ) : (
          <ul>
            {files.map((path, idx) => {
              const isFolder = path.endsWith("/");
              const cleanPath = isFolder ? path.slice(0, -1) : path;
              const slash = cleanPath.lastIndexOf("/");
              const name = slash === -1 ? cleanPath : cleanPath.slice(slash + 1);
              const dir  = slash === -1 ? "" : cleanPath.slice(0, slash);
              const active = idx === activeIndex;
              return (
                <li key={path}>
                  <PickerRow
                    active={active}
                    onClick={() => onPick(path)}
                    onHover={() => onHover(idx)}
                    noBgBorder={true}
                    icon={
                      <img
                        src={isFolder ? folderIconUrl(name, false) : fileIconUrl(name)}
                        alt=""
                        className={cn(
                          "size-4 object-contain transition-all grayscale",
                          active ? "brightness-0 invert opacity-100" : "opacity-40"
                        )}
                      />
                    }
                    primary={
                      <span
                        className={cn(
                          active
                            ? "text-white font-bold"
                            : "text-gray-600/60 dark:text-white/50 font-medium"
                        )}
                      >
                        @{name}{isFolder && "/"}
                      </span>
                    }
                    secondary={
                      dir ? (
                        <span
                          className={cn(
                            active
                              ? "text-white/60 font-medium"
                              : "text-gray-600/40 dark:text-white/30 font-normal"
                          )}
                        >
                          {dir}
                        </span>
                      ) : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {truncated && (
          <p className="mt-2 px-1 text-[10px] text-muted-foreground">
            Workspace is large - refine your query to narrow results.
          </p>
        )}
      </>
    </PickerShell>
  );
}

// ── SNIPPET / COMMAND PICKER ───────────────────────────────────────────────

type SnippetPickerProps = {
  items: readonly PickerItem[];
  activeIndex: number;
  onPick: (item: PickerItem) => void;
  onHover: (index: number) => void;
};

export function SnippetPickerContent({ items, activeIndex, onPick, onHover }: SnippetPickerProps) {
  const commands = items.filter((it) => it.kind === "command");
  const snippets = items.filter((it) => it.kind === "snippet");
  let cursor = -1;

  const isEmpty = items.length === 0;

  return (
    <PickerShell
      label={commands.length > 0 && snippets.length === 0 ? "Commands" : snippets.length > 0 && commands.length === 0 ? "Snippets" : "Commands & Snippets"}
      empty={isEmpty}
      emptyLabel="No matches. Add snippets in Settings → Agents."
    >
      <ul>
        {/* Commands */}
        {commands.map((it) => {
          cursor += 1;
          const i = cursor;
          if (it.kind !== "command") return null;
          const c = it.command;
          return (
            <li key={`cmd-${c.name}`}>
              <PickerRow
                active={i === activeIndex}
                onClick={() => onPick(it)}
                onHover={() => onHover(i)}
                icon={
                  <HugeiconsIcon
                    icon={c.icon}
                    size={13}
                    strokeWidth={1.75}
                    className="text-emerald-400"
                  />
                }
                primary={<span className="text-emerald-400 dark:text-emerald-300">#{c.name}</span>}
                secondary={c.label}
              />
            </li>
          );
        })}

        {/* Snippets */}
        {snippets.map((it) => {
          cursor += 1;
          const i = cursor;
          if (it.kind !== "snippet") return null;
          const s = it.snippet;
          return (
            <li key={`sn-${s.id}`}>
              <PickerRow
                active={i === activeIndex}
                onClick={() => onPick(it)}
                onHover={() => onHover(i)}
                icon={
                  <HugeiconsIcon
                    icon={HashtagIcon}
                    size={13}
                    strokeWidth={1.75}
                    className="text-emerald-400"
                  />
                }
                primary={<span className="text-emerald-400 dark:text-emerald-300">#{s.handle}</span>}
                secondary={s.name}
                tertiary={s.description || undefined}
              />
            </li>
          );
        })}
      </ul>
    </PickerShell>
  );
}
