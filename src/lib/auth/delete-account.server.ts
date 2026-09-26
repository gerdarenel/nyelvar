import { auth } from "./server";
import { getSql } from "@/lib/db";

type AuthContext = {
  password: {
    verify: (input: { hash: string; password: string }) => Promise<boolean>;
  };
  internalAdapter: {
    findAccounts: (userId: string) => Promise<{ providerId: string; password?: string | null }[]>;
    deleteUser: (userId: string) => Promise<void>;
    deleteUserSessions: (userId: string) => Promise<void>;
  };
};

export async function removeAccount(userId: string, password: string): Promise<{ ok: true }> {
  const ctx = (await auth.$context) as AuthContext;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credential = accounts.find((account) => account.providerId === "credential" && account.password);
  if (credential?.password) {
    if (!password) throw new Error("Введите текущий пароль.");
    const matches = await ctx.password.verify({ hash: credential.password, password });
    if (!matches) throw new Error("Неверный текущий пароль.");
  }

  const sql = await getSql();
  await sql`delete from folio_desks where user_id = ${userId}`;
  await ctx.internalAdapter.deleteUserSessions(userId);
  await ctx.internalAdapter.deleteUser(userId);
  return { ok: true };
}
