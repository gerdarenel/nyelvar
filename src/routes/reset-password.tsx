import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const [token, setToken] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInvalid(Boolean(params.get("error")));
    setToken(params.get("token"));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }
    if (password !== again) {
      setError("Пароли не совпадают.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) throw new Error(resetError.message ?? "Не удалось сохранить пароль.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить пароль.");
      setBusy(false);
    }
  }

  const missing = invalid || token === "";

  return (
    <main className="relative min-h-dvh overflow-y-auto bg-ink text-paper">
      <div className="absolute inset-0">
        <img src="/wallpaper-autumn-still.png" alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-ink/45" />
      </div>
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-window p-5 text-ink shadow-[var(--shadow-window)] md:p-6">
          <h1 className="font-display text-xl font-semibold tracking-tight">Новый пароль</h1>
          {done ? (
            <>
              <p className="mt-3 text-sm text-muted">Пароль обновлён. Теперь можно войти.</p>
              <Link to="/login" className="mt-5 block text-center text-sm text-ink hover:underline">
                Ко входу
              </Link>
            </>
          ) : missing ? (
            <>
              <p className="mt-3 text-sm text-muted">Ссылка недействительна или устарела. Запросите новую.</p>
              <Link to="/login" className="mt-5 block text-center text-sm text-ink hover:underline">
                Ко входу
              </Link>
            </>
          ) : token ? (
            <form onSubmit={(event) => void onSubmit(event)} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted">Новый пароль</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="folio-control text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted">Ещё раз</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={again}
                  onChange={(event) => setAgain(event.target.value)}
                  className="folio-control text-sm"
                />
              </label>
              {error ? <p className="text-sm text-rust">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Подождите…" : "Сохранить пароль"}
              </Button>
            </form>
          ) : (
            <div className="mt-6 h-24 animate-pulse bg-paper-deep/70" />
          )}
        </div>
      </div>
    </main>
  );
}
