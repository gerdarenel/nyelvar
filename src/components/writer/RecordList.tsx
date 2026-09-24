import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NumberField } from "@/components/ui/number-field";
import {
  type Book,
  type WritingRecord,
  clampChapters,
  finishedChapterSet,
  formatWords,
  getProgress,
  parseNumberInput,
  ruPlural,
} from "@/lib/folio";
import { useFolioStore } from "@/lib/store";

type Draft = {
  date: string;
  chapter: string;
  words: string;
  note: string;
  finished: boolean;
};

export function RecordList({
  book,
  readOnly = false,
  onChapterFinished,
}: {
  book: Book;
  readOnly?: boolean;
  onChapterFinished: (unlockedCurrent: number | null, allDone: boolean) => void;
}) {
  const addRecord = useFolioStore((state) => state.addRecord);
  const updateRecord = useFolioStore((state) => state.updateRecord);
  const deleteRecord = useFolioStore((state) => state.deleteRecord);
  const progress = getProgress(book);
  const finishedChapters = finishedChapterSet(book);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const rows = [...book.records].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );

  const [date, setDate] = useState(today);
  const [chapter, setChapter] = useState(String(progress.current ?? book.chapterCount));
  const [words, setWords] = useState("");
  const [note, setNote] = useState("");
  const [finished, setFinished] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setChapter(String(progress.current ?? book.chapterCount));
    setFinished(false);
    setWords("");
    setNote("");
    setEditingId(null);
    setEdit(null);
  }, [book.id]);

  function emitUnlock(beforeCount: number) {
    const after = getProgress(
      useFolioStore.getState().books.find((item) => item.id === book.id) ?? book,
    );
    if (after.completedCount > beforeCount) {
      onChapterFinished(after.current, after.allDone);
    }
    return after;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const wordCount = Math.max(0, Math.round(parseNumberInput(words, 0)));
    const chapterNum = clampChapters(parseNumberInput(chapter, progress.current ?? 1));
    const capped = Math.min(book.chapterCount, chapterNum);
    const before = getProgress(book);
    addRecord(book.id, {
      date: date || today,
      chapter: capped,
      words: wordCount,
      note: note.trim(),
      chapterFinished: finished,
    });
    const after = emitUnlock(before.completedCount);
    setWords("");
    setNote("");
    setFinished(false);
    if (after.current) setChapter(String(after.current));
  }

  function startEdit(record: WritingRecord) {
    setEditingId(record.id);
    setEdit({
      date: record.date,
      chapter: String(record.chapter),
      words: String(record.words),
      note: record.note ?? "",
      finished: record.chapterFinished,
    });
  }

  function saveEdit() {
    if (!editingId || !edit) return;
    const before = getProgress(book);
    const chapterNum = Math.min(
      book.chapterCount,
      clampChapters(parseNumberInput(edit.chapter, 1)),
    );
    updateRecord(book.id, editingId, {
      date: edit.date || today,
      chapter: chapterNum,
      words: Math.max(0, Math.round(parseNumberInput(edit.words, 0))),
      note: edit.note.trim(),
      chapterFinished: edit.finished,
    });
    emitUnlock(before.completedCount);
    setEditingId(null);
    setEdit(null);
  }

  function removeEditing() {
    if (!editingId) return;
    deleteRecord(book.id, editingId);
    setEditingId(null);
    setEdit(null);
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">Дневник</h3>
        <p className="text-xs text-muted">
          {ruPlural(book.records.length, "запись", "записи", "записей")}
        </p>
      </div>

      <form onSubmit={submit} className={readOnly ? "hidden" : "flex flex-col gap-2 rounded-md bg-paper-deep/50 p-2"}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.1fr)_5.5rem_5.5rem_auto]">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">День</span>
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="folio-control text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Глава</span>
            <NumberField
              value={chapter}
              onValueChange={setChapter}
              placeholder="1"
              aria-label="Глава"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Слова</span>
            <NumberField
              value={words}
              onValueChange={setWords}
              placeholder="0"
              aria-label="Слова"
            />
          </label>
          <label className="col-span-2 flex h-10 items-center gap-2 self-end px-1 text-sm sm:col-span-1">
            <FinishBox checked={finished} onChange={setFinished} />
            <span>Готово</span>
          </label>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted">Заметка</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Необязательно"
              className="folio-control text-sm"
            />
          </label>
          <Button type="submit" size="sm" className="h-10 shrink-0">
            <Plus className="size-4" />
            Добавить
          </Button>
        </div>
      </form>

      {book.records.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          {readOnly ? "В этом черновике нет записей." : "Пока нет записей. Добавьте сегодняшний труд, чтобы разбудить путь."}
        </p>
      ) : (
        <table className="folio-log text-sm">
          <thead className="hidden text-xs font-medium tracking-wide text-muted sm:table-header-group">
            <tr>
              <th className="w-[7.5rem] px-2 py-1.5 text-left font-medium">День</th>
              <th className="w-[6rem] px-2 py-1.5 text-left font-medium">Глава</th>
              <th className="w-[4.5rem] px-2 py-1.5 text-left font-medium">Слова</th>
              <th className="px-2 py-1.5 text-left font-medium">Заметка</th>
              <th className="folio-log-done font-medium">Готово</th>
              {readOnly ? null : (
                <th className="w-16">
                  <span className="sr-only">Изменить</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
          {rows.map((record) =>
            editingId === record.id && edit ? (
              <tr key={record.id} className="folio-log-edit">
                <td className="min-w-0 px-1 py-1">
                  <input
                    type="date"
                    value={edit.date}
                    onChange={(event) => setEdit({ ...edit, date: event.target.value })}
                    aria-label="День"
                    className="h-8 w-full min-w-0 border border-ink/20 bg-window px-1 text-sm"
                  />
                </td>
                <td className="px-1 py-1">
                  <NumberField
                    value={edit.chapter}
                    onValueChange={(value) => setEdit({ ...edit, chapter: value })}
                    aria-label="Глава"
                    className="h-8 px-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <NumberField
                    value={edit.words}
                    onValueChange={(value) => setEdit({ ...edit, words: value })}
                    aria-label="Слова"
                    className="h-8 px-1"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="text"
                    value={edit.note}
                    onChange={(event) => setEdit({ ...edit, note: event.target.value })}
                    aria-label="Заметка"
                    className="h-8 w-full min-w-0 border border-ink/20 bg-window px-1 text-sm"
                  />
                </td>
                <td className="folio-log-done py-1">
                  <FinishBox
                    checked={edit.finished}
                    onChange={(next) => setEdit({ ...edit, finished: next })}
                  />
                </td>
                <td className="w-16 py-0.5">
                  <div className="flex items-center justify-end gap-0.5 pr-0.5">
                    <button
                      type="button"
                      aria-label="Сохранить запись"
                      onClick={saveEdit}
                      className="flex size-8 items-center justify-center text-ink hover:bg-ink/8"
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      aria-label="Удалить запись"
                      onClick={() => setConfirmRemove(true)}
                      className="flex size-8 items-center justify-center text-rust hover:bg-rust/10"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={record.id}
                className={finishedChapters.has(record.chapter) ? "bg-moss/18" : "hover:bg-ink/4"}
              >
                <td className="min-w-0 px-2 py-1.5">
                  {formatDay(record.date)}
                  <span className="ml-2 text-muted sm:hidden">
                    Глава {record.chapter} · {formatWords(record.words)}
                  </span>
                  {record.note ? (
                    <span className="mt-0.5 block truncate text-xs text-muted sm:hidden">
                      {record.note}
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-2 py-1.5 sm:table-cell">Глава {record.chapter}</td>
                <td className="hidden px-2 py-1.5 tabular-nums sm:table-cell">
                  {formatWords(record.words)}
                </td>
                <td className="hidden max-w-0 truncate px-2 py-1.5 text-muted sm:table-cell">
                  {record.note || ""}
                </td>
                <td className="folio-log-done py-1.5">
                  {record.chapterFinished ? (
                    <Check
                      className="mx-auto size-4 text-moss"
                      strokeWidth={2.5}
                      aria-label="Готово"
                    />
                  ) : (
                    <span className="sr-only">Не сдана</span>
                  )}
                </td>
                {readOnly ? null : (
                <td className="w-16 py-0.5">
                <button
                  type="button"
                  aria-label={`Изменить запись за ${formatDay(record.date)}`}
                  onClick={() => startEdit(record)}
                  className="relative flex size-8 items-center justify-center text-muted transition-colors duration-(--motion-quick) hover:bg-ink/8 hover:text-ink after:absolute after:inset-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2"
                >
                  <Pencil className="size-3.5" />
                </button>
                </td>
                )}
              </tr>
            ),
          )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Удалить запись?"
        description="Эту строку дневника нельзя будет вернуть."
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          removeEditing();
          setConfirmRemove(false);
        }}
      />
    </section>
  );
}

function FinishBox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="relative inline-flex size-5 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer size-5 cursor-pointer appearance-none border border-ink/35 bg-window transition-colors duration-(--motion-quick) checked:border-rust checked:bg-rust after:absolute after:inset-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2"
        aria-label="Готово"
      />
      <Check
        className="pointer-events-none absolute size-3 text-paper opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
}

function formatDay(value: string) {
  try {
    return format(parseISO(value), "d MMM yyyy", { locale: ru });
  } catch {
    return value;
  }
}
