import { useCallback, useEffect, useState } from "react";

import { cn } from "../lib/utils";

/**
 * Minimize, maximize and close for Linux desktop builds.
 *
 * Windows gets these buttons from `titleBarOverlay` and macOS from its traffic
 * lights, so on those platforms the app only reserves the space the system
 * paints into. Electron paints nothing on Linux, which left a frameless window
 * with no way to minimize, zoom or close it — these buttons fill that gap and
 * render nowhere else.
 */
export function WindowControls({ className }: { readonly className?: string }) {
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  const controlWindow = bridge?.controlWindow;
  const getMaximized = bridge?.getWindowMaximizedState;
  const isLinuxDesktop =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("linux") &&
    typeof controlWindow === "function";

  const [isMaximized, setIsMaximized] = useState(() =>
    typeof getMaximized === "function" ? getMaximized() : false,
  );

  // The window can also be zoomed from the window manager, so the state is
  // re-read whenever the window resizes rather than trusted from the last
  // click.
  useEffect(() => {
    if (!isLinuxDesktop || typeof getMaximized !== "function") return;
    const sync = () => setIsMaximized(getMaximized());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [isLinuxDesktop, getMaximized]);

  const act = useCallback(
    (action: "minimize" | "toggle-maximize" | "close") => () => {
      void controlWindow?.(action);
    },
    [controlWindow],
  );

  if (!isLinuxDesktop) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-[var(--workspace-controls-top)] right-2 z-[100] flex h-[var(--workspace-topbar-height)] items-center gap-0.5 [-webkit-app-region:no-drag]",
        className,
      )}
    >
      <WindowControlButton label="Minimize" onClick={act("minimize")}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1" />
        </svg>
      </WindowControlButton>
      <WindowControlButton
        label={isMaximized ? "Restore" : "Maximize"}
        onClick={act("toggle-maximize")}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M3 1h6v6H7M1 3h6v6H1z" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <rect
              x="1.5"
              y="1.5"
              width="7"
              height="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        )}
      </WindowControlButton>
      <WindowControlButton label="Close" onClick={act("close")} danger>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1" />
        </svg>
      </WindowControlButton>
    </div>
  );
}

function WindowControlButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly danger?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        danger
          ? "hover:bg-destructive hover:text-destructive-foreground"
          : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}
