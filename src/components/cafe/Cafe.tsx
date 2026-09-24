import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Settings, Square } from "lucide-react";
import { CafeScene } from "@/components/cafe/CafeScene";
import { NumberField } from "@/components/ui/number-field";
import { useFolioStore } from "@/lib/store";

type Phase = "focus" | "short" | "long";

const PHASE_LABEL: Record<Phase, string> = {
  focus: "Фокус",
  short: "Отдых",
  long: "Большой отдых",
};

export function Cafe() {
  const cafe = useFolioStore((state) => state.cafe);
  const setCafe = useFolioStore((state) => state.setCafe);
  const chime = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const cafeRef = useRef(cafe);
  const runningRef = useRef(false);
  const advancing = useRef(false);
  const phaseRef = useRef<Phase>("focus");
  const roundRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(cafe.focusMin * 60);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  cafeRef.current = cafe;
  runningRef.current = running;

  useEffect(() => {
    const audio = new Audio("/cafe-chime.mp3");
    audio.preload = "auto";
    chime.current = audio;
    return () => {
      audio.pause();
      chime.current = null;
    };
  }, []);

  useEffect(() => {
    if (runningRef.current) return;
    const minutes =
      phase === "focus" ? cafe.focusMin : phase === "short" ? cafe.shortMin : cafe.longMin;
    setRemaining(Math.max(1, minutes) * 60);
  }, [cafe.focusMin, cafe.shortMin, cafe.longMin, phase]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value > 1 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0) advancing.current = false;
  }, [remaining]);

  useEffect(() => {
    if (!running || remaining !== 0 || advancing.current) return;
    advancing.current = true;
    playChime();
    const settings = cafeRef.current;
    let nextPhase: Phase = "focus";
    let nextRound = roundRef.current;
    if (phaseRef.current === "focus") {
      nextRound += 1;
      nextPhase = nextRound % 4 === 0 ? "long" : "short";
    }
    const minutes =
      nextPhase === "focus"
        ? settings.focusMin
        : nextPhase === "short"
          ? settings.shortMin
          : settings.longMin;
    phaseRef.current = nextPhase;
    roundRef.current = nextRound;
    setPhase(nextPhase);
    setRound(nextRound);
    setRemaining(Math.max(1, minutes) * 60);
    if (!settings.autoStart) setRunning(false);
  }, [remaining, running]);

  function unlock() {
    const audio = chime.current;
    if (!audio || unlocked.current) return;
    unlocked.current = true;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        unlocked.current = false;
      });
  }

  function playChime() {
    const audio = chime.current;
    if (!audio) return;
    audio.muted = false;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  function setMinutes(key: "focusMin" | "shortMin" | "longMin", raw: string) {
    if (!/^\d{0,3}$/.test(raw)) return;
    if (raw === "") {
      setCafe({ ...cafe, [key]: 0 });
      return;
    }
    const max = key === "focusMin" ? 180 : 60;
    setCafe({ ...cafe, [key]: Math.min(max, Number(raw)) });
  }

  function stopCurrent() {
    setRunning(false);
    const minutes =
      phase === "focus" ? cafe.focusMin : phase === "short" ? cafe.shortMin : cafe.longMin;
    setRemaining(Math.max(1, minutes) * 60);
  }

  function resetAll() {
    setRunning(false);
    phaseRef.current = "focus";
    roundRef.current = 0;
    setPhase("focus");
    setRound(0);
    setRemaining(Math.max(1, cafe.focusMin) * 60);
  }

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div className="relative h-full min-h-0" onPointerDown={unlock}>
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
            aria-label={running ? "Пауза" : "Старт"}
            onClick={() => setRunning((value) => !value)}
            className="flex size-8 items-center justify-center text-white hover:bg-white/15"
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Стоп"
            onClick={stopCurrent}
            className="flex size-8 items-center justify-center text-white hover:bg-white/15"
          >
            <Square className="size-3.5 fill-current" />
          </button>
          <button
            type="button"
            aria-label="Начать заново"
            onClick={resetAll}
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
