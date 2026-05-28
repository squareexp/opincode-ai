import { Stop, CloseCircle, Minus, Maximize3 } from 'iconsax-react';

import { USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";

import { cn } from "@/lib/utils";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

type Props = {
  /** Render only the close button (used by the settings window). */
  closeOnly?: boolean;
};

export function WindowControls({ closeOnly = false }: Props) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!USE_CUSTOM_WINDOW_CONTROLS || closeOnly) return;
    const w = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void w.isMaximized().then(setMaximized);
    void w
      .onResized(() => {
        void w.isMaximized().then(setMaximized);
      })
      .then((un) => {
        unlisten = un;
      });
    return () => unlisten?.();
  }, [closeOnly]);

  if (!USE_CUSTOM_WINDOW_CONTROLS) return null;

  const w = getCurrentWindow();

  return (
    <div className="flex h-full shrink-0 items-center gap-0.5 pr-1">
      {!closeOnly && (
        <>
          <CtlButton ariaLabel="Minimize" onClick={() => void w.minimize()}>
            <Minus variant="Linear" size={12} color="currentColor" />
          </CtlButton>
          <CtlButton
            ariaLabel={maximized ? "Restore" : "Maximize"}
            onClick={() => void w.toggleMaximize()}
          >
            {maximized ? (
              <Maximize3 variant="Linear" size={12} color="currentColor" />
            ) : (
              <Stop variant="Linear" size={12} color="currentColor" />
            )}
          </CtlButton>
        </>
      )}
      <CtlButton ariaLabel="Close" onClick={() => void w.close()} danger>
        <CloseCircle variant="Linear" size={14} color="currentColor" />
      </CtlButton>
    </div>
  );
}

function CtlButton({
  ariaLabel,
  onClick,
  children,
  danger,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-full text-muted-foreground transition-colors",
        danger
          ? "hover:bg-destructive/15 hover:text-destructive"
          : "hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
