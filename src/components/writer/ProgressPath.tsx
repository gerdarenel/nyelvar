import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { type Book, formatWords, getProgress, roundBook, streakLabel, wordsByDate, writingStreak } from "@/lib/folio";
import { RecordList } from "@/components/writer/RecordList";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export type WorkPane = "chapters" | "words" | "archive";

export function ProgressPath({
  book,
  pane,
  onPane,
  onNewRound,
}: {
  book: Book;
  pane: WorkPane;
  onPane: (pane: WorkPane) => void;
  onNewRound: () => void;
}) {
  const progress = getProgress(book);
  const streak = writingStreak(book.records);
  const chapterNo = progress.allDone ? book.chapterCount : (progress.current ?? book.chapterCount);
  const scroller = useRef<HTMLDivElement>(null);
  const rounds = book.rounds ?? [];

  useLayoutEffect(() => {
    if (pane !== "chapters") return;
    const node = scroller.current?.querySelector("[data-current=true]");
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    }
  }, [pane, progress.current, book.id, book.chapterCount]);

  return (
    <div>
      <div className="flex items-end gap-1 px-3">
        <TabButton active={pane === "chapters"} onClick={() => onPane("chapters")}>
          по главам
        </TabButton>
        <TabButton active={pane === "words"} onClick={() => onPane("words")}>
          по словам
        </TabButton>
        {rounds.length > 0 ? (
          <TabButton active={pane === "archive"} onClick={() => onPane("archive")}>
            предыдущие черновики
          </TabButton>
        ) : null}
        <button
          type="button"
          aria-label="Новый черновик"
          onClick={onNewRound}
          className="mb-px ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border-[1.33px] border-current text-muted hover:bg-ink/6 hover:text-ink"
        >
          <Plus className="size-3" strokeWidth={2.66} />
        </button>
      </div>
      {pane === "archive" ? (
        <div className="flex flex-col gap-8 rounded-lg rounded-tl-none bg-paper-deep/40 px-3 py-4 md:px-4">
          {rounds.map((round, index) => {
            const snapshot = roundBook(book, round);
            return (
              <article key={round.id} className="flex flex-col gap-3">
                <h3 className="text-sm font-medium tracking-wide">Черновик {index + 1}</h3>
                <section className="rounded-lg bg-paper-deep/70 px-4 py-3 md:px-5 md:py-4">
                  <RoundStats book={snapshot} />
                  <p className="mt-4 text-xs font-medium text-muted">по главам</p>
                  <ChapterLane book={snapshot} />
                  <p className="mt-4 text-xs font-medium text-muted">по словам</p>
                  <WordWeekView book={snapshot} />
                </section>
                <RecordList book={snapshot} readOnly onChapterFinished={() => {}} />
              </article>
            );
          })}
        </div>
      ) : (
      <section
        className={cn(
          "rounded-lg bg-paper-deep/70 px-4 py-3 md:px-5 md:py-4",
          pane === "chapters" && "rounded-tl-none",
        )}
      >
        <div className="grid grid-cols-3">
          <Stat value={formatWords(progress.totalWords)} label="слов в рукописи" />
          <Stat value={String(chapterNo)} label={`глава из ${book.chapterCount}`} />
          <Stat value={String(streak)} label={streakLabel(streak)} />
        </div>

        {pane === "chapters" ? (
        <>
          <ChapterLane book={book} scroller={scroller} />
          <p className="mt-2 text-xs text-muted">
            {progress.allDone
              ? "Все главы отмечены сдаными. Можно писать дальше, если рукопись ещё растёт."
              : `Путь заполняется словами (~${formatWords(book.wordsPerChapter)} на главу). Следующая глава открывается только когда вы отмечаете «Готово».`}
          </p>
        </>
      ) : (
        <WordWeekView book={book} />
      )}
      </section>
      )}
    </div>
  );
}

function RoundStats({ book }: { book: Book }) {
  const progress = getProgress(book);
  const streak = writingStreak(book.records);
  const chapterNo = progress.allDone ? book.chapterCount : (progress.current ?? book.chapterCount);
  return (
    <div className="grid grid-cols-3">
      <Stat value={formatWords(progress.totalWords)} label="слов в рукописи" />
      <Stat value={String(chapterNo)} label={`глава из ${book.chapterCount}`} />
      <Stat value={String(streak)} label={streakLabel(streak)} />
    </div>
  );
}

function ChapterLane({
  book,
  scroller,
}: {
  book: Book;
  scroller?: { current: HTMLDivElement | null };
}) {
  const progress = getProgress(book);
  return (
    <div ref={scroller} className="folio-scroll mt-3 -mx-1 overflow-x-auto px-2 pt-3 pb-2">
      <ol className="flex min-w-min items-center px-1">
        {progress.nodes.map((node, index) => (
          <li
            key={node.n}
            data-current={node.status === "current" ? "true" : undefined}
            className="flex items-center"
          >
            <div className="flex w-12 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-11 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  node.status === "complete" && "bg-moss text-paper",
                  node.status === "current" &&
                    "bg-window text-ink shadow-[0_0_0_2px_var(--color-window),0_0_0_4px_var(--color-rust)]",
                  node.status === "locked" && "bg-window/70 text-muted",
                )}
                aria-current={node.status === "current" ? "step" : undefined}
                title={`Глава ${node.n}`}
              >
                {node.status === "complete" ? <Check className="size-4" strokeWidth={2.5} /> : node.n}
              </div>
              <span className="text-xs font-medium tracking-wide text-muted">Гл. {node.n}</span>
            </div>
            {index < progress.nodes.length - 1 ? (
              <div className="relative mb-5 h-1.5 w-10 overflow-hidden bg-line/70 sm:w-12" aria-hidden="true">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 w-full origin-left",
                    node.status === "complete" ? "bg-moss" : "bg-rust",
                  )}
                  style={{ transform: `scaleX(${node.fill})` }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 border-l border-ink/15 px-4 first:border-l-0 first:pl-0 md:px-8">
      <p className="font-display text-4xl leading-none font-semibold tracking-tight text-ink tabular-nums md:text-5xl">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}

function TabButton({
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

function WordWeekView({ book }: { book: Book }) {
  const byDate = useMemo(() => wordsByDate(book.records), [book.records]);
  const today = useMemo(() => new Date(), []);
  const minMonday = useMemo(() => {
    const first = book.records.reduce(
      (earliest, record) => (record.date < earliest ? record.date : earliest),
      book.startedAt || format(today, "yyyy-MM-dd"),
    );
    return startOfWeek(parseISO(first), { weekStartsOn: 1 });
  }, [book.records, book.startedAt, today]);
  const maxMonday = startOfWeek(today, { weekStartsOn: 1 });
  const [monday, setMonday] = useState(maxMonday);

  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const counts = days.map((day) => byDate.get(format(day, "yyyy-MM-dd")) ?? 0);
  const weekTotal = counts.reduce((sum, value) => sum + value, 0);
  const canPrev = monday > minMonday;
  const canNext = monday < maxMonday;
  const month = monday;

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: addDays(startOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 6),
  });

  return (
    <div className="mt-5 grid items-stretch gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-8">
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Предыдущая неделя"
            disabled={!canPrev}
            onClick={() => setMonday(addWeeks(monday, -1))}
            className="flex size-11 items-center justify-center rounded-sm text-ink disabled:text-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-sm font-medium">
              {format(days[0], "d MMM", { locale: ru })} — {format(days[6], "d MMM", { locale: ru })}
            </p>
            <p className="text-xs text-muted tabular-nums">{formatWords(weekTotal)} слов</p>
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
        <WordLineChart counts={counts} />
      </div>

      <div className="folio-cal flex h-full min-h-56 min-w-0 flex-col p-2">
        <p className="mb-1 shrink-0 text-center text-sm font-medium capitalize">
          {format(month, "LLLL yyyy", { locale: ru })}
        </p>
        <div className="grid min-h-0 flex-1 grid-cols-7 content-stretch gap-px">
          {WEEKDAYS.map((day) => (
            <span key={day} className="text-center text-xs leading-none text-muted">
              {day}
            </span>
          ))}
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const words = byDate.get(key) ?? 0;
            const inMonth = isSameMonth(day, month);
            return (
              <span
                key={key}
                title={words ? `${formatWords(words)} слов` : undefined}
                className={cn(
                  "flex min-h-0 items-center justify-center text-xs tabular-nums",
                  !inMonth && "text-muted/40",
                  inMonth && words === 0 && "text-ink",
                  words > 0 && "bg-moss text-paper",
                  isToday(day) && words === 0 && "shadow-[inset_0_0_0_1px_var(--color-rust)]",
                )}
              >
                {format(day, "d")}
              </span>
            );
          })}
        </div>
      </div>
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

function curvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = (p2.x - p1.x) / 3;
    d += ` C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function WordLineChart({ counts }: { counts: number[] }) {
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
  const padX = 10;
  const plotH = Math.max(40, height - padT - padB);
  const plotW = Math.max(40, width - padX * 2);
  const points = counts.map((value, index) => ({
    x: padX + (index / Math.max(1, counts.length - 1)) * plotW,
    y: padT + plotH - (Math.max(0, value) / max) * plotH,
    value,
  }));
  const line = curvePath(points);
  const last = points[points.length - 1] ?? { x: padX, y: padT + plotH };
  const baseline = padT + plotH;
  const area = `${line} L ${last.x} ${baseline} L ${points[0]?.x ?? padX} ${baseline} Z`;

  return (
    <div className="flex h-56 min-w-0">
      <div className="flex w-9 shrink-0 flex-col justify-between pt-6 pb-5 text-right text-xs tabular-nums text-muted">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div ref={frame} className="min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block size-full"
          role="img"
          aria-label="Слова по дням"
        >
          {ticks.map((tick) => {
            const y = padT + plotH - (tick / max) * plotH;
            return (
              <line
                key={tick}
                x1={0}
                x2={width}
                y1={y}
                y2={y}
                className="stroke-line"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          <path d={area} className="fill-moss/20" />
          <path
            d={line}
            fill="none"
            className="stroke-moss"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => (
            <g key={WEEKDAYS[index]}>
              <circle
                cx={point.x}
                cy={point.y}
                r={point.value > 0 ? 3 : 2}
                className={point.value > 0 ? "fill-moss" : "fill-line"}
              />
              {point.value > 0 ? (
                <text
                  x={point.x}
                  y={point.y - 8}
                  textAnchor="middle"
                  className="fill-muted"
                  fontSize="9"
                >
                  {formatWords(point.value)}
                </text>
              ) : null}
              <text
                x={point.x}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted"
                fontSize="11"
              >
                {WEEKDAYS[index]}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

