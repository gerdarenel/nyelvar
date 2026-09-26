import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NumberField } from "@/components/ui/number-field";
import {
  type Book,
  type RecordPart,
  type WritingRecord,
  clampChapters,
  finishedChapterSet,
  formatWords,
  getProgress,
  parseNumberInput,
  recordChapterLabel,
  recordPart,
  ruPlural,
} from "@/lib/folio";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Draft = {
  date: string;
  part: RecordPart;
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
  const [part, setPart] = useState<RecordPart>("chapter");
  const [chapter, setChapter] = useState("");
  const [words, setWords] = useState("");
  const [note, setNote] = useState("");
  const [finished, setFinished] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setPart("chapter");
    setChapter("");
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
    const chosen = resolveChapter(book, part, chapter, progress.current ?? 1);
    const before = getProgress(book);
    addRecord(book.id, {
      date: date || today,
      chapter: chosen.chapter,
      part: chosen.part,
      words: wordCount,
      note: note.trim(),
      chapterFinished: finished,
    });
    emitUnlock(before.completedCount);
    setWords("");
    setNote("");
    setFinished(false);
    if (part === "chapter") setChapter("");
  }

  function startEdit(record: WritingRecord) {
    setEditingId(record.id);
    setEdit({
      date: record.date,
      part: recordPart(record),
      chapter: recordPart(record) === "chapter" ? String(record.chapter) : "",
      words: String(record.words),
      note: record.note ?? "",
      finished: record.chapterFinished,
    });
  }

  function saveEdit() {
    if (!editingId || !edit) return;
    const before = getProgress(book);
    const chosen = resolveChapter(book, edit.part, edit.chapter, 1);
    updateRecord(book.id, editingId, {
      date: edit.date || today,
      chapter: chosen.chapter,
      part: chosen.part,
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.1fr)_8.5rem_5.5rem_auto]">
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
            <ChapterPicker
              part={part}
              chapter={chapter}
              placeholder={String(progress.current ?? book.chapterCount)}
              onPart={setPart}
              onChapter={setChapter}
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
                  <ChapterPicker
                    part={edit.part}
                    chapter={edit.chapter}
                    placeholder={String(progress.current ?? book.chapterCount)}
                    onPart={(next) => setEdit({ ...edit, part: next })}
                    onChapter={(value) => setEdit({ ...edit, chapter: value })}
                    compact
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
                className={rowFinished(record, book, finishedChapters) ? "bg-moss/18" : "hover:bg-ink/4"}
              >
                <td className="min-w-0 px-2 py-1.5">
                  {formatDay(record.date)}
                  <span className="ml-2 text-muted sm:hidden">
                    {recordChapterLabel(record)} · {formatWords(record.words)}
                  </span>
                  {record.note ? (
                    <span className="mt-0.5 block truncate text-xs text-muted sm:hidden">
                      {record.note}
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-2 py-1.5 sm:table-cell">{recordChapterLabel(record)}</td>
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

function resolveChapter(book: Book, part: RecordPart, raw: string, fallback: number) {
  if (part === "prologue") return { part, chapter: 0 };
  if (part === "epilogue") return { part, chapter: book.chapterCount + 1 };
  const chapterNum = clampChapters(parseNumberInput(raw.trim() === "" ? String(fallback) : raw, fallback));
  return { part, chapter: Math.min(book.chapterCount, chapterNum) };
}

function rowFinished(record: WritingRecord, book: Book, finishedChapters: Set<number>) {
  const part = recordPart(record);
  if (part === "chapter") return finishedChapters.has(record.chapter);
  return book.records.some((item) => recordPart(item) === part && item.chapterFinished);
}

function ChapterPicker({
  part,
  chapter,
  placeholder,
  onPart,
  onChapter,
  compact = false,
}: {
  part: RecordPart;
  chapter: string;
  placeholder: string;
  onPart: (part: RecordPart) => void;
  onChapter: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative flex min-w-0", compact ? "h-8" : "h-10")}>
      {part === "chapter" ? (
        <NumberField
          value={chapter}
          onValueChange={onChapter}
          placeholder={placeholder}
          aria-label="Глава"
          className={cn("folio-chapter-next min-w-0 flex-1 pr-7", compact && "h-8 px-1")}
        />
      ) : (
        <span
          className={cn(
            "folio-control flex min-w-0 flex-1 items-center pr-7 text-sm",
            compact && "h-8 px-1",
          )}
        >
          {part === "prologue" ? "Пролог" : "Эпилог"}
        </span>
      )}
      <button
        type="button"
        aria-label="Выбрать главу, пролог или эпилог"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-muted hover:text-ink"
      >
        <ChevronDown className="size-3.5" />
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-1 min-w-full border border-ink/15 bg-window shadow-[var(--shadow-window)]">
          {(
            [
              ["chapter", "Глава"],
              ["prologue", "Пролог"],
              ["epilogue", "Эпилог"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onPart(id);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-2 py-1.5 text-left text-sm hover:bg-ink/6",
                part === id && "bg-paper-deep/70 text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
