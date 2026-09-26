export async function sendPasswordResetEmail(to: string, url: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("Письмо не отправлено: у сайта не подключена почта для таких писем.");
  }
  const from = process.env.RESET_EMAIL_FROM?.trim() || "Нельвар <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Восстановление пароля — Нельвар",
      html: `<p>Чтобы задать новый пароль в Нельваре, откройте ссылку:</p><p><a href="${url}">${url}</a></p><p>Ссылка действует один час. Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail ? `Не удалось отправить письмо. ${detail}` : "Не удалось отправить письмо.");
  }
}
