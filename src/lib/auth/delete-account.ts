import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { password?: string }) => ({ password: data?.password?.trim() ?? "" }))
  .handler(async ({ data, context }) => {
    const { removeAccount } = await import("./delete-account.server");
    try {
      return await removeAccount(context.userId, data.password);
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Не удалось удалить учётную запись.",
      };
    }
  });
