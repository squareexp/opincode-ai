import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useChatStore } from "../store/chatStore";
import { ArrowDown2, ArrowUp2, Copy } from "iconsax-react";
import { toast } from "sonner";

export function AgentErrorFloating() {
  const error = useChatStore((s) => s.agentMeta.error);
  const patchAgentMeta = useChatStore((s) => s.patchAgentMeta);
  const [expanded, setExpanded] = useState(false);
  const [isNotchHovered, setIsNotchHovered] = useState(false);
  const [isCountdownHovered, setIsCountdownHovered] = useState(false);
  
  // Total countdown duration in seconds
  const DURATION = 10;
  const [timeLeft, setTimeLeft] = useState(DURATION);

  const handleDismiss = () => {
    patchAgentMeta({ error: null, status: "idle" });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(error || "");
    toast.success("Error copied to clipboard");
  };

  // Reset timer whenever a new error appears
  useEffect(() => {
    if (error) {
      setTimeLeft(DURATION);
    }
  }, [error]);

  // Handle auto-dismissal when timeLeft reaches 0
  useEffect(() => {
    if (timeLeft <= 0) {
      handleDismiss();
    }
  }, [timeLeft]);

  // Handle countdown logic
  useEffect(() => {
    if (!error) return;

    const timer = setInterval(() => {
      // Pause countdown if user hovers over the notch or if it's expanded
      if (!isNotchHovered && !expanded) {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [error, isNotchHovered, expanded]);

  if (!error) return null;

  // SVG progress circle configuration
  const radius = 7.5;
  const strokeWidth = 1.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / DURATION) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: "spring", stiffness: 350, damping: 26 }}
      layout
      onMouseEnter={() => setIsNotchHovered(true)}
      onMouseLeave={() => setIsNotchHovered(false)}
      className={cn(
        "fixed z-50 flex flex-col gap-2 border border-border/70",
        "bg-gradient-to-r from-card/85 to-card/75 backdrop-blur-md",
        "shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.36)]",
        "ring-1 ring-black/5 dark:ring-white/5 select-none transition-colors",
        expanded ? "rounded-2xl p-3" : "rounded-full px-3.5 py-1.5"
      )}
      style={{
        bottom: "80px",
        right: "24px",
        width: expanded ? "320px" : "210px",
      }}
    >
      {/* Header / Notch Row */}
      <div className="flex items-center gap-2">
        {/* Circled Countdown / Morphing Hover Dismiss Button */}
        <button
          type="button"
          onMouseEnter={() => setIsCountdownHovered(true)}
          onMouseLeave={() => setIsCountdownHovered(false)}
          onClick={handleDismiss}
          className={cn(
            "relative flex items-center justify-center size-6 rounded-full shrink-0 transition-colors",
            "hover:bg-destructive/10 text-destructive cursor-pointer border border-transparent focus:outline-none focus:ring-1 focus:ring-destructive/30"
          )}
          title="Dismiss error"
        >
          <AnimatePresence mode="wait">
            {isCountdownHovered ? (
              <motion.div
                key="close-icon"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center text-destructive"
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
              </motion.div>
            ) : (
              <motion.div
                key="countdown"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="relative flex items-center justify-center size-[18px]"
              >
                <svg className="absolute inset-0 size-[18px] -rotate-90">
                  <circle
                    cx="9"
                    cy="9"
                    r={radius}
                    className="stroke-muted dark:stroke-border/40 fill-none"
                    strokeWidth={strokeWidth}
                  />
                  <circle
                    cx="9"
                    cy="9"
                    r={radius}
                    className="stroke-destructive fill-none transition-all duration-1000 ease-linear"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[7.5px] font-mono font-semibold text-destructive absolute leading-none">
                  {timeLeft}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <span className="truncate text-[11.5px] font-semibold tracking-tight text-destructive flex-1">
          {expanded ? "Something went wrong" : "Error occurred"}
        </span>
        
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? <ArrowUp2 size={12} variant="Bold" /> : <ArrowDown2 size={12} variant="Bold" />}
          </button>
        </div>
      </div>
      
      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-2 rounded-lg bg-muted/40 border border-border/40 p-2.5">
              <div className="max-h-[160px] overflow-y-auto text-[11px] font-mono leading-normal text-muted-foreground select-text break-words pr-1 custom-scrollbar">
                {error}
              </div>
              <div className="flex justify-end gap-1.5 mt-1 border-t border-border/40 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded bg-muted hover:bg-accent px-2 py-1 text-[10px] font-semibold text-foreground transition-colors cursor-pointer"
                >
                  <Copy size={10} />
                  Copy error
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
