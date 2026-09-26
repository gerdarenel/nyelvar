import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Settings, Trash2 } from "lucide-react";
import {
  type TrackerTag,
  isLockedTag,
  writerTabOf,
  type WriterTab,
  clampChapters,
  clampStartingChapters,
  clampStartingWords,
  clampWordsPerChapter,
  coverOf,
  fileToCoverDataUrl,
  getProgress,
  newId,
  parseNumberInput,
} from "@/lib/folio";
import { useActiveBook, useFolioStore } from "@/lib/store";
import { Library } from "@/components/library/Library";
import { ProgressPath, type WorkPane } from "@/components/writer/ProgressPath";
import { RecordList } from "@/components/writer/RecordList";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoverArt } from "@/components/ui/cover-art";
import { NumberField } from "@/components/ui/number-field";
import { TagSelect } from "@/components/ui/tag-select";
import { CyclePicker } from "@/components/writer/CyclePicker";
import { TitleField } from "@/components/ui/title-field";
import { cn } from "@/lib/utils";

type SettingsDraft = {
  chapterCount: string;
  wordsPerChapter: string;
  startedAt: string;
  startingWords: string;
  startingChapters: string;
};

function draftFromBook(book: {
  chapterCount: number;
  wordsPerChapter: number;
  startedAt: string;
  startingWords: number;
  startingChapters: number;
}): SettingsDraft {
  return {
    chapterCount: String(book.chapterCount),
    wordsPerChapter: String(book.wordsPerChapter),
    startedAt: book.startedAt,
    startingWords: String(book.startingWords ?? 0),
    startingChapters: String(book.startingChapters ?? 0),
  };
}

export function WriterTracker() {
  const book = useActiveBook();
  const updateBook = useFolioStore((state) => state.updateBook);
  const deleteBook = useFolioStore((state) => state.deleteBook);
  const startRound = useFolioStore((state) => state.startRound);
  const setActiveBook = useFolioStore((state) => state.setActiveBook);
  const tags = useFolioStore((state) => state.tags);
  const setTrackerTags = useFolioStore((state) => state.setTrackerTags);
  const [notice, setNotice] = useState<string | null>(null);
  const [shelfTab, setShelfTab] = useState<WriterTab>("active");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRound, setConfirmRound] = useState(false);
  const [workPane, setWorkPane] = useState<WorkPane>("chapters");
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [tagDraft, setTagDraft] = useState<TrackerTag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [confirmTag, setConfirmTag] = useState<string | null>(null);

  useEffect(() => {
    if ((book?.rounds?.length ?? 0) === 0 && workPane === "archive") setWorkPane("chapters");
  }, [book?.id, book?.rounds?.length, workPane]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSettings();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  function openSettings() {
    if (!book) return;
    setDraft(draftFromBook(book));
    setTagDraft(useFolioStore.getState().tags.map((tag) => ({ ...tag })));
    setNewTag("");
    setConfirmTag(null);
    setConfirmDelete(false);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
    setDraft(null);
    setConfirmDelete(false);
    setTagDraft([]);
    setNewTag("");
    setConfirmTag(null);
  }

  function saveSettings() {
    if (!book || !draft) return;
    const nextTags = tagDraft
      .map((tag) => ({ ...tag, label: tag.label.trim() }))
      .filter((tag) => tag.label.length > 0);
    setTrackerTags(nextTags);
    const chapterCount = clampChapters(parseNumberInput(draft.chapterCount, book.chapterCount));
    updateBook(book.id, {
      chapterCount,
      wordsPerChapter: clampWordsPerChapter(
        parseNumberInput(draft.wordsPerChapter, book.wordsPerChapter),
      ),
      startedAt: draft.startedAt || book.startedAt,
      startingWords: clampStartingWords(parseNumberInput(draft.startingWords, 0)),
      startingChapters: clampStartingChapters(
        parseNumberInput(draft.startingChapters, 0),
        chapterCount,
      ),
    });
    closeSettings();
  }

  if (!book) {
    return <Library tab={shelfTab} onTab={setShelfTab} />;
  }

  async function onCover(file: File | undefined) {
    if (!file || !book) return;
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      updateBook(book.id, { coverDataUrl: dataUrl });
    } catch {
      setNotice("Не удалось прочитать изображение.");
    }
  }

  const cover = coverOf(book);
  const progress = getProgress(book);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="folio-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
        <div className="flex shrink-0 items-center gap-1 -mx-1">
          <button
            type="button"
            aria-label="К моим книгам"
            onClick={() => setActiveBook(null)}
            className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-ink/6 hover:text-ink"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted">Мои книги</span>
        </div>
        <header className="mb-2 flex items-stretch gap-4">
          <CoverArt
            src={cover}
            label={book.title}
            onUpload={(file) => void onCover(file)}
            className="min-h-[13.2rem]"
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TitleField
                  id={`title-${book.id}`}
                  value={book.title}
                  label="Книга"
                  onChange={(value) => updateBook(book.id, { title: value })}
                  className="m-0 block min-w-0 border-0 p-0 font-display text-2xl leading-none font-semibold tracking-tight md:text-3xl"
                />
                <CyclePicker bookId={book.id} cycle={book.cycle ?? null} />
              </div>
              <button
                type="button"
                aria-label="Настройки рукописи"
                aria-expanded={settingsOpen}
                onClick={openSettings}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-(--motion-quick) hover:bg-ink/6 hover:text-ink"
              >
                <Settings className="size-4" />
              </button>
            </div>
            <label className="sr-only" htmlFor={`ann-${book.id}`}>
              Аннотация
            </label>
            <textarea
              id={`ann-${book.id}`}
              value={book.annotation}
              rows={3}
              onChange={(event) => updateBook(book.id, { annotation: event.target.value })}
              placeholder="Краткая аннотация рукописи."
              className="folio-plain mt-3 mr-[14px] min-h-0 w-full max-w-[700px] flex-1 resize-none py-1 text-sm leading-[1.083]"
            />
            <div className="mt-auto flex min-w-0 items-center gap-3 pt-2">
              <TagSelect
                value={book.tag}
                options={tags}
                placeholder="тэг"
                onChange={(next) => {
                  updateBook(book.id, { tag: next });
                  setShelfTab(writerTabOf(next));
                }}
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className="h-1 max-w-32 min-w-16 flex-1 overflow-hidden bg-line/70"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                >
                  <div
                    className="h-full origin-left bg-rust"
                    style={{ transform: `scaleX(${progress.percent / 100})` }}
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">{progress.percent}%</span>
              </div>
            </div>
          </div>
        </header>

        <ProgressPath
          book={book}
          pane={workPane}
          onPane={setWorkPane}
          onNewRound={() => setConfirmRound(true)}
        />
        {workPane === "archive" ? null : (
        <RecordList
          book={book}
          onChapterFinished={(current, allDone) => {
            setNotice(allDone ? "Рукопись завершена." : `Открыта глава ${current}.`);
          }}
        />
        )}
      </div>

      {settingsOpen && draft ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/30 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Настройки рукописи"
            className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-lg bg-window shadow-[var(--shadow-window)]"
          >
            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto p-4">
            <p className="font-display text-lg font-semibold tracking-tight">Настройки</p>
            <p className="mt-0.5 text-xs text-muted">Как считается эта рукопись.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted">Главы</span>
                <NumberField
                  value={draft.chapterCount}
                  onValueChange={(value) => setDraft({ ...draft, chapterCount: value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted">Слов на главу</span>
                <NumberField
                  value={draft.wordsPerChapter}
                  onValueChange={(value) => setDraft({ ...draft, wordsPerChapter: value })}
                />
              </label>
              <label className="col-span-2 flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted">Начата</span>
                <input
                  type="date"
                  value={draft.startedAt}
                  onChange={(event) => setDraft({ ...draft, startedAt: event.target.value })}
                  className="folio-control text-sm"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted">Слов написано</span>
                <NumberField
                  value={draft.startingWords}
                  onValueChange={(value) => setDraft({ ...draft, startingWords: value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted">Глав написано</span>
                <NumberField
                  value={draft.startingChapters}
                  onValueChange={(value) => setDraft({ ...draft, startingChapters: value })}
                />
              </label>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Слова и главы, уже написанные до этого дневника, чтобы путь не начинался с нуля.
            </p>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-medium text-muted">Теги</p>
              <ul className="mt-2 flex flex-col gap-2">
                {tagDraft.map((tag) => {
                  const locked = isLockedTag(tag.id);
                  return (
                    <li key={tag.id} className="flex gap-1">
                      <input
                        value={tag.label}
                        readOnly={locked}
                        onChange={(event) =>
                          setTagDraft(
                            tagDraft.map((item) =>
                              item.id === tag.id ? { ...item, label: event.target.value } : item,
                            ),
                          )
                        }
                        aria-label="Название тега"
                        className={cn(
                          "folio-control h-9 text-sm",
                          locked && "text-muted",
                        )}
                      />
                      {locked ? null : (
                        <button
                          type="button"
                          aria-label={`Удалить тег «${tag.label || "без названия"}»`}
                          onClick={() => setConfirmTag(tag.id)}
                          className="flex size-9 shrink-0 items-center justify-center text-rust hover:bg-rust/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex gap-1">
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder="Новый тег"
                  aria-label="Новый тег"
                  className="folio-control h-9 text-sm"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const label = newTag.trim();
                      if (!label) return;
                      setTagDraft([...tagDraft, { id: newId("tag"), label }]);
                      setNewTag("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const label = newTag.trim();
                    if (!label) return;
                    setTagDraft([...tagDraft, { id: newId("tag"), label }]);
                    setNewTag("");
                  }}
                  className="flex h-9 shrink-0 items-center gap-1 px-2 text-sm hover:bg-ink/6"
                >
                  <Plus className="size-3.5" />
                  Добавить
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeSettings}>
                Отмена
              </Button>
              <Button size="sm" onClick={saveSettings}>
                Сохранить
              </Button>
            </div>
            </div>
            <div className="shrink-0 border-t border-rust/40 px-4 py-3">
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-sm text-sm text-rust hover:bg-rust/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Удалить рукопись
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-md bg-ink px-4 py-2 text-sm text-paper shadow-[var(--shadow-window)]"
        >
          {notice}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRound}
        title="Начать новый черновик?"
        description="Текущие главы, слова и дневник сохранятся во вкладке «Предыдущие черновики». Новая таблица начнётся с нуля."
        confirmLabel="Начать"
        danger={false}
        onCancel={() => setConfirmRound(false)}
        onConfirm={() => {
          startRound(book.id);
          setWorkPane("chapters");
          setConfirmRound(false);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Удалить рукопись?"
        description="Записи дневника и обложка этой книги исчезнут."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteBook(book.id);
          closeSettings();
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmTag)}
        title="Удалить тег?"
        description="Он исчезнет из списка. Книги с этим тегом останутся без него."
        onCancel={() => setConfirmTag(null)}
        onConfirm={() => {
          if (confirmTag && !isLockedTag(confirmTag)) {
            setTagDraft(tagDraft.filter((tag) => tag.id !== confirmTag));
          }
          setConfirmTag(null);
        }}
      />
    </div>
  );
}
