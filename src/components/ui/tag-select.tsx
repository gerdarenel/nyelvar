import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagSelect<T extends string>({
  value,
  options,
  placeholder,
  onChange,
  allowEmpty = true,
}: {
  value: T | null;
  options: { id: T; label: string }[];
  placeholder: string;
  onChange: (next: T | null) => void;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.id === value);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
        className={cn(
          "flex h-8 max-w-full items-center gap-1 rounded-sm px-2.5 text-xs",
          selected ? "bg-ink text-paper" : "bg-paper-deep/80 text-muted",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+0.25rem)] left-0 z-30 flex min-w-40 flex-col gap-1 rounded-md bg-window p-1.5 shadow-[var(--shadow-window)]"
        >
          {allowEmpty ? (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex h-8 w-full items-center rounded-sm px-2.5 text-left text-xs text-muted hover:bg-ink/6"
              >
                {placeholder}
              </button>
            </li>
          ) : null}
          {options.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === item.id}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 w-full items-center rounded-sm px-2.5 text-left text-xs",
                  value === item.id
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-ink/6",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
