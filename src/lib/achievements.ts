import {
  getProgress,
  readingActivity,
  writingPasses,
  writingStreak,
  type Book,
  type ReadingBook,
} from "@/lib/folio";

export type AwardIcon =
  | "quill"
  | "shelf"
  | "book"
  | "month"
  | "pages"
  | "chapter"
  | "half"
  | "almost"
  | "finish"
  | "ribbon"
  | "stack"
  | "day"
  | "pen"
  | "read";

export type AwardKind = "write" | "read";

export type Award = {
  id: string;
  title: string;
  icon: AwardIcon;
  image?: string;
  kind: AwardKind;
  unlocked: boolean;
  count: number;
  message: string;
};

export function buildAwards(books: Book[], shelf: ReadingBook[]): Award[] {
  const passes = books.flatMap((book) => writingPasses(book));
  const progress = passes.map((book) => ({ book, progress: getProgress(book) }));
  const totals = progress.map((item) => item.progress);
  const readCount = shelf.filter((book) => book.status === "read").length;
  const doneCount = books.filter((book) => book.tag === "done").length;
  const byMonth = new Map<string, number>();
  for (const book of shelf) {
    if (book.status !== "read" || !book.finishedAt) continue;
    const key = book.finishedAt.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const monthTotals = [...byMonth.values()];
  const monthsAt = (n: number) => monthTotals.filter((count) => count >= n).length;
  const byDate = new Map<string, number>();
  for (const book of passes) {
    for (const record of book.records) {
      if (record.words <= 0) continue;
      byDate.set(record.date, (byDate.get(record.date) ?? 0) + record.words);
    }
  }
  const dayTotals = [...byDate.values()];
  const daysAt = (n: number) => dayTotals.filter((count) => count >= n).length;
  const writeStreak = writingStreak(
    passes.flatMap((book) => book.records).filter((record) => record.words > 0),
  );
  const readStreak = readingActivity(shelf).streak;
  const chapterShare = (ratio: number) =>
    progress.filter((item) => {
      const total = Math.max(1, item.book.chapterCount);
      return item.progress.completedCount / total >= ratio;
    }).length;
  const chapterBooks = progress.filter((item) => item.progress.completedCount >= 1).length;
  const halfBooks = chapterShare(0.5);
  const ninetyBooks = chapterShare(0.9);
  const finishedBooks = totals.filter((item) => item.allDone).length;
  const awards: Award[] = [];

  const push = (kind: AwardKind, award: Omit<Award, "kind" | "unlocked">) => {
    awards.push({ ...award, kind, unlocked: award.count > 0 });
  };

  const bookWords = totals.map((item) => item.totalWords);
  const booksAt = (n: number) => bookWords.filter((value) => value >= n).length;

  push("write", {
    id: "first-book",
    title: "Первая рукопись",
    icon: "quill",
    image: "/awards/001.png",
    count: books.length > 0 ? 1 : 0,
    message: "Поздравляю с началом новой истории! Не бросай ее, я буду за тобой следить 🐈‍⬛",
  });
  push("read", {
    id: "read-1",
    title: "Первая книга прочитана",
    icon: "book",
    image: "/awards/020.png",
    count: readCount > 0 ? 1 : 0,
    message: "Надеюсь она тебе понравилась! Ну, или хотя бы пополнила твой словарный запас.",
  });
  push("read", {
    id: "read-10",
    title: "Прочитано 10 книг",
    icon: "book",
    image: "/awards/021.png",
    count: readCount >= 10 ? 1 : 0,
    message: "Продолжай в том же духе, ты умнеешь на глазах.",
  });
  push("read", {
    id: "read-50",
    title: "Прочитано 50 книг",
    icon: "book",
    image: "/awards/022.png",
    count: readCount >= 50 ? 1 : 0,
    message: "Твоя книжная полка пополнилась прочитанным! И даже если вся она забита эротикой — я не осуждаю. 🐱",
  });
  push("read", {
    id: "read-100",
    title: "Прочитано 100 книг",
    icon: "book",
    image: "/awards/023.png",
    count: readCount >= 100 ? 1 : 0,
    message: "Властью, данной мне городом Нельвар, я посвящаю тебя в чтецы-мудрецы! Ты настоящий герой!",
  });
  push("read", {
    id: "month-1",
    title: "Одна книга за месяц",
    icon: "month",
    image: "/awards/024.png",
    count: monthsAt(1),
    message:
      "Одна книга в месяц — это двеннадцать книг в год. Двеннадцать книг — это больше, чем ноль... к чему я вел? Поздравляю с прочитанным!",
  });
  push("read", {
    id: "month-5",
    title: "5 книг за месяц",
    icon: "month",
    image: "/awards/025.png",
    count: monthsAt(5),
    message: "В этом месяце ты в ударе. Не забывай не только читать истории, но и писать их.",
  });
  push("read", {
    id: "month-10",
    title: "10 книг за месяц",
    icon: "month",
    image: "/awards/026.png",
    count: monthsAt(10),
    message:
      "У тебя все хорошо? 10 книг за месяц — чудовищно круто, я бы никогда так не смог! Но на всякий случай посылаю тебе пиксельные объятия.",
  });

  push("write", {
    id: "words-10000",
    title: "В рукописи 10к слов",
    icon: "pages",
    image: "/awards/002.png",
    count: booksAt(10_000),
    message: "Первые 10 тысяч слов позади. Продолжай писать, я читаю. Мне нравится. 💖",
  });
  push("write", {
    id: "words-50000",
    title: "В рукописи 50к слов",
    icon: "pages",
    image: "/awards/003.png",
    count: booksAt(50_000),
    message:
      "Уже 50 тысяч слов написано! Где-то здесь история может казаться непреодолимыми зарослями из сюжетных веток, идей и непослушных персонажей. Не сдавайся, даже если становится тяжело — любой книге нужно время, ты еще успеешь довести ее до своего \"идеала\". 🐈‍⬛",
  });
  push("write", {
    id: "words-100000",
    title: "В рукописи 100к слов",
    icon: "pages",
    image: "/awards/004.png",
    count: booksAt(100_000),
    message: "100 тысяч слов! Да у тебя намечается настоящий гигант.",
  });
  push("write", {
    id: "chapter-1",
    title: "Готова первая глава",
    icon: "chapter",
    image: "/awards/005.png",
    count: chapterBooks,
    message: "Первая глава новой истории закончена! Скорее, продолжай писать. Я хочу узнать, что там дальше.",
  });
  push("write", {
    id: "mid",
    title: "Середина рукописи",
    icon: "half",
    image: "/awards/006.png",
    count: halfBooks,
    message: "А вот и мидпоинт. В этот раз ты точно доведешь рукопись до конца.",
  });
  push("write", {
    id: "ninety",
    title: "Готово 90% рукописи",
    icon: "almost",
    image: "/awards/007.png",
    count: ninetyBooks,
    message: "Не опускать руки! Осталось чуть-чуть. Давай, я хочу увидеть, как ты закончишь эту историю.",
  });
  push("write", {
    id: "manuscript-done",
    title: "Новая рукопись завершена",
    icon: "finish",
    image: "/awards/008.png",
    count: finishedBooks,
    message:
      "Наливай шампанское! Зови музыкантов! Запускай фейерверки! Твоя рукопись закончена, и да-а-аже если впереди тебя ждет еще восемь кругов редактуры, важно одно — книга написана!",
  });
  push("write", {
    id: "tagged-done",
    title: "Новая законченная книга",
    icon: "ribbon",
    image: "/awards/009.png",
    count: doneCount,
    message:
      "Жму тебе лапу и стелю перед тобой красную дорожку. Книга не только написана, но и отредактирована. Слышишь топот ног? Это читатели бегут, чтобы скорее погрузиться в новую историю! 🐈‍⬛",
  });
  push("write", {
    id: "day-1000",
    title: "1000 слов за день",
    icon: "day",
    image: "/awards/010.png",
    count: daysAt(1000),
    message:
      "Да ты просто машина! Или лучше сказать печатная машинка? В любом случае, я неимоверно тобой горжусь. 🍸",
  });

  const writeLines: Record<number, { title: string; message: string; image: string }> = {
    7: {
      title: "7 дней писательства подряд",
      image: "/awards/011.png",
      message: "Семь дней, ни единого пропуска. Мне нравится твой настрой!",
    },
    30: {
      title: "30 дней писательства подряд",
      image: "/awards/012.png",
      message: "Воу, ты не пропустил ни дня писательства за последний месяц! Такими темпами любая рукопись будет побеждена.",
    },
    100: {
      title: "100 дней писательства подряд",
      image: "/awards/013.png",
      message:
        "Либо книга захватила тебя с головой, либо ты идешь на получение ачивки \"железная задница\". К сожалению, такого достижения здесь нет. Но продолжай в том же духе и не забывай следить за своим здоровьем!",
    },
    180: {
      title: "180 дней писательства подряд",
      image: "/awards/014.png",
      message: "Я рукоплещу твоему упорству! Или, скорее, лапоплещу. Хочешь попробовать писать каждый день целый год?",
    },
    365: {
      title: "Целый год ежедневного писательства!",
      image: "/awards/015.png",
      message:
        "Твой уровень мастерства безусловно вырос за это время. Обязательно отпразднуй это событие и отдохни. 🐈‍⬛",
    },
  };
  for (const n of [7, 30, 100, 180, 365]) {
    const line = writeLines[n];
    push("write", {
      id: `write-streak-${n}`,
      title: line.title,
      icon: "pen",
      image: line.image,
      count: writeStreak >= n ? 1 : 0,
      message: line.message,
    });
  }
  const readLines: Record<number, { title: string; message: string; image: string }> = {
    7: {
      title: "7 дней подряд за чтением",
      image: "/awards/027.png",
      message: "Неделя чтения. Ты на верном пути, чтобы стать книжным червем!",
    },
    30: {
      title: "30 дней подряд за чтением",
      image: "/awards/028.png",
      message: "Надеюсь, среди этих страниц тебе встретилось что-то, что захотелось сохранить. Продолжай в том же духе!",
    },
    100: {
      title: "100 дней подряд за чтением",
      image: "/awards/029.png",
      message:
        "Стодневный челлендж чтения успешно выполнен, даже если у тебя не было намерения его проходить! Ну, что еще сказать? Встретимся в ачивке на 180 дней.",
    },
    180: {
      title: "180 дней подряд за чтением",
      image: "/awards/030.png",
      message:
        "Мне интересно, что ты читаешь каждый день вот уже полгода. Фэнтези? Детективы? Нон-фикшн? СЛР? В любом случае, если сможешь читать подряд каждый день целый год, получишь от меня хокку.",
    },
    365: {
      title: "365 дней подряд за чтением",
      image: "/awards/031.png",
      message:
        "Целый год в обнимку с книгами! Ты просто мастер чтения. Величайший читатель из всех читателей. Я руко... лапоплещу тебе! А вот и обещанное хокку:\n\nКнига на столе.\nЯ прочту ещё главу.\nУже рассвело.",
    },
  };
  for (const n of [7, 30, 100, 180, 365]) {
    const line = readLines[n];
    push("read", {
      id: `read-streak-${n}`,
      title: line.title,
      icon: "read",
      image: line.image,
      count: readStreak >= n ? 1 : 0,
      message: line.message,
    });
  }

  return awards;
}
