import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from "@/lib/utils";

export type AgentStyleInfo = {
  icon: any;
  colorClass: string;
  label: string;
};

export function getAgentStyle(agentName: string): AgentStyleInfo {
  const name = agentName.toLowerCase();
  
  if (name.includes("opin") || name.includes("coder") || name.includes("developer") || name.includes("engineer")) {
    return {
      icon: "/agents/Opin.svg",
      colorClass: "bg-indigo-500/10 text-indigo-500 border-indigo-500/15 dark:bg-indigo-400/10 dark:text-indigo-400 dark:border-indigo-400/15",
      label: "Opin",
    };
  }
  if (name.includes("monkin") || name.includes("architect") || name.includes("planner")) {
    return {
      icon: "/agents/Monkin.svg",
      colorClass: "bg-purple-500/10 text-purple-500 border-purple-500/15 dark:bg-purple-400/10 dark:text-purple-400 dark:border-purple-400/15",
      label: "Monkin",
    };
  }
  if (name.includes("rob") || name.includes("reviewer") || name.includes("audit") || name.includes("review")) {
    return {
      icon: "/agents/Rob.svg",
      colorClass: "bg-amber-500/10 text-amber-500 border-amber-500/15 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/15",
      label: "Rob",
    };
  }
  if (name.includes("supricon") || name.includes("security") || name.includes("guard") || name.includes("vuln")) {
    return {
      icon: "/agents/Supricon.svg",
      colorClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/15 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/15",
      label: "Supricon",
    };
  }
  if (name.includes("diom") || name.includes("designer") || name.includes("ui") || name.includes("ux") || name.includes("style")) {
    return {
      icon: "/agents/Diom.svg",
      colorClass: "bg-rose-500/10 text-rose-500 border-rose-500/15 dark:bg-rose-400/10 dark:text-rose-400 dark:border-rose-400/15",
      label: "Diom",
    };
  }
  if (name.includes("claude") || name.includes("anthropic")) {
    return {
      icon: "claude",
      colorClass: "bg-orange-500/10 text-orange-500 border-orange-500/15 dark:bg-orange-400/10 dark:text-orange-400 dark:border-orange-400/15",
      label: "Claude",
    };
  }
  if (name.includes("openai") || name.includes("gpt") || name.includes("codex")) {
    return {
      icon: "openai",
      colorClass: "bg-green-500/10 text-green-500 border-green-500/15 dark:bg-green-400/10 dark:text-green-400 dark:border-green-400/15",
      label: "OpenAI",
    };
  }
  if (name.includes("deepseek")) {
    return {
      icon: "deepseek",
      colorClass: "bg-cyan-500/10 text-cyan-500 border-cyan-500/15 dark:bg-cyan-400/10 dark:text-cyan-400 dark:border-cyan-400/15",
      label: "DeepSeek",
    };
  }
  if (name.includes("ollama")) {
    return {
      icon: "ollama",
      colorClass: "bg-neutral-500/10 text-neutral-500 border-neutral-500/15 dark:bg-neutral-400/10 dark:text-neutral-400 dark:border-neutral-400/15",
      label: "Ollama",
    };
  }
  if (name.includes("google") || name.includes("gemini")) {
    return {
      icon: "gemini",
      colorClass: "bg-sky-500/10 text-sky-500 border-sky-500/15 dark:bg-sky-400/10 dark:text-sky-400 dark:border-sky-400/15",
      label: "Gemini",
    };
  }
  if (name.includes("xiaomi") || name.includes("mimo")) {
    return {
      icon: "xiaomi",
      colorClass: "bg-slate-500/10 text-slate-500 border-slate-500/15 dark:bg-slate-400/10 dark:text-slate-400 dark:border-slate-400/15",
      label: "Xiaomi",
    };
  }
  // Default fallback
  return {
    icon: "/agents/Opin.svg",
    colorClass: "bg-slate-500/10 text-slate-500 border-slate-500/15 dark:bg-slate-400/10 dark:text-slate-400 dark:border-slate-400/15",
    label: agentName,
  };
}

export function AgentIcon({
  agent,
  size = 15,
  className,
  showBg = false,
}: {
  agent: string;
  size?: number;
  className?: string;
  showBg?: boolean;
}) {
  const styleInfo = getAgentStyle(agent);
  const { icon, colorClass } = styleInfo;

  const renderIcon = () => {
    if (typeof icon === "string" && (icon.startsWith("/") || icon.endsWith(".svg"))) {
      return (
        <img
          src={icon}
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    if (icon === "logo") {
      return (
        <img
          src="/logo.png"
          alt=""
          width={size}
          height={size}
          className=" shrink-0 object-contain"
        />
      );
    }
    if (icon === "claude") {
      return (
        <img
          src="/claude.svg"
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    if (icon === "openai") {
      return (
        <img
          src="/openai.svg"
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    if (icon === "deepseek") {
      return (
        <img
          src="/deepseek.svg"
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    if (icon === "ollama") {
      return (
        <img
          src="/ollama.svg"
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    if (icon === "gemini") {
      return (
        <img
          src="/gemin.svg"
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    if (icon === "xiaomi") {
      return (
        <img
          src="/xiom.svg"
          alt=""
          style={{ width: size, height: size }}
          className="dark:invert shrink-0 object-contain"
        />
      );
    }
    
    // It's a Hugeicons icon component
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        strokeWidth={1.75}
        className="shrink-0"
      />
    );
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border shrink-0 transition-colors",
        showBg ? colorClass : "border-transparent bg-transparent",
        className
      )}
      style={{
        width: showBg ? size + 8 : size,
        height: showBg ? size + 8 : size,
      }}
    >
      {renderIcon()}
    </div>
  );
}
