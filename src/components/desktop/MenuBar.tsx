import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { type WindowId } from "@/lib/folio";
import { useFolioStore } from "@/lib/store";
import { StartMenu } from "@/components/desktop/StartMenu";

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
    <footer className="absolute inset-x-0 bottom-0 z-50 flex h-12 items-center gap-1 border-t border-paper/10 bg-ink-soft/92 px-1.5 text-paper backdrop-blur-sm md:px-2">
      <StartMenu />
      <nav className="flex min-w-0 flex-1 items-center gap-0.5">
        {windows.tracker.open ? (
          <MenuItem
            label="Писательский трекер"
            active={focusedId === "tracker"}
            onClick={() => openWindow("tracker")}
          />
        ) : null}
        {windows.reading.open ? (
          <MenuItem
            label="Библиотека"
            active={focusedId === "reading"}
            onClick={() => openWindow("reading")}
          />
        ) : null}
        {windows.cafe.open ? (
          <MenuItem
            label="Кафе"
            active={focusedId === "cafe"}
            onClick={() => openWindow("cafe")}
          />
        ) : null}
        {windows.notes.open ? (
          <MenuItem
            label="Блокнот"
            active={focusedId === "notes"}
            onClick={() => openWindow("notes")}
          />
        ) : null}
        {windows.awards.open ? (
          <MenuItem
            label="Достижения"
            active={focusedId === "awards"}
            onClick={() => openWindow("awards")}
          />
        ) : null}
        {windows.account.open ? (
          <MenuItem
            label="Настройки"
            active={focusedId === "account"}
            onClick={() => openWindow("account")}
          />
        ) : null}
        {windows.personalize.open ? (
          <MenuItem
            label="Оформление"
            active={focusedId === "personalize"}
            onClick={() => openWindow("personalize")}
          />
        ) : null}
      </nav>
      {now ? (
        <time
          dateTime={now.toISOString()}
          className="shrink-0 px-1 font-mono text-[10px] leading-tight tabular-nums text-paper/80 sm:px-2 sm:text-xs"
        >
          {format(now, "EEE d MMM · HH:mm", { locale: ru })}
        </time>
      ) : (
        <span className="h-4 w-16 shrink-0 sm:w-28" />
      )}
    </footer>
  );
}

function focusedWindow(windows: ReturnType<typeof useFolioStore.getState>["windows"]): WindowId | null {
  let best: WindowId | null = null;
  let z = -1;
  (["tracker", "library", "reading", "personalize", "account", "notes", "cafe", "awards"] as const).forEach((id) => {
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
        active ? "bg-paper/12 text-paper" : "text-paper/75 hover:bg-paper/8 hover:text-paper",
      )}
    >
      {label}
    </button>
  );
}
