import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useChatStore } from "../store/chatStore";

export function AgentStatusFloating() {
  const meta = useChatStore((s) => s.agentMeta);
  const label = meta.step ?? "Thinking…";
  
  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: "spring", stiffness: 350, damping: 26 }}
      className={cn(
        "fixed z-50 flex items-center gap-2 rounded-full border border-border/70",
        "bg-linear-to-r from-card/85 to-card/75 backdrop-blur-md px-3.5 py-1.5",
        "shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.36)]",
        "ring-1 ring-black/5 dark:ring-white/5 select-none",
        "cursor-grab active:cursor-grabbing hover:border-primary/45 transition-colors"
      )}
      style={{
        bottom: "100px",
        left: "0px",
        right: "0px",
        margin: "0 auto",
        width: "fit-content",
        touchAction: "none"
      }}
    >
      {/* Subtle drag handle */}
      <div className="flex flex-col gap-0.5 shrink-0 opacity-40 hover:opacity-85 mr-4">
        <span className="w-1.5 h-0.5 rounded-full bg-foreground" />
        <span className="w-1.5 h-0.5 rounded-full bg-foreground" />
        <span className="w-1.5 h-0.5 rounded-full bg-foreground" />
      </div>
      
      <Spinner variant={1} className="mr-3 ml-0" />
      <span className="max-w-55 truncate text-[11.5px] font-semibold tracking-tight text-foreground/90">
        {label}
      </span>
    </motion.div>
  );
}

