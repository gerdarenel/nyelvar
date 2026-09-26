import { useSyncExternalStore } from "react";

export type CafePhase = "focus" | "short" | "long";

export type Pomodoro = {
  running: boolean;
  phase: CafePhase;
  round: number;
  /** Wall-clock moment the current phase ends, while running. */
  endsAt: number | null;
  remaining: number;
};

type Durations = {
  focusMin: number;
  shortMin: number;
  longMin: number;
  autoStart: boolean;
};

const KEY = "folio-cafe-timer";

const IDLE: Pomodoro = {
  running: false,
  phase: "focus",
  round: 0,
  endsAt: null,
  remaining: 25 * 60,
};

let state: Pomodoro = load();
const listeners = new Set<() => void>();

function phaseSeconds(phase: CafePhase, settings: Durations) {
  const minutes = phase === "focus" ? settings.focusMin : phase === "short" ? settings.shortMin : settings.longMin;
  return Math.max(1, minutes) * 60;
}

function after(phase: CafePhase, round: number): { phase: CafePhase; round: number } {
  if (phase === "focus") {
    const nextRound = round + 1;
    return { round: nextRound, phase: nextRound % 4 === 0 ? "long" : "short" };
  }
  return { phase: "focus", round };
}

function load(): Pomodoro {
  if (typeof localStorage === "undefined") return IDLE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return IDLE;
    const parsed = JSON.parse(raw) as Partial<Pomodoro>;
    const phase = parsed.phase === "short" || parsed.phase === "long" ? parsed.phase : "focus";
    return {
      running: Boolean(parsed.running && parsed.endsAt),
      phase,
      round: typeof parsed.round === "number" && parsed.round >= 0 ? parsed.round : 0,
      endsAt: typeof parsed.endsAt === "number" ? parsed.endsAt : null,
      remaining: typeof parsed.remaining === "number" && parsed.remaining >= 0 ? parsed.remaining : IDLE.remaining,
    };
  } catch {
    return IDLE;
  }
}

function persist() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function emit() {
  persist();
  listeners.forEach((listener) => listener());
}

function same(a: Pomodoro, b: Pomodoro) {
  return (
    a.running === b.running &&
    a.phase === b.phase &&
    a.round === b.round &&
    a.endsAt === b.endsAt &&
    a.remaining === b.remaining
  );
}

/** Move a running timer forward to `now`, including phases that ended while the page was closed. */
export function projectPomodoro(current: Pomodoro, settings: Durations, now: number) {
  if (!current.running || current.endsAt == null) return { state: current, crossed: 0 };
  let phase = current.phase;
  let round = current.round;
  let endsAt = current.endsAt;
  let crossed = 0;
  while (now >= endsAt && crossed < 20000) {
    crossed += 1;
    const next = after(phase, round);
    phase = next.phase;
    round = next.round;
    const seconds = phaseSeconds(phase, settings);
    if (!settings.autoStart) {
      return {
        crossed,
        state: { running: false, phase, round, endsAt: null, remaining: seconds },
      };
    }
    endsAt += seconds * 1000;
  }
  return {
    crossed,
    state: {
      running: true,
      phase,
      round,
      endsAt,
      remaining: Math.max(0, Math.ceil((endsAt - now) / 1000)),
    },
  };
}

export function getPomodoro() {
  return state;
}

export function subscribePomodoro(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePomodoro() {
  return useSyncExternalStore(subscribePomodoro, getPomodoro, () => IDLE);
}

/** Returns how many phase boundaries were crossed. */
export function advancePomodoro(settings: Durations, now = Date.now()) {
  const next = projectPomodoro(state, settings, now);
  if (next.crossed === 0 && same(next.state, state)) return 0;
  state = next.state;
  emit();
  return next.crossed;
}

export function togglePomodoro(settings: Durations, now = Date.now()) {
  if (state.running && state.endsAt != null) {
    state = {
      ...state,
      running: false,
      endsAt: null,
      remaining: Math.max(0, Math.ceil((state.endsAt - now) / 1000)),
    };
  } else {
    const remaining = state.remaining > 0 ? state.remaining : phaseSeconds(state.phase, settings);
    state = { ...state, running: true, remaining, endsAt: now + remaining * 1000 };
  }
  emit();
}

export function stopPomodoro(settings: Durations) {
  state = {
    ...state,
    running: false,
    endsAt: null,
    remaining: phaseSeconds(state.phase, settings),
  };
  emit();
}

export function resetPomodoro(settings: Durations) {
  state = {
    running: false,
    phase: "focus",
    round: 0,
    endsAt: null,
    remaining: phaseSeconds("focus", settings),
  };
  emit();
}

export function syncIdleDuration(settings: Durations) {
  if (state.running) return;
  const remaining = phaseSeconds(state.phase, settings);
  if (remaining === state.remaining) return;
  state = { ...state, remaining, endsAt: null };
  emit();
}
