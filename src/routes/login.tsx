import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

const google = GROK_PROVIDERS.find((provider) => provider.idp === "google");

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted && !isPending && user) return <Navigate to="/" />;

  async function onGoogle() {
    if (!google) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(google.providerId, { callbackURL: "/", errorCallbackURL: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти через Google.");
      setBusy(false);
    }
  }

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    if (!authEnabled) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0] || "Писатель",
        });
        if (signUpError) throw new Error(signUpError.message ?? "Не удалось создать аккаунт.");
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: true,
        });
        if (signInError) throw new Error(signInError.message ?? "Не удалось войти.");
      }
      await authClient.getSession();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так.");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-y-auto bg-ink text-paper">
      <div className="absolute inset-0">
        <img src="/wallpaper-autumn.gif" alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-ink/45" />
        <div className="noise-film absolute inset-0 opacity-40 mix-blend-multiply" />
      </div>

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-xl bg-window p-5 text-ink shadow-[var(--shadow-window)] md:p-6">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {mode === "in" ? "Вход" : "Создать аккаунт"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "in"
              ? "Войдите, чтобы ваши проекты всегда были с вами."
              : "Создайте аккаунт, чтобы рукописи хранились вместе с вами."}
          </p>

          {!authEnabled ? (
            <p className="mt-6 text-sm text-muted">Вход отключён.</p>
          ) : !mounted || isPending ? (
            <div className="mt-6 h-40 animate-pulse rounded-md bg-paper-deep/70" />
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                disabled={busy}
                onClick={() => void onGoogle()}
              >
                Продолжить с Google
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs tracking-wide text-muted uppercase">
                <span className="h-px flex-1 bg-line/80" />
                или по почте
                <span className="h-px flex-1 bg-line/80" />
              </div>

              <form onSubmit={(event) => void onEmail(event)} className="flex flex-col gap-3">
                {mode === "up" ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">Имя</span>
                    <input
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="folio-control text-sm"
                    />
                  </label>
                ) : null}
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">Почта</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="folio-control text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">Пароль</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="folio-control text-sm"
                  />
                </label>
                {error ? <p className="text-sm text-rust">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Подождите…" : mode === "in" ? "Войти" : "Создать аккаунт"}
                </Button>
              </form>

              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                }}
              >
                {mode === "in" ? "Нет аккаунта? Создайте" : "Уже есть аккаунт? Войдите"}
              </button>
            </>
          )}

          <Link
            to="/"
            className="mt-5 block text-center text-sm text-muted hover:text-ink"
          >
            Продолжить как гость
          </Link>
        </div>
      </div>
    </main>
  );
}
