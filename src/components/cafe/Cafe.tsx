import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Settings, Square } from "lucide-react";
import { CafeScene } from "@/components/cafe/CafeScene";
import { NumberField } from "@/components/ui/number-field";
import {
  resetPomodoro,
  stopPomodoro,
  syncIdleDuration,
  togglePomodoro,
  usePomodoro,
  type CafePhase,
} from "@/lib/cafe-timer";
import { useFolioStore } from "@/lib/store";

const PHASE_LABEL: Record<CafePhase, string> = {
  focus: "Фокус",
  short: "Отдых",
  long: "Большой отдых",
};

export function Cafe() {
  const cafe = useFolioStore((state) => state.cafe);
  const setCafe = useFolioStore((state) => state.setCafe);
  const timer = usePomodoro();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const durationKey = `${cafe.focusMin}|${cafe.shortMin}|${cafe.longMin}`;
  const seenDuration = useRef(durationKey);

  useEffect(() => {
    if (seenDuration.current === durationKey) return;
    seenDuration.current = durationKey;
    syncIdleDuration(cafe);
  }, [cafe, durationKey]);

  function setMinutes(key: "focusMin" | "shortMin" | "longMin", raw: string) {
    if (!/^\d{0,3}$/.test(raw)) return;
    if (raw === "") {
      setCafe({ ...cafe, [key]: 0 });
      return;
    }
    const max = key === "focusMin" ? 180 : 60;
    setCafe({ ...cafe, [key]: Math.min(max, Number(raw)) });
  }

  const minutes = String(Math.floor(timer.remaining / 60)).padStart(2, "0");
  const seconds = String(timer.remaining % 60).padStart(2, "0");
  const phase = timer.phase;
  const round = timer.round;

  return (
    <div className="relative h-full min-h-0">
      <CafeScene />
      {settingsOpen ? (
        <div className="absolute inset-x-3 bottom-32 z-20 border border-ink/15 bg-window px-3 py-3 shadow-[var(--shadow-window)]">
          <div className="grid grid-cols-3 gap-2">
            <MinuteField
              label="Сессия"
              value={cafe.focusMin}
              onValueChange={(value) => setMinutes("focusMin", value)}
            />
            <MinuteField
              label="Отдых"
              value={cafe.shortMin}
              onValueChange={(value) => setMinutes("shortMin", value)}
            />
            <MinuteField
              label="Большой отдых"
              value={cafe.longMin}
              onValueChange={(value) => setMinutes("longMin", value)}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={cafe.autoStart}
              onChange={(event) => setCafe({ ...cafe, autoStart: event.target.checked })}
              className="accent-rust"
            />
            Начинать следующую фазу сразу
          </label>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-1 text-white">
        <p className="text-xs text-white/80">
          {PHASE_LABEL[phase]} · {(round % 4) + (phase === "focus" ? 1 : 0) || 4}/4
        </p>
        <p className="font-display text-5xl font-semibold tabular-nums leading-none tracking-tight">
          {minutes}:{seconds}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            aria-label={timer.running ? "Пауза" : "Старт"}
            onClick={() => togglePomodoro(cafe)}
            className="flex size-8 items-center justify-center text-white hover:bg-white/15"
          >
            {timer.running ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Стоп"
            onClick={() => stopPomodoro(cafe)}
            className="flex size-8 items-center justify-center text-white hover:bg-white/15"
          >
            <Square className="size-3.5 fill-current" />
          </button>
          <button
            type="button"
            aria-label="Начать заново"
            onClick={() => resetPomodoro(cafe)}
            className="flex size-8 items-center justify-center text-white hover:bg-white/15"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Настройки"
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen((value) => !value)}
            className="flex size-8 items-center justify-center text-white hover:bg-white/15"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MinuteField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-xs font-medium text-muted">{label}</span>
      <NumberField
        value={value === 0 ? "" : String(value)}
        onValueChange={onValueChange}
        aria-label={label}
        className="h-9"
      />
    </label>
  );
}
