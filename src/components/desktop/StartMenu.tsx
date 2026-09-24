import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Grid2x2, Info, LogIn, LogOut, Palette, Settings, X } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

export function StartMenu() {
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { user, isPending } = useCurrentUserState();
  const openWindow = useFolioStore((state) => state.openWindow);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const ready = mounted && !isPending;
  const label = user?.displayName ?? user?.primaryEmail ?? "Аккаунт";
  const canSignOut = Boolean(user && authEnabled && !gateSession);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-11 items-center gap-2 rounded-sm px-2.5 text-sm font-medium tracking-wide",
          "transition-colors duration-(--motion-quick) ease-(--ease-out)",
          open ? "bg-paper/16 text-paper" : "text-paper/90 hover:bg-paper/10 hover:text-paper",
        )}
      >
        <Grid2x2 className="size-4" strokeWidth={2.2} />
        Старт
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Старт"
          className="absolute bottom-[calc(100%+0.35rem)] left-0 z-50 w-56 overflow-hidden rounded-md bg-window text-ink shadow-[var(--shadow-window)]"
        >
          <div className="flex">
            <div className="flex w-7 shrink-0 items-end justify-center bg-ink py-3">
              <span className="font-display text-xs tracking-widest text-paper/80 [writing-mode:vertical-rl] rotate-180">
                Нельвар
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col py-1.5">
              {ready && user ? (
                <p className="truncate px-3 pt-1.5 pb-1 text-sm font-medium">{label}</p>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setAbout(true);
                }}
                className="flex h-11 items-center gap-2 px-3 text-sm hover:bg-ink/6"
              >
                <Info className="size-4 text-muted" />
                О Нельваре
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  openWindow("account");
                }}
                className="flex h-11 items-center gap-2 px-3 text-sm hover:bg-ink/6"
              >
                <Settings className="size-4 text-muted" />
                Настройки
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  openWindow("personalize");
                }}
                className="flex h-11 items-center gap-2 px-3 text-sm hover:bg-ink/6"
              >
                <Palette className="size-4 text-muted" />
                Оформление
              </button>
              {!ready ? (
                <div className="mx-2 my-1 h-9 animate-pulse rounded-sm bg-paper-deep/80" />
              ) : user ? (
                canSignOut ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={signingOut}
                      onClick={() => {
                        setSigningOut(true);
                        void signOut().catch(() => setSigningOut(false));
                      }}
                      className="flex h-11 items-center gap-2 px-3 text-sm hover:bg-ink/6 disabled:cursor-wait"
                    >
                      <LogOut className="size-4 text-muted" />
                      {signingOut ? "Выходим…" : "Выйти"}
                    </button>
                  ) : null
              ) : (
                <Link
                  to="/login"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center gap-2 px-3 text-sm hover:bg-ink/6"
                >
                  <LogIn className="size-4 text-muted" />
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {about && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-title"
                className="relative w-full max-w-md bg-window p-5 text-ink shadow-[var(--shadow-window)]"
              >
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => setAbout(false)}
                  className="absolute top-2 right-2 flex size-8 items-center justify-center text-muted hover:text-ink"
                >
                  <X className="size-4" />
                </button>
                <h2 id="about-title" className="pr-8 font-display text-xl font-semibold tracking-tight">
                  Добро пожаловать в Нельвар!
                </h2>
                <p className="mt-3 text-sm leading-relaxed">
                  Вы находитесь в фэнтези-городке, где у вас есть писательский уголок и все время в мире, чтобы погрузиться в свои книги или почитать чужие. Зарегистрируйтесь в системе, чтобы ничего не потерять.
                </p>
                <p className="mt-4 text-sm text-ink/45">тгк: герда ренель</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
