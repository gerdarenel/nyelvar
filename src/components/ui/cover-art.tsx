import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CoverArt({
  src,
  label,
  className,
  onUpload,
}: {
  src: string | null;
  label: string;
  className?: string;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const press = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function pickFile() {
    fileRef.current?.click();
  }

  function clearPress() {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-cover-add]")) return;
    const id = event.pointerId;
    press.current = {
      id,
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        press.current = null;
        pickFile();
      }, 520),
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!press.current || press.current.id !== event.pointerId) return;
    const dx = event.clientX - press.current.x;
    const dy = event.clientY - press.current.y;
    if (dx * dx + dy * dy > 64) clearPress();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!press.current || press.current.id !== event.pointerId) return;
    clearPress();
    if ((event.target as HTMLElement).closest("[data-cover-add]")) return;
    if (src) setLightbox(true);
    else pickFile();
  }

  return (
    <>
      <div
        className={cn(
          "folio-cover group relative min-h-40 shrink-0 self-stretch overflow-hidden rounded-md bg-paper-deep shadow-[var(--shadow-border)]",
          className,
        )}
        role="button"
        tabIndex={0}
        aria-label={src ? `Обложка «${label}»` : `Добавить обложку «${label}»`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (src) setLightbox(true);
            else pickFile();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={clearPress}
      >
        <div className="absolute inset-0">
          {src ? (
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-muted">
              <ImagePlus className="size-4" />
              <span className="text-xs leading-tight">Обложка</span>
            </span>
          )}
          <button
            type="button"
            data-cover-add
            aria-label={src ? `Заменить обложку «${label}»` : `Добавить обложку «${label}»`}
            onClick={(event) => {
              event.stopPropagation();
              pickFile();
            }}
            className="folio-cover-add absolute top-1 right-1 size-8 items-center justify-center rounded-sm bg-ink/75 text-paper"
          >
            <ImagePlus className="size-3.5" />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
        />
      </div>
      {lightbox && src && typeof document !== "undefined"
        ? createPortal(
            <div
              className="folio-overlay fixed inset-0 flex items-center justify-center bg-ink/70 p-6"
              onClick={() => setLightbox(false)}
            >
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setLightbox(false)}
                className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-sm text-paper hover:bg-paper/10"
              >
                <X className="size-5" />
              </button>
              <img
                src={src}
                alt={label}
                className="max-h-full max-w-full object-contain shadow-[var(--shadow-window)]"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
