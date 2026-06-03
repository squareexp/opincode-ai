import { HugeiconsIcon } from '@hugeicons/react';
import { RoboticIcon } from '@hugeicons/core-free-icons';
import { cn } from "@/lib/utils";

function iconFor(_agent: string): any {
  return RoboticIcon;
}

export function AgentIcon({
  agent,
  size = 15,
  className,
}: {
  agent: string;
  size?: number;
  className?: string;
}) {
  const a = agent.toLowerCase();
  if (a.includes("opincode")) {
    return (
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }
  if (a.includes("claude") || a.includes("anthropic")) {
    return (
      <img
        src="/claude.svg"
        alt="Claude"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (a.includes("gpt") || a.includes("openai") || a.includes("codex")) {
    return (
      <img
        src="/openai.svg"
        alt="OpenAI"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (a.includes("deepseek")) {
    return (
      <img
        src="/deepseek.svg"
        alt="DeepSeek"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (a.includes("ollama")) {
    return (
      <img
        src="/ollama.svg"
        alt="Ollama"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (a.includes("gemini") || a.includes("google")) {
    return (
      <img
        src="/gemin.svg"
        alt="Google"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (a.includes("xiaomi") || a.includes("mimo")) {
    return (
      <img
        src="/xiom.svg"
        alt="Xiaomi"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={iconFor(agent)}
      size={size}
      strokeWidth={1.75}
      className={className}
    />
  );
}
