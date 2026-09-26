import { randomBytes, randomUUID } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { sendPasswordResetEmail } from "./send-reset-email.server";

function appOrigin(): string {
  const request = getRequest();
  if (!request) throw new Error("Не удалось отправить письмо.");
  const origin = request.headers.get("origin");
  if (origin) {
    const url = new URL(origin);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  }
  return new URL(request.url).origin;
}

/** Create a reset token and send the link. Missing accounts stay silent. */
export async function deliverPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const sql = await getSql();
  const users = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${normalized} limit 1
  `;
  const user = users[0];
  if (!user) return { ok: true };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await sql`
    insert into "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
    values (
      ${randomUUID()},
      ${`reset-password:${token}`},
      ${user.id},
      ${expiresAt.toISOString()},
      now(),
      now()
    )
  `;
  const url = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendPasswordResetEmail(normalized, url);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Не удалось отправить письмо.",
    };
  }
  return { ok: true };
}
