import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function CyclePicker({ bookId, cycle }: { bookId: string; cycle: string | null }) {
  const books = useFolioStore((state) => state.books);
  const updateBook = useFolioStore((state) => state.updateBook);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cycles = [...new Set(books.map((item) => item.cycle).filter((item): item is string => Boolean(item)))].sort(
    (a, b) => a.localeCompare(b, "ru"),
  );
  const needle = query.trim().toLowerCase();
  const shown = needle ? cycles.filter((item) => item.toLowerCase().includes(needle)) : cycles;
  const canCreate = needle.length > 0 && !cycles.some((item) => item.toLowerCase() === needle);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
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

  function assign(next: string | null) {
    updateBook(bookId, { cycle: next });
    setQuery("");
    setOpen(false);
  }

  function create() {
    const name = query.trim();
    if (!name) return;
    const existing = cycles.find((item) => item.toLowerCase() === name.toLowerCase());
    assign(existing ?? name);
  }

  return (
    <div ref={root} className="relative mt-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="m-0 block max-w-full truncate p-0 text-left text-sm leading-none text-muted"
      >
        <span className="truncate">{cycle ?? "Цикл"}</span>
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+0.25rem)] left-0 z-30 w-56 bg-window p-1.5 text-ink shadow-[var(--shadow-window)]">
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (canCreate) create();
                else if (shown[0]) assign(shown[0]);
              }
            }}
            placeholder="Найти или создать"
            aria-label="Цикл"
            className="folio-control h-8 w-full text-xs"
          />
          <ul role="listbox" className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {canCreate ? (
              <li>
                <button
                  type="button"
                  onClick={create}
                  className="flex h-8 w-full items-center gap-1.5 px-2 text-left text-xs text-ink hover:bg-ink/6"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">Создать «{query.trim()}»</span>
                </button>
              </li>
            ) : null}
            {shown.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  role="option"
                  aria-selected={cycle === item}
                  onClick={() => assign(item)}
                  className="flex h-8 w-full items-center gap-1.5 px-2 text-left text-xs hover:bg-ink/6"
                >
                  <Check className={cn("size-3.5 shrink-0", cycle === item ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{item}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && !canCreate ? (
              <li className="px-2 py-2 text-xs text-muted">Циклов пока нет.</li>
            ) : null}
          </ul>
          {cycle ? (
            <button
              type="button"
              onClick={() => assign(null)}
              className="mt-1 flex h-8 w-full items-center px-2 text-left text-xs text-muted hover:bg-ink/6"
            >
              Убрать из цикла
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
