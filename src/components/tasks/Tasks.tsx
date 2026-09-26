import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type PlannerItem } from "@/lib/folio";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function cap(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function split12(time: string) {
  const match = time.trim().match(/^(.*?)\s*(AM|PM)$/i);
  if (!match) return { digits: time, period: "AM" as const };
  return { digits: match[1], period: match[2].toUpperCase() as "AM" | "PM" };
}

export function Tasks() {
  const planner = useFolioStore((state) => state.planner);
  const addPlannerItem = useFolioStore((state) => state.addPlannerItem);
  const updatePlannerItem = useFolioStore((state) => state.updatePlannerItem);
  const deletePlannerItem = useFolioStore((state) => state.deletePlannerItem);
  const reorderPlannerItem = useFolioStore((state) => state.reorderPlannerItem);
  const hourClock = useFolioStore((state) => state.hourClock);
  const setHourClock = useFolioStore((state) => state.setHourClock);
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(12);
  const [extraRows, setExtraRows] = useState(0);
  const [asideWidth, setAsideWidth] = useState(272);
  const [asideRatio, setAsideRatio] = useState(0.46);
  const [wide, setWide] = useState(false);

  const selectedKey = dayKey(selected);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const week = eachDayOfInterval({
    start: startOfWeek(selected, { weekStartsOn: 1 }),
    end: endOfWeek(selected, { weekStartsOn: 1 }),
  });
  const weekKeys = new Set(week.map(dayKey));
  const marked = useMemo(() => {
    const dates = new Set<string>();
    for (const item of planner) dates.add(item.date);
    return dates;
  }, [planner]);
  const dayItems = planner.filter((item) => item.date === selectedKey);
  const blanks = Math.max(1, rows - dayItems.length) + extraRows;
  const weekEvents = planner
    .filter((item) => item.kind === "event" && weekKeys.has(item.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.text.localeCompare(b.text, "ru"));

  function openDay(date: Date) {
    setSelected(date);
    setMonth(startOfMonth(date));
    setFocusId(null);
  }

  function focusAfter(id: string) {
    const index = dayItems.findIndex((item) => item.id === id);
    const next = index >= 0 ? dayItems[index + 1] : undefined;
    if (next) {
      setFocusId(next.id);
      return;
    }
    setFocusId(addPlannerItem(selectedKey, null));
  }

  function beginLine() {
    const empty = dayItems.find((item) => !item.text && !item.time && !item.kind);
    if (empty) {
      setFocusId(empty.id);
      return;
    }
    setFocusId(addPlannerItem(selectedKey, null));
  }

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const measure = () => setRows(Math.max(8, Math.floor(node.clientHeight / 28)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const wideMedia = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      setExtraRows(media.matches ? 18 : 0);
      setWide(wideMedia.matches);
    };
    apply();
    media.addEventListener("change", apply);
    wideMedia.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      wideMedia.removeEventListener("change", apply);
    };
  }, []);

  function onSplitDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const root = paneRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const horizontal = wide;
    const start = horizontal ? event.clientX : event.clientY;
    const startSize = horizontal ? asideWidth : rect.height * asideRatio;
    const move = (ev: PointerEvent) => {
      const next = startSize + (horizontal ? ev.clientX : ev.clientY) - start;
      if (horizontal) {
        const max = Math.max(248, rect.width - 280);
        setAsideWidth(Math.round(Math.min(max, Math.max(248, next))));
        return;
      }
      const height = Math.min(rect.height * 0.72, Math.max(168, next));
      setAsideRatio(height / rect.height);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function remove(item: PlannerItem) {
    if (item.text.trim() || item.time) {
      setConfirmId(item.id);
      return;
    }
    deletePlannerItem(item.id);
  }

  function startDrag(id: string, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragId(id);
    const targetAt = (y: number) => {
      const lines = [...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-day-line]") ?? [])];
      for (const line of lines) {
        const rect = line.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) return line.dataset.id ?? null;
      }
      return lines.length ? "end" : null;
    };
    const move = (ev: PointerEvent) => setOverId(targetAt(ev.clientY));
    const stop = (ev: PointerEvent) => {
      const over = targetAt(ev.clientY);
      if (over && over !== id) reorderPlannerItem(id, over === "end" ? null : over);
      setDragId(null);
      setOverId(null);
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    document.body.style.cursor = "grabbing";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <div ref={paneRef} className="flex h-full min-h-0 flex-col bg-window md:flex-row">
      <aside
        className="flex min-h-0 w-full shrink-0 flex-col md:w-auto"
        style={wide ? { width: asideWidth } : { height: `${asideRatio * 100}%`, maxHeight: `${asideRatio * 100}%` }}
      >
        <div className="flex items-center justify-between px-2 pt-2">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => setMonth((value) => addMonths(value, -1))}
            className="flex size-8 items-center justify-center text-muted hover:text-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-medium capitalize">{cap(format(month, "LLLL yyyy", { locale: ru }))}</p>
          <button
            type="button"
            aria-label="Следующий месяц"
            onClick={() => setMonth((value) => addMonths(value, 1))}
            className="flex size-8 items-center justify-center text-muted hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 px-2 pb-1 text-center text-[10px] text-muted">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 px-2 pb-2">
          {days.map((date) => {
            const key = dayKey(date);
            const inMonth = isSameMonth(date, month);
            const active = isSameDay(date, selected);
            return (
              <button
                key={key}
                type="button"
                onClick={() => openDay(date)}
                className={cn(
                  "mx-auto flex h-8 w-8 flex-col items-center justify-center text-xs tabular-nums",
                  !inMonth && "text-muted/50",
                  active ? "bg-ink text-paper" : "hover:bg-ink/6",
                  !active && isToday(date) && "text-rust",
                )}
              >
                {format(date, "d")}
                <span
                  className={cn(
                    "mt-0.5 size-1",
                    marked.has(key) ? (active ? "bg-paper" : "bg-rust") : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
        <div className="flex min-h-0 flex-1 flex-col border-t border-ink/10">
          <p className="px-3 pt-2 text-xs font-medium text-muted">События недели</p>
          <ul className="folio-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1">
            {weekEvents.length === 0 ? (
              <li className="px-1 py-3 text-xs text-muted">На этой неделе событий нет.</li>
            ) : (
              weekEvents.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openDay(parseISO(item.date))}
                    className={cn(
                      "flex w-full items-start gap-2 px-1 py-1 text-left hover:bg-ink/5",
                      item.date === selectedKey && "bg-ink/6",
                      item.done && "text-muted line-through",
                    )}
                  >
                    <span className="flex h-5 shrink-0 items-center text-xs text-muted">
                      {format(parseISO(item.date), "EEEEEE d", { locale: ru })}
                    </span>
                    {item.time ? (
                      <span className="flex h-5 shrink-0 items-center text-xs whitespace-nowrap text-muted tabular-nums">
                        {item.time}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 text-sm leading-5 break-words whitespace-pre-wrap">{item.text || "Без названия"}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>
      <div
        role="separator"
        aria-orientation={wide ? "vertical" : "horizontal"}
        aria-label="Изменить размер календаря"
        onPointerDown={onSplitDown}
        className={cn(
          "relative z-10 shrink-0 touch-none bg-ink/15",
          wide ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
        )}
      >
        <span className={cn("absolute", wide ? "inset-y-0 -left-1.5 w-3" : "inset-x-0 -top-1.5 h-3")} />
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 px-4 pt-4 pb-3 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl leading-none font-semibold tracking-tight">
              {cap(format(selected, "EEEE", { locale: ru }))}
            </h2>
            <div role="group" aria-label="Формат времени" className="flex h-6 shrink-0 border border-ink/20 text-[11px]">
              {(["12", "24"] as const).map((clock) => (
                <button
                  key={clock}
                  type="button"
                  aria-pressed={hourClock === clock}
                  onClick={() => setHourClock(clock)}
                  className={cn(
                    "px-1.5",
                    hourClock === clock ? "bg-paper-deep/70 text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {clock}ч
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">{format(selected, "d MMMM yyyy", { locale: ru })}</p>
        </header>
        <div ref={scrollerRef} data-day-scroll className="folio-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-5">
          <div className="folio-lined min-h-full px-2">
            {dayItems.map((item) => (
              <DayLine
                key={item.id}
                item={item}
                clock={hourClock}
                active={focusId === item.id}
                dragging={dragId === item.id}
                dropOver={overId === item.id}
                onActivate={() => setFocusId(item.id)}
                onChange={(patch) => updatePlannerItem(item.id, patch)}
                onRemove={() => remove(item)}
                onEnter={() => focusAfter(item.id)}
                onGripDown={(event) => startDrag(item.id, event)}
                onBlankBlur={() => {
                  if (!item.text && !item.time && !item.kind) deletePlannerItem(item.id);
                }}
              />
            ))}
            {Array.from({ length: blanks }, (_, index) => (
              <button
                key={`blank-${index}`}
                type="button"
                aria-label="Новая строка"
                onMouseDown={(event) => {
                  event.preventDefault();
                  beginLine();
                }}
                className="block h-7 w-full"
              />
            ))}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmId !== null}
        title="Удалить строку?"
        description="Эту запись нельзя будет вернуть."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) deletePlannerItem(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}

function DayLine({
  item,
  clock,
  active,
  dragging,
  dropOver,
  onActivate,
  onChange,
  onRemove,
  onEnter,
  onGripDown,
  onBlankBlur,
}: {
  item: PlannerItem;
  clock: "12" | "24";
  active: boolean;
  dragging: boolean;
  dropOver: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<Omit<PlannerItem, "id">>) => void;
  onRemove: () => void;
  onEnter: () => void;
  onGripDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onBlankBlur: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!active) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const scroll = () => {
      const scroller = node.closest("[data-day-scroll]");
      const line = node.closest("[data-day-line]");
      if (!(scroller instanceof HTMLElement) || !(line instanceof HTMLElement)) return;
      const top = line.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTop += top - 8;
    };
    scroll();
    const timer = window.setTimeout(scroll, 320);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scroll);
    return () => {
      window.clearTimeout(timer);
      viewport?.removeEventListener("resize", scroll);
    };
  }, [active]);

  const text = (
    <LinedText
      item={item}
      inputRef={inputRef}
      onActivate={onActivate}
      onChange={onChange}
      onRemove={onRemove}
      onEnter={onEnter}
    />
  );

  return (
    <div
      data-day-line
      data-id={item.id}
      className={cn(
        "flex min-h-7 items-start gap-2",
        dragging && "opacity-40",
        dropOver && "bg-ink/8",
      )}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        onBlankBlur();
      }}
    >
      <button
        type="button"
        aria-label="Переместить"
        onPointerDown={onGripDown}
        className="flex h-7 w-3 shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-[3px] self-start active:cursor-grabbing"
      >
        <span className="size-[3px] bg-ink/35" />
        <span className="size-[3px] bg-ink/35" />
        <span className="size-[3px] bg-ink/35" />
      </button>
      {item.kind ? (
        <button
          type="button"
          aria-label={item.done ? "Снять отметку" : "Отметить готовым"}
          aria-pressed={item.done}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange({ done: !item.done })}
          className={cn(
            "mt-[7px] flex size-3.5 shrink-0 items-center justify-center self-start border border-ink/40",
            item.done && "border-ink bg-ink text-paper",
          )}
        >
          {item.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
        </button>
      ) : null}
      {item.kind === "event" ? (
        <div
          className="flex min-w-0 flex-1 items-start"
          style={{ columnGap: clock === "12" && split12(item.time).digits.trim() ? 16 : 2.67 }}
        >
          <TimeField item={item} clock={clock} onActivate={onActivate} onChange={onChange} />
          {text}
        </div>
      ) : (
        text
      )}
      {active ? (
        <div className="flex h-7 shrink-0 items-center gap-1 self-start">
          <KindTag active={item.kind === "task"} onClick={() => onChange({ kind: "task" })}>
            задача
          </KindTag>
          <KindTag active={item.kind === "event"} onClick={() => onChange({ kind: "event" })}>
            событие
          </KindTag>
        </div>
      ) : null}
    </div>
  );
}

function TimeField({
  item,
  clock,
  onActivate,
  onChange,
}: {
  item: PlannerItem;
  clock: "12" | "24";
  onActivate: () => void;
  onChange: (patch: Partial<Omit<PlannerItem, "id">>) => void;
}) {
  const twelve = clock === "12" ? split12(item.time) : null;
  const digits = twelve ? twelve.digits : item.time;
  const showPeriod = Boolean(twelve && digits.trim());
  return (
    <span className="flex h-7 shrink-0 items-center self-start">
      {clock === "24" ? (
        <input
          value={digits}
          onFocus={onActivate}
          onChange={(event) => onChange({ time: event.target.value })}
          placeholder="время"
          aria-label="Время события"
          className="w-[calc(3.5rem*2/3)] bg-transparent text-xs text-muted tabular-nums outline-none placeholder:text-muted/50"
        />
      ) : (
        <>
          <span className="relative inline-flex items-center">
            <span aria-hidden className="invisible whitespace-pre text-xs tabular-nums">
              {digits || "время"}
            </span>
            <input
              value={digits}
              onFocus={onActivate}
              onChange={(event) => {
                const next = event.target.value;
                onChange({ time: next.trim() ? `${next} ${twelve?.period ?? "AM"}` : "" });
              }}
              placeholder="время"
              aria-label="Время события"
              className="absolute inset-0 w-full bg-transparent p-0 text-xs text-muted tabular-nums outline-none placeholder:text-muted/50"
            />
          </span>
          {showPeriod ? (
            <span className="ml-2">
              <PeriodMenu
                period={twelve?.period ?? "AM"}
                onPick={(period) => onChange({ time: `${digits.trim()} ${period}` })}
              />
            </span>
          ) : null}
        </>
      )}
    </span>
  );
}

function PeriodMenu({ period, onPick }: { period: "AM" | "PM"; onPick: (period: "AM" | "PM") => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        className="text-[10px] tracking-wide text-muted"
      >
        {period}
      </button>
      {open ? (
        <span className="absolute top-full left-0 z-20 mt-1 flex flex-col border border-ink/15 bg-window shadow-[var(--shadow-window)]">
          {(["AM", "PM"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === period}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(option);
                setOpen(false);
              }}
              className={cn(
                "px-2 py-1 text-left text-xs",
                option === period ? "bg-paper-deep/70 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {option}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function LinedText({
  item,
  inputRef,
  onActivate,
  onChange,
  onRemove,
  onEnter,
}: {
  item: PlannerItem;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onActivate: () => void;
  onChange: (patch: Partial<Omit<PlannerItem, "id">>) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    const fit = () => {
      node.style.height = "auto";
      const lines = Math.max(1, Math.round(node.scrollHeight / 28));
      node.style.height = `${lines * 28}px`;
    };
    fit();
    const scroller = node.closest("[data-day-scroll]");
    if (!(scroller instanceof HTMLElement)) return;
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [inputRef, item.text, item.kind]);

  return (
    <textarea
      ref={inputRef}
      rows={1}
      value={item.text}
      onFocus={onActivate}
      onChange={(event) => onChange({ text: event.target.value })}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && item.text === "" && item.time === "") {
          event.preventDefault();
          onRemove();
        }
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (event.shiftKey) {
          const start = event.currentTarget.selectionStart ?? item.text.length;
          const end = event.currentTarget.selectionEnd ?? start;
          const next = `${item.text.slice(0, start)}\n${item.text.slice(end)}`;
          onChange({ text: next });
          const cursor = start + 1;
          requestAnimationFrame(() => {
            const node = inputRef.current;
            if (!node) return;
            node.selectionStart = cursor;
            node.selectionEnd = cursor;
          });
          return;
        }
        onEnter();
      }}
      aria-label={item.kind === "event" ? "Событие" : "Задача"}
      className={cn(
        "min-h-7 min-w-0 flex-1 resize-none overflow-hidden bg-transparent p-0 text-[0.9375rem] leading-7 break-words whitespace-pre-wrap outline-none",
        item.done && "text-muted line-through",
      )}
    />
  );
}

function KindTag({
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
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-5 border px-1.5 text-[10px] leading-none",
        active ? "border-ink/15 bg-paper-deep/70 text-ink" : "border-ink/30 bg-transparent text-muted",
      )}
    >
      {children}
    </button>
  );
}
