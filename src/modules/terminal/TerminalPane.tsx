import { useTheme } from "@/modules/theme";
import type { SearchAddon } from "@xterm/addon-search";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTerminalSession } from "./lib/useTerminalSession";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/modules/ai/store/chatStore";

export type TerminalPaneHandle = {
  write: (data: string) => void;
  focus: () => void;
  getBuffer: (maxLines?: number) => string | null;
  getSelection: () => string | null;
};

type Props = {
  /** Stable identifier for this leaf (passed back through callbacks). */
  leafId: number;
  /** Tab containing this pane is on screen. */
  visible: boolean;
  /** This leaf is the active pane within its tab — receives auto-focus. */
  focused?: boolean;
  initialCwd?: string;
  onSearchReady?: (leafId: number, addon: SearchAddon) => void;
  onExit?: (leafId: number, code: number) => void;
  onCwd?: (leafId: number, cwd: string) => void;
};

export const TerminalPane = forwardRef<TerminalPaneHandle, Props>(
  function TerminalPane(
    {
      leafId,
      visible,
      focused = true,
      initialCwd,
      onSearchReady,
      onExit,
      onCwd,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedMode, themeId, customThemes } = useTheme();

    const [failedCommand, setFailedCommand] = useState<{
      command: string;
      exitCode: number;
    } | null>(null);

    const session = useTerminalSession({
      leafId,
      container: containerRef,
      visible,
      focused,
      initialCwd,
      onSearchReady: (a) => onSearchReady?.(leafId, a),
      onExit: (c) => onExit?.(leafId, c),
      onCwd: (c) => onCwd?.(leafId, c),
    });

    useEffect(() => {
      // Defer one frame so CSS-variable token resolution sees the new class.
      const id = requestAnimationFrame(() => session.applyTheme());
      return () => cancelAnimationFrame(id);
    }, [resolvedMode, themeId, customThemes, session]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleCommandFinished = (e: Event) => {
        const customEvent = e as CustomEvent<{ command: string; exitCode: number }>;
        const { command, exitCode } = customEvent.detail;
        if (exitCode !== 0) {
          setFailedCommand({ command, exitCode });
        } else {
          setFailedCommand(null);
        }
      };

      const handleCommandStarted = () => {
        setFailedCommand(null);
      };

      container.addEventListener("opincode:command-finished", handleCommandFinished);
      container.addEventListener("opincode:command-started", handleCommandStarted);

      return () => {
        container.removeEventListener("opincode:command-finished", handleCommandFinished);
        container.removeEventListener("opincode:command-started", handleCommandStarted);
      };
    }, []);

    const handleSmartFix = () => {
      if (!failedCommand) return;
      const buffer = session.getBuffer(100) || "";
      
      const store = useChatStore.getState();
      store.openMini();
      store.focusInput(
        `The terminal command \`${failedCommand.command}\` failed with exit code ${failedCommand.exitCode}.\n\nHere is the terminal output:\n\`\`\`bash\n${buffer}\n\`\`\`\n\nHow do I fix this? Please analyze the error and propose a direct auto-fix.`
      );
      setFailedCommand(null);
    };

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => session.write(data),
        focus: () => session.focus(),
        getBuffer: (max?: number) => session.getBuffer(max),
        getSelection: () => session.getSelection(),
      }),
      [session],
    );

    const SparklesIcon = ({ className }: { className?: string }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
        <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
      </svg>
    );

    return (
      <div
        ref={containerRef}
        className="zoom-exempt relative h-full w-full"
        style={{
          visibility: visible ? "visible" : "hidden",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <AnimatePresence>
          {visible && failedCommand && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className={cn(
                "absolute bottom-4 right-6 z-10 flex items-center gap-1 border border-border/70",
                "bg-gradient-to-r from-card/90 to-card/80 backdrop-blur-md p-1 rounded-full",
                "shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.36)]",
                "ring-1 ring-black/5 dark:ring-white/5 select-none hover:border-destructive/35 transition-colors"
              )}
            >
              <button
                type="button"
                onClick={handleSmartFix}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-destructive",
                  "hover:bg-destructive/10 active:bg-destructive/15 transition-colors cursor-pointer select-none"
                )}
                title="Propose AI smart fix for the failed command"
              >
                <SparklesIcon className="size-3.5 animate-pulse text-destructive shrink-0" />
                <span>Smart Auto-Fix</span>
              </button>
              <div className="w-px h-4 bg-border/60" />
              <button
                type="button"
                onClick={() => setFailedCommand(null)}
                className={cn(
                  "rounded-full p-1.5 text-muted-foreground hover:text-foreground",
                  "hover:bg-accent/40 active:bg-accent/60 transition-colors cursor-pointer shrink-0"
                )}
                title="Dismiss"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
