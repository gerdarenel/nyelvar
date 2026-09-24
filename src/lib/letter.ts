import { type Book, type ReadingBook, getProgress } from "@/lib/folio";

export type MailCopy = { subject: string; body: string };

const SIGN = "на дворе 1996 год и у тебя есть все время в мире";

const CATALOG: Record<string, MailCopy> = {
  welcome: {
    subject: "Вы на месте",
    body: "Тестовое письмо: первый заход за стол.",
  },
  "first-record": {
    subject: "Первая строка",
    body: "Тестовое письмо: в трекере появилась первая запись.",
  },
  "first-read": {
    subject: "Первая прочитанная",
    body: "Тестовое письмо: первая книга отмечена прочитанной.",
  },
  "manuscript-half": {
    subject: "Середина рукописи",
    body: "Тестовое письмо: рукопись дошла до середины.",
  },
  "manuscript-ninety": {
    subject: "Почти конец",
    body: "Тестовое письмо: рукопись дошла до 90%.",
  },
  "manuscript-done": {
    subject: "Рукопись закончена",
    body: "Тестовое письмо: рукопись отмечена завершённой.",
  },
};

export function dueMailIds(books: Book[], shelf: ReadingBook[]): string[] {
  const ids = ["welcome"];
  if (books.some((book) => book.records.length > 0)) ids.push("first-record");
  const readCount = shelf.filter((book) => book.status === "read").length;
  if (readCount >= 1) ids.push("first-read");
  for (let count = 10; count <= readCount && count <= 500; count += 10) {
    ids.push(`read-${count}`);
  }
  const progresses = books.map((book) => getProgress(book));
  if (progresses.some((item) => item.allDone || item.percent >= 50)) ids.push("manuscript-half");
  if (progresses.some((item) => item.allDone || item.percent >= 90)) ids.push("manuscript-ninety");
  if (progresses.some((item) => item.allDone)) ids.push("manuscript-done");
  return ids;
}

export function mailCopy(id: string): MailCopy {
  const known = CATALOG[id];
  if (known) return known;
  const milestone = /^read-(\d+)$/.exec(id);
  if (milestone) {
    return {
      subject: `Прочитано ${milestone[1]} книг`,
      body: `Тестовое письмо: на полке уже ${milestone[1]} прочитанных книг.`,
    };
  }
  return { subject: "Письмо", body: "Тестовое письмо." };
}

export function mailBody(id: string): string {
  return `${mailCopy(id).body}\n\n${SIGN}`;
}
