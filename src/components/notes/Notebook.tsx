import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Notebook() {
  const notes = useFolioStore((state) => state.notes);
  const activeNoteId = useFolioStore((state) => state.activeNoteId);
  const addNote = useFolioStore((state) => state.addNote);
  const updateNote = useFolioStore((state) => state.updateNote);
  const deleteNote = useFolioStore((state) => state.deleteNote);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [active, setActive] = useState(activeNoteId);
  const note = notes.find((item) => item.id === (active ?? activeNoteId)) ?? notes[0] ?? null;

  return (
    <div className="flex h-full min-h-0 bg-window">
      <aside className="flex w-32 shrink-0 flex-col border-r border-ink/15 bg-paper-deep sm:w-44">
        <button
          type="button"
          onClick={() => setActive(addNote())}
          className="h-10 border-b border-ink/10 px-3 text-left text-sm text-ink hover:bg-ink/5"
        >
          + Заметка
        </button>
        <ul className="folio-scroll min-h-0 flex-1 overflow-y-auto">
          {notes.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(item.id)}
                className={cn(
                  "block w-full border-b border-ink/10 px-3 py-2 text-left",
                  note?.id === item.id ? "bg-ink/10" : "hover:bg-ink/5",
                )}
              >
                <span className="block truncate text-sm text-ink">{item.title || "Без названия"}</span>
                <span className="mt-0.5 block text-[10px] text-muted">
                  {format(new Date(item.updatedAt), "d MMM, HH:mm", { locale: ru })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {note ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-ink/10 px-4">
            <input
              value={note.title}
              onChange={(event) => updateNote(note.id, { title: event.target.value })}
              placeholder="Заголовок"
              aria-label="Заголовок"
              className="h-12 min-w-0 flex-1 bg-transparent font-display text-lg text-ink outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setConfirmId(note.id)}
              className="h-8 px-2 text-sm text-muted hover:text-rust"
            >
              Удалить
            </button>
          </div>
          <textarea
            value={note.body}
            onChange={(event) => updateNote(note.id, { body: event.target.value })}
            placeholder="Запишите мысль…"
            aria-label="Текст заметки"
            className="folio-scroll min-h-0 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted"
          />
        </section>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-muted">
          Пока пусто. Нажмите «+ Заметка».
        </div>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        title="Удалить заметку?"
        description="Её нельзя будет вернуть."
        confirmLabel="Удалить"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) deleteNote(confirmId);
          setConfirmId(null);
          setActive(null);
        }}
      />
    </div>
  );
}
