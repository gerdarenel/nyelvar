import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { mailBody, mailCopy } from "@/lib/letter";
import { useFolioStore } from "@/lib/store";

export function Mailbox() {
  const inbox = useFolioStore((state) => state.inbox);
  const syncInbox = useFolioStore((state) => state.syncInbox);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    syncInbox();
  }, [syncInbox]);

  const letters = [...inbox].reverse();
  const selected = letters.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="relative flex h-full min-h-0">
      <aside className="hidden w-36 shrink-0 flex-col border-r border-ink/15 bg-paper-deep/45 sm:flex">
        <p className="px-3 pt-3 pb-2 text-xs font-medium tracking-wide text-muted">Ящики</p>
        <p className="bg-ink/8 px-3 py-2 text-sm">
          Входящие
          <span className="ml-1 text-xs text-muted tabular-nums">{letters.length}</span>
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-ink/15 px-3 py-2 sm:hidden">
          <p className="text-sm">
            Входящие
            <span className="ml-1 text-xs text-muted tabular-nums">{letters.length}</span>
          </p>
        </div>
        <ul className="folio-scroll min-h-0 flex-1 overflow-y-auto">
          {letters.length === 0 ? (
            <li className="px-3 py-6 text-sm text-muted">Ящик пуст.</li>
          ) : (
            letters.map((item) => {
              const copy = mailCopy(item.id);
              return (
                <li key={item.id} className="border-b border-ink/10">
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_auto] items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-ink/6"
                  >
                    <span className="truncate">Нельвар</span>
                    <span className="truncate">{copy.subject}</span>
                    <span className="text-xs text-muted tabular-nums">{formatDay(item.arrivedAt)}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {selected ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-ink/45 p-4"
          onClick={() => setSelectedId(null)}
        >
          <article
            className="folio-scroll relative max-h-full w-full max-w-md overflow-y-auto border border-ink/15 bg-window px-4 py-4 shadow-[var(--shadow-border)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Закрыть письмо"
              onClick={() => setSelectedId(null)}
              className="absolute top-2 right-2 flex size-8 items-center justify-center text-muted hover:bg-ink/8 hover:text-ink"
            >
              <X className="size-4" />
            </button>
            <p className="pr-8 text-xs text-muted">От: Нельвар · {formatDay(selected.arrivedAt)}</p>
            <h3 className="font-display mt-1 text-xl font-semibold tracking-tight">
              {mailCopy(selected.id).subject}
            </h3>
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">{mailBody(selected.id)}</p>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function formatDay(value: string) {
  try {
    return format(parseISO(value), "d MMM yyyy", { locale: ru });
  } catch {
    return value;
  }
}
