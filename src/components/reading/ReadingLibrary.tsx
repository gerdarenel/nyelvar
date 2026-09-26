import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { addDays, addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth, endOfWeek, endOfYear, format, isSameMonth, isToday, isValid, parseISO, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, MoreHorizontal, Plus, Settings, Star, Trash2 } from "lucide-react";
import {
  READING_STATUSES,
  type JournalSticker,
  type Quote,
  type ReadingBook,
  fileToCoverDataUrl,
  fileToImageDataUrl,
  formatWords,
  localDay,
  newId,
  readingActivity,
  readingCoverOf,
  readingPercent,
  streakLabel,
} from "@/lib/folio";
import { useActiveReading, useFolioStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoverArt } from "@/components/ui/cover-art";
import { NumberField } from "@/components/ui/number-field";
import { TagSelect } from "@/components/ui/tag-select";
import { TitleField } from "@/components/ui/title-field";
import { cn } from "@/lib/utils";

export function ReadingLibrary() {
  const book = useActiveReading();
  if (book) return <ReadingPage />;
  return <ShelfGrid />;
}

function ShelfGrid() {
  const shelf = useFolioStore((state) => state.shelf);
  const setActiveReading = useFolioStore((state) => state.setActiveReading);
  const addReadingBook = useFolioStore((state) => state.addReadingBook);
  const filter = useFolioStore((state) => state.shelfFilter);
  const setFilter = useFolioStore((state) => state.setShelfFilter);
  const pane = useFolioStore((state) => state.libraryPane);
  const setPane = useFolioStore((state) => state.setLibraryPane);
  const [groupBy, setGroupBy] = useState<TimeFilter>("all");
  const [periodOffset, setPeriodOffset] = useState(0);
  const visible = shelf.filter((book) => book.status === filter);
  const period = groupBy === "all" ? null : periodBounds(groupBy, periodOffset);
  const listed = period
    ? visible.filter((book) => inPeriod(book.finishedAt, period.start, period.end))
    : visible;

  return (
    <div className="folio-scroll h-full overflow-y-auto px-4 py-4 md:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">Библиотека</h3>
          <p className="text-sm text-muted">Обложки книг, которые вы читаете, прочли или ждёте.</p>
        </div>
        <Button size="sm" onClick={() => addReadingBook()}>
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setPane("stats")}
          className={cn(
            "h-8 rounded-sm px-2.5 text-xs",
            pane === "stats" ? "bg-ink text-paper" : "bg-paper-deep/80 text-muted hover:text-ink",
          )}
        >
          статистика
        </button>
        {READING_STATUSES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setPane("shelf");
              setFilter(item.id);
            }}
            className={cn(
              "h-8 rounded-sm px-2.5 text-xs",
              pane === "shelf" && filter === item.id
                ? "bg-ink text-paper"
                : "bg-paper-deep/80 text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {pane === "stats" ? (
        <ReadingStats shelf={shelf} />
      ) : (
        <>
      {filter === "read" ? (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <span className="mr-1 text-sm text-muted">Фильтр:</span>
            {(
              [
                ["all", "все"],
                ["week", "по неделям"],
                ["month", "по месяцам"],
                ["year", "по годам"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setGroupBy(id);
                  setPeriodOffset(0);
                }}
                className={cn(
                  "h-7 px-2 text-xs",
                  groupBy === id ? "font-semibold text-ink" : "text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {period ? (
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                aria-label="Раньше"
                onClick={() => setPeriodOffset((value) => value - 1)}
                className="flex size-8 items-center justify-center text-ink hover:bg-ink/6"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-28 px-1 text-center text-sm text-ink">{period.label}</span>
              <button
                type="button"
                aria-label="Позже"
                disabled={periodOffset >= 0}
                onClick={() => setPeriodOffset((value) => Math.min(0, value + 1))}
                className="flex size-8 items-center justify-center text-ink hover:bg-ink/6 disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {listed.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          {period ? "В этом периоде ничего не прочитано." : "Полка пуста."}
        </p>
      ) : (
        <BookGrid books={listed} onOpen={setActiveReading} showProgress={filter === "reading"} />
      )}
        </>
      )}
    </div>
  );
}

function BookGrid({
  books,
  onOpen,
  showProgress,
}: {
  books: ReadingBook[];
  onOpen: (id: string) => void;
  showProgress: boolean;
}) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {books.map((book) => {
        const cover = readingCoverOf(book);
        const percent = readingPercent(book);
        return (
          <li key={book.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(book.id)}
              aria-label={book.title}
              className="group flex w-full flex-col text-left"
            >
              <span className="folio-cover relative block w-full overflow-hidden rounded-md bg-window shadow-[var(--shadow-border)]">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10 transition-transform duration-(--motion-fast) ease-(--ease-out) group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center px-2 text-center text-xs text-muted">
                    Нет обложки
                  </span>
                )}
              </span>
              {showProgress ? (
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden bg-line/70">
                    <span className="block h-full origin-left bg-moss" style={{ transform: `scaleX(${percent / 100})` }} />
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{percent}%</span>
                </span>
              ) : null}
              {(book.rating ?? 0) > 0 ? <Stars value={book.rating} className="mt-1" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function ReadingStats({ shelf }: { shelf: ReadingBook[] }) {
  const activity = useMemo(() => readingActivity(shelf), [shelf]);
  const shown = useFolioStore((state) => state.readingStats);
  const setShown = useFolioStore((state) => state.setReadingStats);
  const [settings, setSettings] = useState(false);
  const today = useMemo(() => new Date(), []);
  const maxMonday = startOfWeek(today, { weekStartsOn: 1 });
  const [monday, setMonday] = useState(maxMonday);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const counts = days.map((day) => Math.max(0, activity.byDate.get(format(day, "yyyy-MM-dd")) ?? 0));
  const weekTotal = counts.reduce((sum, value) => sum + value, 0);
  const canNext = monday < maxMonday;
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monday), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(endOfMonth(monday), { weekStartsOn: 1 }), 6),
  });
  const periods = (
    [
      ["day", "страниц сегодня", activity.day],
      ["month", "страниц в месяц", activity.month],
      ["year", "страниц в год", activity.year],
      ["booksMonth", "книг за месяц", activity.booksMonth],
      ["booksYear", "книг за год", activity.booksYear],
    ] as const
  ).filter(([id]) => shown.includes(id));
  const stats = [
    ...periods.map(([id, label, value]) => ({ id, label, value: formatWords(value) })),
    { id: "streak", label: streakLabel(activity.streak), value: String(activity.streak) },
  ];

  function togglePeriod(id: "day" | "month" | "year" | "booksMonth" | "booksYear") {
    const next = shown.includes(id) ? shown.filter((item) => item !== id) : [...shown, id];
    const order = ["day", "month", "year", "booksMonth", "booksYear"] as const;
    setShown(order.filter((item) => next.includes(item)));
  }

  return (
    <section className="rounded-lg bg-paper-deep/70 px-4 py-3 md:px-5 md:py-4">
      <div className="grid items-stretch gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.9fr)] md:gap-8">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start gap-2">
            <div
              className="grid min-w-0 flex-1 gap-y-4"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(max(5.6rem, calc((100% - 1.5rem) / 4)), 1fr))",
              }}
            >
              {stats.map((item) => (
                <ReadStat key={item.id} value={item.value} label={item.label} />
              ))}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Какие статистики показывать"
                aria-expanded={settings}
                onClick={() => setSettings((open) => !open)}
                className="flex size-8 items-center justify-center text-muted hover:text-ink"
              >
                <Settings className="size-4" />
              </button>
              {settings ? (
                <div className="absolute top-9 right-0 z-20 w-52 border border-line bg-window p-3 shadow-[var(--shadow-window)]">
                  <p className="text-xs font-medium text-muted">Показывать</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {(
                      [
                        ["day", "страниц сегодня"],
                        ["month", "страниц в месяц"],
                        ["year", "страниц в год"],
                        ["booksMonth", "книг за месяц"],
                        ["booksYear", "книг за год"],
                      ] as const
                    ).map(([id, label]) => (
                      <li key={id}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={shown.includes(id)}
                            onChange={() => togglePeriod(id)}
                          />
                          {label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Предыдущая неделя"
                onClick={() => setMonday(addWeeks(monday, -1))}
                className="flex size-11 items-center justify-center rounded-sm text-ink"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-sm font-medium">
                  {format(days[0], "d MMM", { locale: ru })} — {format(days[6], "d MMM", { locale: ru })}
                </p>
                <p className="text-xs text-muted tabular-nums">{formatWords(weekTotal)} страниц</p>
              </div>
              <button
                type="button"
                aria-label="Следующая неделя"
                disabled={!canNext}
                onClick={() => setMonday(addWeeks(monday, 1))}
                className="flex size-11 items-center justify-center rounded-sm text-ink disabled:text-muted"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <PageBarChart counts={counts} />
          </div>
        </div>
        <div className="flex min-h-80 flex-col bg-line/35 p-3 md:min-h-full">
          <p className="mb-2 shrink-0 text-center text-sm font-medium capitalize">
            {format(monday, "LLLL yyyy", { locale: ru })}
          </p>
          <div className="grid min-h-0 flex-1 grid-cols-7 content-stretch gap-1">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-xs leading-none text-muted">
                {day}
              </span>
            ))}
            {calendarDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const pages = Math.max(0, activity.byDate.get(key) ?? 0);
              const books = activity.covers.get(key) ?? [];
              const inMonth = isSameMonth(day, monday);
              return (
                <span
                  key={key}
                  title={pages ? `${formatWords(pages)} стр.` : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-start gap-1 py-1 text-sm tabular-nums",
                    !inMonth && "text-muted/40",
                    inMonth && pages === 0 && "text-ink",
                    pages > 0 && "bg-moss/15 text-ink",
                    isToday(day) && pages === 0 && "shadow-[inset_0_0_0_1px_var(--color-rust)]",
                  )}
                >
                  <span className="leading-none">{format(day, "d")}</span>
                  {books.length > 0 ? (
                    <span className="flex max-w-full justify-center gap-0.5">
                      {books.slice(0, 2).map((book) => {
                        const cover = readingCoverOf(book);
                        return cover ? (
                          <img key={book.id} src={cover} alt="" className="h-7 w-5 object-cover" />
                        ) : (
                          <span key={book.id} className="h-7 w-5 bg-rust/40" />
                        );
                      })}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-2 md:px-3">
      <p className="font-display text-3xl leading-none font-semibold tracking-tight text-ink tabular-nums md:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

function niceMax(value: number): number {
  const n = Math.max(10, value);
  const exp = 10 ** Math.floor(Math.log10(n));
  const m = n / exp;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return nice * exp;
}

function PageBarChart({ counts }: { counts: number[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 320, h: 224 });

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    function measure() {
      if (!node) return;
      setBox({ w: Math.max(160, node.clientWidth), h: Math.max(140, node.clientHeight) });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(...counts, 0));
  const ticks = [max, max / 2, 0];
  const width = box.w;
  const height = box.h;
  const padT = 22;
  const padB = 22;
  const plotH = Math.max(40, height - padT - padB);
  const slot = width / counts.length;

  return (
    <div className="flex h-56 min-w-0">
      <div className="flex w-9 shrink-0 flex-col justify-between pt-6 pb-5 text-right text-xs tabular-nums text-muted">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div ref={frame} className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block size-full" role="img" aria-label="Страницы по дням">
          {ticks.map((tick) => {
            const y = padT + plotH - (tick / max) * plotH;
            return (
              <line key={tick} x1={0} x2={width} y1={y} y2={y} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            );
          })}
          {counts.map((value, index) => {
            const barW = slot * 0.42;
            const x = slot * index + (slot - barW) / 2;
            const h = (Math.max(0, value) / max) * plotH;
            const y = padT + plotH - h;
            const cx = slot * index + slot / 2;
            return (
              <g key={WEEKDAYS[index]}>
                <rect x={x} y={value > 0 ? y : padT + plotH - 2} width={barW} height={value > 0 ? h : 2} className={value > 0 ? "fill-moss" : "fill-line"} />
                {value > 0 ? (
                  <text x={cx} y={y - 6} textAnchor="middle" className="fill-muted" fontSize="9">
                    {formatWords(value)}
                  </text>
                ) : null}
                <text x={cx} y={height - 6} textAnchor="middle" className="fill-muted" fontSize="11">
                  {WEEKDAYS[index]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Stars({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-0 text-rust", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (value ?? 0) >= star;
        const icon = (
          <Star className={cn(onChange ? "size-4" : "size-3", filled ? "fill-current" : "opacity-35")} />
        );
        if (!onChange) return <span key={star}>{icon}</span>;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} из 5`}
            aria-pressed={filled}
            onClick={() => onChange(value === star ? null : star)}
            className="flex size-5 items-center justify-center hover:text-ink"
          >
            {icon}
          </button>
        );
      })}
    </span>
  );
}

type TimeFilter = "all" | "week" | "month" | "year";

function periodBounds(mode: Exclude<TimeFilter, "all">, offset: number) {
  const now = new Date();
  if (mode === "week") {
    const start = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), offset);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    const label =
      offset === 0
        ? "эта неделя"
        : `${format(start, "d MMM", { locale: ru })} – ${format(end, "d MMM yyyy", { locale: ru })}`;
    return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd"), label };
  }
  if (mode === "month") {
    const start = addMonths(startOfMonth(now), offset);
    const end = endOfMonth(start);
    const raw = format(start, "LLLL yyyy", { locale: ru });
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
    };
  }
  const start = addYears(startOfYear(now), offset);
  const end = endOfYear(start);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd"), label: format(start, "yyyy") };
}

function inPeriod(date: string | null, start: string, end: string) {
  if (!date) return false;
  const parsed = parseISO(date);
  if (!isValid(parsed)) return false;
  const day = format(parsed, "yyyy-MM-dd");
  return day >= start && day <= end;
}

function ReadingPage() {
  const book = useActiveReading();
  const setActiveReading = useFolioStore((state) => state.setActiveReading);
  const updateReadingBook = useFolioStore((state) => state.updateReadingBook);
  const setShelfFilter = useFolioStore((state) => state.setShelfFilter);
  const deleteReadingBook = useFolioStore((state) => state.deleteReadingBook);
  const photoRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"notes" | "quotes">("notes");
  const [selected, setSelected] = useState<string | null>(null);
  const [stickerDelete, setStickerDelete] = useState(false);
  const [paperH, setPaperH] = useState(480);
  const [readDraft, setReadDraft] = useState("");
  const [totalDraft, setTotalDraft] = useState("");
  const [logDate, setLogDate] = useState(localDay);
  const [confirmBook, setConfirmBook] = useState(false);
  const [confirmQuote, setConfirmQuote] = useState<string | null>(null);
  const [confirmSticker, setConfirmSticker] = useState(false);
  const [editingQuote, setEditingQuote] = useState<string | null>(null);

  useEffect(() => {
    if (!book) return;
    setReadDraft(String(book.pagesRead));
    setTotalDraft(String(book.pagesTotal));
  }, [book?.id, book?.pagesRead, book?.pagesTotal]);

  useEffect(() => {
    setLogDate(localDay());
  }, [book?.id]);

  useLayoutEffect(() => {
    const node = pageRef.current;
    if (!node) return;
    const measure = () => setPaperH(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [book?.id, book?.stickers.length, book?.journalText, tab]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || !book) return;
    if (document.activeElement === el) return;
    if (el.innerText.replace(/\n$/, "") !== book.journalText) {
      el.innerText = book.journalText;
    }
  }, [book?.id, book?.journalText, tab]);

  if (!book) return null;

  const cover = readingCoverOf(book);
  const percent = readingPercent(book);

  async function onCover(file: File | undefined) {
    if (!file || !book) return;
    const dataUrl = await fileToCoverDataUrl(file);
    updateReadingBook(book.id, { coverDataUrl: dataUrl });
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !book) return;
    const dataUrl = await fileToImageDataUrl(file, 960);
    const index = book.stickers.length;
    const sticker: JournalSticker = {
      id: newId("img"),
      dataUrl,
      x: index % 2 === 0 ? 4 : 62,
      y: 8 + (index % 4) * 6,
      w: 32,
      rotation: 0,
    };
    updateReadingBook(book.id, { stickers: [...book.stickers, sticker] });
    setTab("notes");
    setSelected(sticker.id);
  }

  function patchSticker(id: string, patch: Partial<JournalSticker>) {
    if (!book) return;
    updateReadingBook(book.id, {
      stickers: book.stickers.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function commitPages() {
    if (!book) return;
    updateReadingBook(
      book.id,
      {
        pagesRead: readDraft.trim() === "" ? 0 : Number(readDraft),
        pagesTotal: totalDraft.trim() === "" ? 0 : Number(totalDraft),
      },
      logDate || localDay(),
    );
  }

  function addQuote() {
    if (!book) return;
    const quote: Quote = { id: newId("qt"), text: "", source: "" };
    updateReadingBook(book.id, { quotes: [quote, ...(book.quotes ?? [])] });
    setTab("quotes");
    setEditingQuote(quote.id);
  }

  function patchQuote(id: string, patch: Partial<Quote>) {
    if (!book) return;
    updateReadingBook(book.id, {
      quotes: (book.quotes ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  const wrapStickers = book.stickers;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-2 pt-1">
        <button
          type="button"
          aria-label="На полку"
          onClick={() => setActiveReading(null)}
          className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-ink/6 hover:text-ink"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate px-1 text-sm text-muted">Библиотека</span>
        <button
          type="button"
          aria-label="Добавить снимок"
          onClick={() => photoRef.current?.click()}
          className="flex size-11 items-center justify-center rounded-sm text-muted hover:bg-ink/6 hover:text-ink"
        >
          <ImagePlus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Удалить книгу"
          onClick={() => setConfirmBook(true)}
          className="flex size-11 items-center justify-center rounded-sm text-rust hover:bg-rust/10"
        >
          <Trash2 className="size-4" />
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void onPhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex shrink-0 items-stretch gap-3 px-4 pb-3 md:px-5">
        <CoverArt
          src={cover}
          label={book.title}
          onUpload={(file) => void onCover(file)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TitleField
            value={book.title}
            label="Название"
            placeholder="Название"
            onChange={(value) => updateReadingBook(book.id, { title: value })}
            className="font-display text-xl font-semibold tracking-tight md:text-2xl"
          />
          <input
            value={book.author}
            onChange={(event) => updateReadingBook(book.id, { author: event.target.value })}
            placeholder="Автор"
            className="folio-plain text-sm text-muted"
          />
          <textarea
            value={book.note}
            rows={2}
            onChange={(event) => updateReadingBook(book.id, { note: event.target.value })}
            placeholder="Коротко о книге."
            className="folio-plain mt-1 min-h-0 w-full max-w-[700px] flex-1 resize-none text-sm leading-relaxed"
          />
          <div className="mt-auto flex min-w-0 flex-wrap items-center gap-3 pt-2">
            <TagSelect
              value={book.status}
              options={READING_STATUSES}
              placeholder="статус"
              allowEmpty={false}
              onChange={(next) => {
                const status = next ?? "want";
                const today = new Date().toISOString().slice(0, 10);
                updateReadingBook(book.id, {
                  status,
                  finishedAt: status === "read" ? book.finishedAt || today : book.finishedAt,
                });
                setShelfFilter(status);
              }}
            />
            <Stars value={book.rating} onChange={(rating) => updateReadingBook(book.id, { rating })} />
            {book.status === "read" ? (
              <label className="flex items-center gap-2 text-xs text-muted">
                прочитана
                <input
                  type="date"
                  value={book.finishedAt ?? ""}
                  onChange={(event) =>
                    updateReadingBook(book.id, { finishedAt: event.target.value || null })
                  }
                  className="folio-plain"
                  aria-label="Дата прочтения"
                />
              </label>
            ) : null}
          </div>
        </div>
        <div className="hidden w-36 shrink-0 flex-col items-center justify-center self-center rounded-md bg-paper-deep/70 px-2 py-3 md:flex md:w-40">
          <PagesReadFields
            logDate={logDate}
            readDraft={readDraft}
            totalDraft={totalDraft}
            percent={percent}
            onLogDate={setLogDate}
            onReadDraft={setReadDraft}
            onTotalDraft={setTotalDraft}
            onCommit={commitPages}
          />
        </div>
      </div>

      <div className="mx-4 mb-1 md:hidden">
        <div className="rounded-md bg-paper-deep/70 px-3 py-3">
          <PagesReadFields
            wide
            logDate={logDate}
            readDraft={readDraft}
            totalDraft={totalDraft}
            percent={percent}
            onLogDate={setLogDate}
            onReadDraft={setReadDraft}
            onTotalDraft={setTotalDraft}
            onCommit={commitPages}
          />
        </div>
      </div>

      <section className="mt-3 flex min-h-0 flex-1 flex-col px-4 pb-4 md:mt-6 md:px-5">
        <div className="flex shrink-0 items-end gap-1">
          <JournalTab active={tab === "notes"} onClick={() => setTab("notes")}>
            записи
          </JournalTab>
          <JournalTab active={tab === "quotes"} onClick={() => setTab("quotes")}>
            цитаты
          </JournalTab>
        </div>

        {tab === "notes" ? (
          <div className="min-h-0 flex-1 overflow-auto rounded-b-md rounded-tr-md">
            <div ref={pageRef} className="folio-lined relative min-h-full px-4">
              <WrapFlow stickers={wrapStickers} paperH={paperH} />
              {book.stickers.map((sticker) => (
                <Sticker
                  key={sticker.id}
                  sticker={sticker}
                  editing={selected === sticker.id}
                  showDelete={selected === sticker.id && stickerDelete}
                  pageRef={pageRef}
                  onSelect={() => {
                    setSelected(sticker.id);
                    setStickerDelete(false);
                  }}
                  onLongPress={() => {
                    setSelected(sticker.id);
                    setStickerDelete(true);
                  }}
                  onChange={(patch) => patchSticker(sticker.id, patch)}
                  onRemove={() => setConfirmSticker(true)}
                />
              ))}
              <div
                ref={editorRef}
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Пишите на линейках — мысли, цитаты, пометки."
                onFocus={() => setSelected(null)}
                onInput={(event) =>
                  updateReadingBook(book.id, {
                    journalText: event.currentTarget.innerText.replace(/\n$/, ""),
                  })
                }
                className="folio-journal-text relative z-0"
              />
            </div>
          </div>
        ) : (
          <div className="folio-scroll min-h-0 flex-1 overflow-auto rounded-b-md rounded-tr-md bg-paper-deep/40 px-3 py-3">
            <button
              type="button"
              onClick={addQuote}
              className="mb-3 flex h-9 items-center gap-1.5 rounded-sm px-2 text-sm text-ink hover:bg-ink/6"
            >
              <Plus className="size-4" />
              добавить цитату
            </button>
            {(book.quotes ?? []).length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted">Пока нет цитат.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(book.quotes ?? []).map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    editing={editingQuote === quote.id}
                    onPatch={(patch) => patchQuote(quote.id, patch)}
                    onSave={() => setEditingQuote(null)}
                    onEdit={() => setEditingQuote(quote.id)}
                    onDelete={() => setConfirmQuote(quote.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmBook}
        title="Удалить книгу?"
        description="Дневник, цитаты и обложка этой книги исчезнут с полки."
        onCancel={() => setConfirmBook(false)}
        onConfirm={() => {
          deleteReadingBook(book.id);
          setConfirmBook(false);
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmQuote)}
        title="Удалить цитату?"
        onCancel={() => setConfirmQuote(null)}
        onConfirm={() => {
          if (confirmQuote) {
            updateReadingBook(book.id, {
              quotes: book.quotes.filter((item) => item.id !== confirmQuote),
            });
          }
          setConfirmQuote(null);
        }}
      />
      <ConfirmDialog
        open={confirmSticker}
        title="Удалить снимок?"
        onCancel={() => setConfirmSticker(false)}
        onConfirm={() => {
          if (selected) {
            updateReadingBook(book.id, {
              stickers: book.stickers.filter((item) => item.id !== selected),
            });
          }
          setSelected(null);
          setStickerDelete(false);
          setConfirmSticker(false);
        }}
      />
    </div>
  );
}

function QuoteCard({
  quote,
  editing,
  onPatch,
  onSave,
  onEdit,
  onDelete,
}: {
  quote: Quote;
  editing: boolean;
  onPatch: (patch: Partial<Quote>) => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menu) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setMenu(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [menu]);

  if (editing) {
    return (
      <li className="rounded-md bg-window p-3 shadow-[var(--shadow-border)]">
        <textarea
          value={quote.text}
          rows={4}
          onChange={(event) => onPatch({ text: event.target.value })}
          placeholder="Цитата"
          className="folio-plain resize-none text-sm leading-relaxed"
        />
        <input
          value={quote.source}
          onChange={(event) => onPatch({ source: event.target.value })}
          placeholder="Страница, глава…"
          className="folio-plain mt-2 text-xs text-muted"
        />
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={onSave}>
            Сохранить
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li ref={root} className="relative rounded-md bg-window p-3 pr-10 pb-10 shadow-[var(--shadow-border)]">
      <p className="text-sm leading-relaxed">{quote.text || "…"}</p>
      {quote.source ? <p className="mt-2 text-xs text-muted">{quote.source}</p> : null}
      <button
        type="button"
        aria-label="Действия"
        aria-expanded={menu}
        onClick={() => setMenu((open) => !open)}
        className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-sm text-muted hover:bg-ink/6 hover:text-ink"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menu ? (
        <ul className="absolute right-2 bottom-11 z-20 min-w-36 rounded-md bg-window p-1 shadow-[var(--shadow-window)]">
          <li>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onEdit();
              }}
              className="flex h-8 w-full items-center rounded-sm px-2.5 text-left text-sm hover:bg-ink/6"
            >
              Редактировать
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
              className="flex h-8 w-full items-center rounded-sm px-2.5 text-left text-sm text-rust hover:bg-rust/10"
            >
              Удалить
            </button>
          </li>
        </ul>
      ) : null}
    </li>
  );
}

function PagesReadFields({
  wide = false,
  logDate,
  readDraft,
  totalDraft,
  percent,
  onLogDate,
  onReadDraft,
  onTotalDraft,
  onCommit,
}: {
  wide?: boolean;
  logDate: string;
  readDraft: string;
  totalDraft: string;
  percent: number;
  onLogDate: (value: string) => void;
  onReadDraft: (value: string) => void;
  onTotalDraft: (value: string) => void;
  onCommit: () => void;
}) {
  function onEnter(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onCommit();
    event.currentTarget.blur();
  }

  const dateClass =
    "folio-control box-border h-8 w-full min-w-0 max-w-full px-2 text-center text-xs [&::-webkit-date-and-time-value]:text-center";
  const dateField = (mobile: boolean) => (
    <input
      type="date"
      value={logDate}
      max={localDay()}
      onChange={(event) => onLogDate(event.target.value || localDay())}
      aria-label="Дата чтения"
      className={mobile ? `${dateClass} appearance-none` : dateClass}
    />
  );
  const readField = (
    <NumberField
      value={readDraft}
      onValueChange={onReadDraft}
      onKeyDown={onEnter}
      enterKeyHint="send"
      placeholder="0"
      aria-label="Страниц прочитано"
      className="h-8 w-full min-w-0 px-1 text-center"
    />
  );
  const totalField = (
    <NumberField
      value={totalDraft}
      onValueChange={onTotalDraft}
      onKeyDown={onEnter}
      enterKeyHint="send"
      placeholder="0"
      aria-label="Страниц всего"
      className="h-8 w-full min-w-0 px-1 text-center"
    />
  );

  if (wide) {
    return (
      <div className="flex w-full flex-col items-stretch">
        {dateField(true)}
        <div className="mt-1.5 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          {readField}
          <span className="text-center text-xs text-muted">из</span>
          {totalField}
        </div>
        <p className="mt-1 text-center text-xs text-muted">страниц прочитано</p>
        <Button type="button" size="sm" onClick={onCommit} className="mt-2 h-10 w-full">
          обновить
        </Button>
        <div className="mt-2 flex w-full items-center gap-1.5">
          <div
            className="h-1 min-w-0 flex-1 overflow-hidden bg-line/70"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full origin-left bg-moss" style={{ transform: `scaleX(${percent / 100})` }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">{percent}%</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid w-full grid-cols-[3rem_auto_minmax(0,1fr)] items-center gap-x-1 gap-y-1.5">
        <div className="col-span-3 min-w-0">{dateField(false)}</div>
        {readField}
        <span className="text-center text-xs text-muted">из</span>
        {totalField}
      </div>
      <p className="mt-1 text-center text-xs text-muted">страниц прочитано</p>
      <Button type="button" size="sm" onClick={onCommit} className="mt-2 h-10 w-full">
        обновить
      </Button>
      <div className="mt-2 flex w-full items-center gap-1.5">
        <div
          className="h-1 min-w-0 flex-1 overflow-hidden bg-line/70"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full origin-left bg-moss" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted">{percent}%</span>
      </div>
    </>
  );
}

function JournalTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-8 rounded-t-md px-3.5 text-sm transition-colors duration-(--motion-quick)",
        active
          ? "bg-paper-deep/70 text-ink"
          : "bg-paper-deep/30 text-muted hover:bg-paper-deep/50 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const JOURNAL_LINE = 28;

function snapLine(px: number, mode: "round" | "ceil" | "floor" = "round"): number {
  if (px <= 0) return 0;
  const steps = px / JOURNAL_LINE;
  const next =
    mode === "ceil" ? Math.ceil(steps) : mode === "floor" ? Math.floor(steps) : Math.round(steps);
  return Math.max(0, next) * JOURNAL_LINE;
}

function WrapFlow({ stickers, paperH }: { stickers: JournalSticker[]; paperH: number }) {
  const sorted = [...stickers].sort((a, b) => a.y - b.y || a.x - b.x);
  let cursor = 0;
  const nodes: {
    id: string;
    gap: number;
    h: number;
    side: "left" | "right" | "hole";
    left: number;
    right: number;
    w: number;
  }[] = [];
  for (const sticker of sorted) {
    const y = snapLine((sticker.y / 100) * paperH, "round");
    const rawH = ((sticker.h ?? Math.max(18, sticker.w * 0.7)) / 100) * paperH;
    const h = Math.max(JOURNAL_LINE, snapLine(rawH, "ceil"));
    const gap = Math.max(0, y - cursor);
    const left = Math.max(0, sticker.x);
    const right = Math.max(0, 100 - sticker.x - sticker.w);
    const center = sticker.x + sticker.w / 2;
    const side: "left" | "right" | "hole" =
      center >= 58 ? "right" : center <= 42 ? "left" : "hole";
    nodes.push({ id: sticker.id, gap, h, side, left, right, w: sticker.w });
    cursor = y + h + JOURNAL_LINE;
  }
  return (
    <>
      {nodes.map((node) => (
        <Fragment key={node.id}>
          {node.gap > 0 ? (
            <span
              aria-hidden
              className="pointer-events-none float-left w-full"
              style={{ height: node.gap, clear: "both" }}
            />
          ) : null}
          {node.side === "right" ? (
            <span
              aria-hidden
              className="pointer-events-none float-right"
              style={{
                width: `${node.w}%`,
                height: node.h,
                marginRight: `${node.right}%`,
                shapeOutside: "margin-box",
                shapeMargin: 16,
              }}
            />
          ) : node.side === "left" ? (
            <span
              aria-hidden
              className="pointer-events-none float-left"
              style={{
                width: `${node.w}%`,
                height: node.h,
                marginLeft: `${node.left}%`,
                shapeOutside: "margin-box",
                shapeMargin: 16,
              }}
            />
          ) : (
            <span
              aria-hidden
              className="pointer-events-none float-left w-full"
              style={{
                height: node.h,
                clear: "left",
                shapeOutside: `inset(0 ${node.right}% 0 ${node.left}%)`,
                shapeMargin: 16,
              }}
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none float-left w-full"
            style={{ height: JOURNAL_LINE }}
          />
        </Fragment>
      ))}
    </>
  );
}

type DragKind = "move" | "resize" | "rotate";

function Sticker({
  sticker,
  editing,
  showDelete,
  pageRef,
  onSelect,
  onLongPress,
  onChange,
  onRemove,
}: {
  sticker: JournalSticker;
  editing: boolean;
  showDelete: boolean;
  pageRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onLongPress: () => void;
  onChange: (patch: Partial<JournalSticker>) => void;
  onRemove: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    kind: DragKind;
    ox: number;
    oy: number;
    x: number;
    y: number;
    w: number;
  } | null>(null);
  const hold = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) return;
    root.current?.focus();
  }, [editing]);

  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  }

  function clearHold() {
    if (hold.current) {
      window.clearTimeout(hold.current);
      hold.current = null;
    }
  }

  function start(kind: DragKind, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!editing) onSelect();
    drag.current = {
      kind,
      ox: event.clientX,
      oy: event.clientY,
      x: sticker.x,
      y: sticker.y,
      w: sticker.w,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onBodyPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    clearHold();
    hold.current = window.setTimeout(() => {
      hold.current = null;
      onLongPress();
    }, 520);
    start("move", event);
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    if (!drag.current || !editing) return;
    const page = pageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const dx = event.clientX - drag.current.ox;
    const dy = event.clientY - drag.current.oy;
    if (Math.abs(dx) + Math.abs(dy) > 6) clearHold();
    if (drag.current.kind === "move") {
      const maxX = Math.max(0, 100 - sticker.w);
      const yPx = clamp(drag.current.y + (dy / Math.max(rect.height, 1)) * 100, 0, 82);
      const snappedY = snapLine((yPx / 100) * rect.height, "round");
      onChange({
        x: clamp(drag.current.x + (dx / rect.width) * 100, 0, maxX),
        y: (snappedY / Math.max(rect.height, 1)) * 100,
      });
    } else if (drag.current.kind === "resize") {
      onChange({ w: clamp(drag.current.w + (dx / rect.width) * 100, 14, 72) });
    } else {
      const box = event.currentTarget.closest("[data-sticker]")?.getBoundingClientRect();
      const cx = (box?.left ?? rect.left) + (box?.width ?? 0) / 2;
      const cy = (box?.top ?? rect.top) + (box?.height ?? 0) / 2;
      const angle = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
      onChange({ rotation: Math.round(angle + 90) });
    }
  }

  function end(event: ReactPointerEvent<HTMLElement>) {
    clearHold();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={root}
      data-sticker={sticker.id}
      tabIndex={editing ? 0 : -1}
      className={cn("absolute z-10 touch-none outline-none", editing && "z-20")}
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        width: `${sticker.w}%`,
        transform: `rotate(${sticker.rotation}deg)`,
        transformOrigin: "center center",
      }}
      onKeyDown={onKey}
      onPointerDown={onBodyPointerDown}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img
        src={sticker.dataUrl}
        alt=""
        draggable={false}
        contentEditable={false}
        onLoad={(event) => {
          const img = event.currentTarget;
          const page = pageRef.current;
          if (!page || !img.naturalWidth) return;
          const wPx = (sticker.w / 100) * page.clientWidth;
          const hPx = wPx * (img.naturalHeight / img.naturalWidth);
          const nextH = (snapLine(hPx, "ceil") / Math.max(page.offsetHeight, 1)) * 100;
          if (sticker.h === undefined || Math.abs((sticker.h ?? 0) - nextH) > 0.4) {
            onChange({ h: nextH });
          }
        }}
        className={cn(
          "block w-full select-none object-cover shadow-[var(--shadow-window)]",
          editing && "outline outline-2 outline-rust",
        )}
      />
      {editing ? (
        <>
          <button
            type="button"
            aria-label="Повернуть"
            className="absolute -top-7 left-1/2 size-4 -translate-x-1/2 rounded-full bg-rust"
            onPointerDown={(event) => start("rotate", event)}
          />
          <span className="pointer-events-none absolute -top-7 left-1/2 h-7 w-px -translate-x-1/2 bg-rust" />
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              aria-label="Размер"
              onPointerDown={(event) => start("resize", event)}
              className={cn(
                "absolute size-3 bg-window shadow-[var(--shadow-border)] after:absolute after:inset-1/2 after:size-9 after:-translate-x-1/2 after:-translate-y-1/2",
                corner === "nw" && "-top-1.5 -left-1.5 cursor-nwse-resize",
                corner === "ne" && "-top-1.5 -right-1.5 cursor-nesw-resize",
                corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                corner === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
              )}
            />
          ))}
          {showDelete ? (
            <button
              type="button"
              aria-label="Удалить снимок"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className="absolute -bottom-2 -right-8 flex size-8 items-center justify-center rounded-sm bg-rust text-paper"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
