import { HugeiconsIcon } from '@hugeicons/react';
import type { ProviderId } from "@/modules/ai/config";
import { ComputerIcon } from '@hugeicons/core-free-icons';
import { cn } from "@/lib/utils";

type Props = {
  provider: ProviderId;
  size?: number;
  className?: string;
};

export function ProviderIcon({ provider, size = 14, className }: Props) {
  if (provider === "z.ai") {
    return (
      <img
        src="/zai.svg"
        alt="Z.AI"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "moonshot") {
    return (
      <img
        src="/moonshot.svg"
        alt="Moonshot"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "google") {
    return (
      <img
        src="/gemin.svg"
        alt="Google"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "xiaomi") {
    return (
      <img
        src="/xiom.svg"
        alt="Xiaomi"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "anthropic") {
    return (
      <img
        src="/claude.svg"
        alt="Claude"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "ollama") {
    return (
      <img
        src="/ollama.svg"
        alt="Ollama"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "deepseek") {
    return (
      <img
        src="/deepseek.svg"
        alt="DeepSeek"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  if (provider === "openai") {
    return (
      <img
        src="/openai.svg"
        alt="OpenAI"
        style={{ width: size, height: size }}
        className={cn("dark:invert shrink-0 object-contain", className)}
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={ComputerIcon}
      size={size}
      strokeWidth={1.75}
      className={cn("shrink-0", className)}
    />
  );
}
