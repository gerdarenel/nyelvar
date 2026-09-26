import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { authClient, authEnabled, clearLocalSession, linkGoogleAccount } from "@/lib/auth/client";
import { deleteMyAccount } from "@/lib/auth/delete-account";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useFolioStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type LinkedAccount = { providerId: string };

export function AccountSettings() {
  const { user, isPending } = useCurrentUserState();
  const closeWindow = useFolioStore((state) => state.closeWindow);
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.primaryEmail ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const googleLinked = accounts.some((account) => account.providerId === "grok-google");
  const hasPassword = accounts.some((account) => account.providerId === "credential");

  useEffect(() => {
    setName(user?.displayName ?? "");
    setEmail(user?.primaryEmail ?? "");
  }, [user?.displayName, user?.primaryEmail]);

  useEffect(() => {
    if (!authEnabled || !user || user.isDevFallback) return;
    let cancelled = false;
    void authClient.listAccounts().then((result) => {
      if (cancelled || result.error || !result.data) return;
      setAccounts(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!user || user.isDevFallback) return;
    setError(null);
    setBusy(true);
    try {
      const nextName = name.trim();
      if (nextName && nextName !== (user.displayName ?? "")) {
        const { error: nameError } = await authClient.updateUser({ name: nextName });
        if (nameError) throw new Error(nameError.message ?? "Не удалось сохранить имя.");
      }
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== (user.primaryEmail ?? "")) {
        const { error: emailError } = await authClient.changeEmail({ newEmail: nextEmail });
        if (emailError) throw new Error(emailError.message ?? "Не удалось сменить почту.");
      }
      if (nextPassword) {
        if (nextPassword.length < 8) throw new Error("Пароль должен быть не короче 8 символов.");
        if (!currentPassword) throw new Error("Введите текущий пароль.");
        const { error: passwordError } = await authClient.changePassword({
          currentPassword,
          newPassword: nextPassword,
        });
        if (passwordError) throw new Error(passwordError.message ?? "Не удалось сменить пароль.");
      }
      await authClient.getSession();
      closeWindow("account");
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!user || user.isDevFallback || busy) return;
    setDeleteError(null);
    setBusy(true);
    try {
      const result = await deleteMyAccount({ data: { password: deletePassword } });
      if (result && "ok" in result && result.ok === false) {
        throw new Error(result.error || "Не удалось удалить учётную запись.");
      }
      clearLocalSession();
      try {
        await authClient.signOut();
      } catch {
        /* сессия уже снята вместе с учётной записью */
      }
      window.location.href = "/";
    } catch (err) {
      setDeleteError(explain(err));
      setBusy(false);
    }
  }

  async function onUnlink() {
    setError(null);
    setLinking(true);
    try {
      const { error: unlinkError } = await authClient.unlinkAccount({
        providerId: "grok-google",
      });
      if (unlinkError) throw new Error(unlinkError.message ?? "Не удалось отвязать Google.");
      const result = await authClient.listAccounts();
      if (!result.error && result.data) setAccounts(result.data);
      setConfirmUnlink(false);
    } catch (err) {
      setError(explain(err));
      setConfirmUnlink(false);
    } finally {
      setLinking(false);
    }
  }
  async function onLink() {
    setError(null);
    setLinking(true);
    try {
      await linkGoogleAccount();
      const result = await authClient.listAccounts();
      if (!result.error && result.data) setAccounts(result.data);
    } catch (err) {
      setError(explain(err));
    } finally {
      setLinking(false);
    }
  }

  if (!authEnabled) {
    return (
      <div className="folio-scroll h-full overflow-y-auto px-4 py-4 md:px-5">
        <h3 className="font-display text-xl font-semibold tracking-tight">Настройки</h3>
        <p className="mt-2 text-sm text-muted">Вход в этой сборке отключён.</p>
      </div>
    );
  }

  if (isPending) {
    return <div className="h-full animate-pulse bg-paper-deep/40" />;
  }

  if (!user) {
    return (
      <div className="folio-scroll h-full overflow-y-auto px-4 py-4 md:px-5">
        <h3 className="font-display text-xl font-semibold tracking-tight">Настройки</h3>
        <p className="mt-2 text-sm text-muted">Войдите, чтобы управлять учётной записью.</p>
        <Link to="/login" className="mt-4 inline-flex h-9 items-center px-3 text-sm hover:bg-ink/6">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSave(event)} className="flex h-full min-h-0 flex-col">
      <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        <h3 className="font-display text-xl font-semibold tracking-tight">Настройки</h3>
        <p className="mt-1 text-sm text-muted">Имя, почта, пароль и Google.</p>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Имя</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="folio-control text-sm"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Почта</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="folio-control text-sm"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Текущий пароль</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className="folio-control text-sm"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Новый пароль</span>
          <input
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={hasPassword ? "Оставьте пустым, чтобы не менять" : "Если пароль ещё не задан"}
            className="folio-control text-sm"
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Если вы забыли пароль, напишите в личные сообщения телеграм-канала{" "}
          <a
            href="https://t.me/gerdarenelle"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-muted/60 underline-offset-2 hover:text-ink"
          >
            gerdarenelle
          </a>{" "}
          с просьбой о восстановлении.
        </p>

        <div className="mt-4">
          <p className="text-xs font-medium text-muted">Google</p>
          {googleLinked ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="min-w-0 text-sm">
                Прикреплён
                {user.primaryEmail ? <span className="text-muted"> · {user.primaryEmail}</span> : null}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-rust"
                disabled={linking || busy}
                onClick={() => setConfirmUnlink(true)}
              >
                Отвязать
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={linking || busy}
              onClick={() => void onLink()}
            >
              {linking ? "Открываем Google…" : "Прикрепить Google"}
            </Button>
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-rust">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => closeWindow("account")}>
            Отмена
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-t border-rust/40 px-4 py-3">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center bg-[#9b2c2c] text-sm text-[#faf6f4] hover:bg-[#7f2424]"
          onClick={() => {
            setDeletePassword("");
            setDeleteError(null);
            setConfirmDelete(true);
          }}
        >
          Удалить учётную запись
        </button>
      </div>

      <ConfirmDialog
        open={confirmUnlink}
        title="Отвязать Google?"
        description="Вход через Google для этой учётной записи будет отключён. Почта и пароль останутся."
        onCancel={() => setConfirmUnlink(false)}
        onConfirm={() => void onUnlink()}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Удалить учётную запись?"
        description="Вход по этой почте перестанет работать. Рукописи на этом устройстве останутся, на сервере — нет."
        confirmClassName="bg-[#9b2c2c] text-[#faf6f4] hover:bg-[#7f2424]"
        onCancel={() => {
          if (busy) return;
          setConfirmDelete(false);
          setDeleteError(null);
        }}
        onConfirm={() => void onDelete()}
      >
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Текущий пароль, если вход по паролю</span>
          <input
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            autoComplete="current-password"
            className="folio-control text-sm"
          />
        </label>
        {deleteError ? <p className="mt-2 text-sm text-[#9b2c2c]">{deleteError}</p> : null}
      </ConfirmDialog>
    </form>
  );
}

function explain(err: unknown): string {
  const message = err instanceof Error ? err.message : "Что-то пошло не так.";
  const lower = message.toLowerCase();
  if (lower.includes("invalid password") || lower.includes("invalid_password")) {
    return "Неверный текущий пароль.";
  }
  if (lower.includes("too short") || lower.includes("password_too_short")) {
    return "Пароль должен быть не короче 8 символов.";
  }
  if (lower.includes("credential")) {
    return "К этой учётной записи ещё не привязан пароль.";
  }
  if (lower.includes("email is the same")) return "Эта почта уже указана.";
  if (lower.includes("failed_to_unlink") || lower.includes("last account") || lower.includes("unlink")) {
    return "Нельзя отвязать единственный способ входа. Сначала задайте пароль.";
  }
  return message;
}
