import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type WindowId } from "@/lib/folio";
import { useFolioStore } from "@/lib/store";
import { StartMenu } from "@/components/desktop/StartMenu";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const DOCK: { id: WindowId; label: string }[] = [
  { id: "tracker", label: "Писательский трекер" },
  { id: "reading", label: "Библиотека" },
  { id: "cafe", label: "Кафе" },
  { id: "notes", label: "Блокнот" },
  { id: "tasks", label: "Ежедневник" },
  { id: "awards", label: "Достижения" },
  { id: "account", label: "Настройки" },
  { id: "personalize", label: "Оформление" },
];

export function MenuBar() {
  const [now, setNow] = useState<Date | null>(null);
  const openWindow = useFolioStore((state) => state.openWindow);
  const windows = useFolioStore((state) => state.windows);
  const focusedId = focusedWindow(windows);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <footer className="absolute inset-x-0 bottom-0 z-50 flex h-12 items-center gap-1 border-t border-chrome-text/10 bg-chrome-soft/92 px-1.5 text-chrome-text backdrop-blur-sm md:px-2">
      <StartMenu />
      <div className="flex min-w-0 flex-1 items-center">
        <nav className="hidden min-w-0 items-center gap-0.5 md:flex">
        {DOCK.map((item) =>
          windows[item.id].open ? (
            <MenuItem
              key={item.id}
              label={item.label}
              active={focusedId === item.id}
              onClick={() => openWindow(item.id)}
            />
          ) : null,
        )}
        </nav>
      </div>
      {now ? <ClockButton now={now} /> : <span className="h-4 w-16 shrink-0 sm:w-28" />}
    </footer>
  );
}

function ClockButton({ now }: { now: Date }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(now));
  const root = useRef<HTMLDivElement>(null);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  useEffect(() => {
    if (!open) return;
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

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) setMonth(startOfMonth(now));
            return next;
          });
        }}
        className={cn(
          "px-1 font-mono text-[10px] leading-tight tabular-nums sm:px-2 sm:text-xs",
          open ? "text-chrome-text" : "text-chrome-text/80 hover:text-chrome-text",
        )}
      >
        <time dateTime={now.toISOString()}>{format(now, "EEEEEE d MMM · HH:mm", { locale: ru })}</time>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Календарь"
          className="absolute right-0 bottom-[calc(100%+0.35rem)] z-50 w-60 bg-window p-3 text-ink shadow-[var(--shadow-window)]"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setMonth((value) => addMonths(value, -1))}
              className="flex size-7 items-center justify-center text-ink hover:bg-ink/6"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-medium capitalize">{format(month, "LLLL yyyy", { locale: ru })}</p>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setMonth((value) => addMonths(value, 1))}
              className="flex size-7 items-center justify-center text-ink hover:bg-ink/6"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-[11px] text-muted">
                {day}
              </span>
            ))}
            {days.map((day) => {
              const inMonth = isSameMonth(day, month);
              const today = isToday(day);
              return (
                <span
                  key={format(day, "yyyy-MM-dd")}
                  className={cn(
                    "flex h-7 items-center justify-center text-xs tabular-nums",
                    !inMonth && "text-muted/40",
                    inMonth && !today && "text-ink",
                    today && "bg-rust text-paper",
                  )}
                >
                  {format(day, "d")}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function focusedWindow(windows: ReturnType<typeof useFolioStore.getState>["windows"]): WindowId | null {
  let best: WindowId | null = null;
  let z = -1;
  (["library", ...DOCK.map((item) => item.id)] as WindowId[]).forEach((id) => {
    if (windows[id].open && !windows[id].minimized && windows[id].z >= z) {
      z = windows[id].z;
      best = id;
    }
  });
  return best;
}

function MenuItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-sm px-2.5 text-sm transition-colors duration-(--motion-quick) ease-(--ease-out)",
        active ? "bg-chrome-text/12 text-chrome-text" : "text-chrome-text/75 hover:bg-chrome-text/8 hover:text-chrome-text",
      )}
    >
      {label}
    </button>
  );
}