import { Plus } from "lucide-react";
import { coverOf, formatWords, getProgress, writerTabOf, type WriterTab } from "@/lib/folio";
import { useFolioStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Library({
  tab,
  onTab,
}: {
  tab: WriterTab;
  onTab: (tab: WriterTab) => void;
}) {
  const books = useFolioStore((state) => state.books);
  const activeBookId = useFolioStore((state) => state.activeBookId);
  const setActiveBook = useFolioStore((state) => state.setActiveBook);
  const addBook = useFolioStore((state) => state.addBook);
  const tags = useFolioStore((state) => state.tags);
  const visible = books.filter((book) => writerTabOf(book.tag) === tab);

  return (
    <div className="folio-shelf folio-scroll h-full overflow-y-auto px-4 py-4 md:px-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">Мои книги</h3>
          <p className="text-sm text-muted">Откройте рукопись или начните новую.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            onTab("active");
            addBook();
          }}
        >
          <Plus className="size-4" />
          Новая
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {(
          [
            ["active", "в процессе"],
            ["done", "законченные книги"],
            ["paused", "отложено"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={cn(
              "h-8 rounded-sm px-2.5 text-xs",
              tab === id ? "bg-ink text-paper" : "bg-paper-deep/80 text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          {tab === "done" ? "Пока нет законченных книг." : tab === "paused" ? "Нет отложенных книг." : "Полка пуста."}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {visible.map((book) => {
            const progress = getProgress(book);
            const cover = coverOf(book);
            const active = book.id === activeBookId;
            const tag = tags.find((item) => item.id === book.tag);
            return (
              <li key={book.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveBook(book.id)}
                  className={cn(
                    "group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg bg-paper-deep/60 p-2 text-left shadow-[var(--shadow-border)]",
                    active && "shadow-[0_0_0_1px_var(--color-rust)]",
                  )}
                >
                  <span className="folio-cover relative w-full overflow-hidden rounded-md bg-window">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10 transition-transform duration-(--motion-fast) ease-(--ease-out) group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center px-3 text-center text-xs text-muted">
                        Нет обложки
                      </span>
                    )}
                  </span>
                  <span className="mt-2 truncate font-display text-sm font-semibold leading-snug">
                    {book.title}
                  </span>
                  {tag ? (
                    <span className="mt-1 truncate text-xs text-muted">{tag.label}</span>
                  ) : null}
                  <span className="mt-0.5 text-xs text-muted tabular-nums">
                    {formatWords(progress.totalWords)} слов · {progress.completedCount}/
                    {book.chapterCount}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}