import { createServerFn } from "@tanstack/react-start";

export const requestPasswordResetEmail = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => {
    const email = data?.email?.trim() ?? "";
    if (!email.includes("@")) throw new Error("Укажите почту.");
    return { email };
  })
  .handler(async ({ data }) => {
    const { deliverPasswordReset } = await import("./deliver-reset.server");
    return deliverPasswordReset(data.email);
  });
