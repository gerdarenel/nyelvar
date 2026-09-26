import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from "react";
import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type WindowId } from "@/lib/folio";
import { useFolioStore } from "@/lib/store";

const MIN_W = 360;
const MIN_H = 240;
const TASKBAR = 48;

type Corner = "nw" | "ne" | "sw" | "se";

export function AppWindow({
  id,
  title,
  children,
}: {
  id: WindowId;
  title: string;
  children: ReactNode;
}) {
  const windows = useFolioStore((state) => state.windows);
  const windowState = windows[id];
  const closeWindow = useFolioStore((state) => state.closeWindow);
  const focusWindow = useFolioStore((state) => state.focusWindow);
  const moveWindow = useFolioStore((state) => state.moveWindow);
  const resizeWindow = useFolioStore((state) => state.resizeWindow);
  const toggleMinimized = useFolioStore((state) => state.toggleMinimized);
  const toggleMaximized = useFolioStore((state) => state.toggleMaximized);
  const drag = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const resize = useRef<{
    corner: Corner;
    ox: number;
    oy: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  if (!windowState.open) return null;

  function onTitleDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    focusWindow(id);
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (windowState.maximized) return;
    drag.current = {
      ox: event.clientX,
      oy: event.clientY,
      sx: windowState.x,
      sy: windowState.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onTitleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.ox;
    const dy = event.clientY - drag.current.oy;
    const x = Math.min(window.innerWidth - 80, Math.max(-40, drag.current.sx + dx));
    const y = Math.min(window.innerHeight - TASKBAR - 24, Math.max(8, drag.current.sy + dy));
    moveWindow(id, x, y);
  }

  function onTitleUp(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onResizeDown(corner: Corner, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    focusWindow(id);
    resize.current = {
      corner,
      ox: event.clientX,
      oy: event.clientY,
      x: windowState.x,
      y: windowState.y,
      w: windowState.w,
      h: windowState.h,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resize.current) return;
    const dx = event.clientX - resize.current.ox;
    const dy = event.clientY - resize.current.oy;
    let { x, y, w, h } = resize.current;
    const corner = resize.current.corner;
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - TASKBAR - 16;

    if (corner.includes("e")) w = Math.min(maxW, Math.max(MIN_W, resize.current.w + dx));
    if (corner.includes("s")) h = Math.min(maxH, Math.max(MIN_H, resize.current.h + dy));
    if (corner.includes("w")) {
      w = Math.min(maxW, Math.max(MIN_W, resize.current.w - dx));
      x = resize.current.x + (resize.current.w - w);
    }
    if (corner.includes("n")) {
      h = Math.min(maxH, Math.max(MIN_H, resize.current.h - dy));
      y = resize.current.y + (resize.current.h - h);
    }
    resizeWindow(id, { x, y, w, h });
  }

  function onResizeUp(event: ReactPointerEvent<HTMLDivElement>) {
    resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const maximized = windowState.maximized && !windowState.minimized;
  const stack = Math.max(
    1,
    Object.values(windows)
      .filter((item) => item.open)
      .sort((a, b) => a.z - b.z)
      .findIndex((item) => item.z === windowState.z) + 1,
  );
  const style = maximized
    ? {
        zIndex: 20 + stack,
        left: 8,
        top: 8,
        width: "calc(100vw - 16px)",
        height: `calc(100dvh - ${TASKBAR + 16}px)`,
      }
    : {
        zIndex: 20 + stack,
        left: windowState.x,
        top: windowState.y,
        width: windowState.w,
        height: windowState.h,
        transformOrigin: "center bottom",
        transform: windowState.minimized ? "translateY(28vh) scale(0.15)" : "none",
      };

  const showHandles = !windowState.minimized && !windowState.maximized;

  return (
    <section
      role="dialog"
      aria-label={title}
      onPointerDown={() => focusWindow(id)}
      className={cn(
        "fixed flex min-h-0 flex-col overflow-hidden bg-window text-ink shadow-[var(--shadow-window)]",
        "transition-[transform,opacity] duration-300 ease-out",
        windowState.minimized && "pointer-events-none opacity-0",
        "max-md:!inset-x-0 max-md:!top-0 max-md:!bottom-12 max-md:!h-auto max-md:!w-auto max-md:rounded-none",
        "md:rounded-xl",
      )}
      style={style}
    >
      <div
        className="relative flex h-11 shrink-0 items-center border-b border-ink/10 bg-paper-deep px-2 touch-none md:cursor-grab md:active:cursor-grabbing"
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleUp}
      >
        <h2 className="min-w-0 flex-1 truncate px-2 text-sm font-medium tracking-wide">{title}</h2>
        <div className="flex shrink-0 items-center">
          <ChromeButton
            className="hidden md:flex"
            label={`Свернуть «${title}»`}
            onClick={() => toggleMinimized(id)}
          >
            <Minus className="size-3.5" strokeWidth={2.2} />
          </ChromeButton>
          <ChromeButton
            className="hidden md:flex"
            label={windowState.maximized ? `Восстановить «${title}»` : `На весь экран «${title}»`}
            onClick={() => toggleMaximized(id)}
          >
            <Square className="size-3" strokeWidth={2.2} />
          </ChromeButton>
          <ChromeButton label={`Закрыть «${title}»`} onClick={() => closeWindow(id)}>
            <X className="size-3.5" strokeWidth={2.2} />
          </ChromeButton>
        </div>
      </div>
      <div
        className={cn(
          "relative min-h-0 flex-1 bg-window",
          windowState.minimized && "hidden",
        )}
      >
        <div className="paper-grain pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply" />
        <div className="relative flex h-full min-h-0 flex-col">{children}</div>
      </div>
      {showHandles
        ? (["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              role="separator"
              aria-label={`Изменить размер «${title}»`}
              onPointerDown={(event) => onResizeDown(corner, event)}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              onPointerCancel={onResizeUp}
              className={cn(
                "absolute z-20 hidden size-5 touch-none md:block",
                corner === "nw" && "top-0 left-0 cursor-nwse-resize",
                corner === "ne" && "top-0 right-0 cursor-nesw-resize",
                corner === "sw" && "bottom-0 left-0 cursor-nesw-resize",
                corner === "se" && "bottom-0 right-0 cursor-nwse-resize",
              )}
            />
          ))
        : null}
    </section>
  );
}

function ChromeButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-sm text-ink/70 transition-colors duration-(--motion-quick) hover:bg-ink/8 hover:text-ink after:absolute after:inset-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2",
        className,
      )}
    >
      {children}
    </button>
  );
}
