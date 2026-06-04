
import { ArrowDown2, Setting2, TickCircle } from 'iconsax-react';
import { Button } from "@/components/ui/button";

import { AbsoluteIcon, CodeIcon, PaintBrush04Icon, PencilEdit02Icon, ShieldUserIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { openSettingsWindow } from "@/modules/settings/openSettingsWindow";
import type { AgentIconId } from "../lib/agents";
import { useAgentsStore } from "../store/agentsStore";
import { AgentIcon } from "@/modules/agents/lib/agentIcon";

const ICONS: Record<AgentIconId, typeof CodeIcon> = {
  coder: CodeIcon,
  architect: AbsoluteIcon,
  reviewer: PencilEdit02Icon,
  security: ShieldUserIcon,
  designer: PaintBrush04Icon,
  spark: SparklesIcon,
};

export function AgentSwitcher({ isMiniWindow }: { isMiniWindow?: boolean }) {
  // Subscribe to customAgents + activeId so the trigger updates live.
  const customAgents = useAgentsStore((s) => s.customAgents);
  const activeId = useAgentsStore((s) => s.activeId);
  const setActiveId = useAgentsStore((s) => s.setActiveId);

  const list = useAgentsStore.getState().all();
  void customAgents; // keeps the store subscription alive

  const active = list.find((a) => a.id === activeId) ?? list[0];
  const builtIn = list.filter((a) => a.builtIn);
  const custom = list.filter((a) => !a.builtIn);


  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="antialiased" asChild>
        <Button
          size="xs"
          variant="secondary"
          className={cn(
            !isMiniWindow
              ? "flex h-6 items-center   gap-1 rounded-full border border-border/60 bg-card p-4 text-[10.5px] text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
              : "text-xs mr-1",
          )}
          title={`Agent: ${active.name}`}
        >
          <AgentIcon
            agent={active.name}
            size={11}
            showBg={false}
            className="shrink-0"
          />
          <span className="max-w-28 truncate">{active.name}</span>
          <ArrowDown2
            variant="Linear"
            size={10}
            className="opacity-70"
            color="currentColor"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Built-in
        </div>
        {builtIn.map((a) => {
          return (
            <DropdownMenuItem
              key={a.id}
              onSelect={() => setActiveId(a.id)}
              className={cn(
                "flex items-start gap-2 pr-2 text-[12px]",
                a.id === activeId && "bg-accent/40",
              )}
            >
              <AgentIcon agent={a.name} size={14} className="mt-0.5 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{a.name}</span>
                <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
                  {a.description}
                </span>
              </span>
              {a.id === activeId ? (
                <TickCircle
                  variant="Linear"
                  size={12}
                  className="mt-0.5 shrink-0 text-foreground"
                  color="currentColor"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
        {custom.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 pt-1 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Custom
            </div>
            {custom.map((a) => {
              return (
                <DropdownMenuItem
                  key={a.id}
                  onSelect={() => setActiveId(a.id)}
                  className={cn(
                    "flex items-start gap-2 text-[12px]",
                    a.id === activeId && "bg-accent/40",
                  )}
                >
                  <AgentIcon
                    agent={a.name}
                    size={14}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{a.name}</span>
                    {a.description ? (
                      <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
                        {a.description}
                      </span>
                    ) : null}
                  </span>
                  {a.id === activeId ? (
                    <TickCircle
                      variant="Linear"
                      size={12}
                      className="mt-0.5 shrink-0 text-foreground"
                      color="currentColor"
                    />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void openSettingsWindow("agents")}
          className="gap-2 text-[12px] text-muted-foreground"
        >
          <Setting2 variant="Linear" size={12} color="currentColor" />
          Manage agents…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ICONS as AGENT_ICONS };
