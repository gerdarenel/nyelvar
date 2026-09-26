import { useEffect, useRef } from "react";
import { advancePomodoro } from "@/lib/cafe-timer";
import { useFolioStore } from "@/lib/store";

/** Keeps the pomodoro on the wall clock even if the café window or the browser tab is closed. */
export function CafeTimerKeeper() {
  const cafe = useFolioStore((state) => state.cafe);
  const chime = useRef<HTMLAudioElement | null>(null);
  const cafeRef = useRef(cafe);
  cafeRef.current = cafe;

  useEffect(() => {
    const audio = new Audio("/cafe-chime.mp3");
    audio.preload = "auto";
    chime.current = audio;
    const unlock = () => {
      audio.muted = true;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      audio.pause();
      chime.current = null;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const crossed = advancePomodoro(cafeRef.current);
      if (crossed <= 0) return;
      const audio = chime.current;
      if (!audio) return;
      audio.muted = false;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return null;
}
