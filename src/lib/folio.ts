export type TrackerTag = { id: string; label: string };

export const LOCKED_TAGS: TrackerTag[] = [
  { id: "draft1", label: "первый черновик" },
  { id: "done", label: "готово" },
  { id: "paused", label: "отложено" },
];

export const DEFAULT_TAGS: TrackerTag[] = [
  ...LOCKED_TAGS,
  { id: "draft2", label: "второй черновик" },
  { id: "edit", label: "редактура" },
];

export type WriterTab = "active" | "done" | "paused";

export function isLockedTag(id: string): boolean {
  return LOCKED_TAGS.some((tag) => tag.id === id);
}

export function withLockedTags(tags: TrackerTag[]): TrackerTag[] {
  const custom = tags.filter((tag) => tag.label.trim() && !isLockedTag(tag.id));
  return [...LOCKED_TAGS, ...custom];
}

export function writerTabOf(tag: string | null): WriterTab {
  if (tag === "done") return "done";
  if (tag === "paused") return "paused";
  return "active";
}

export type RecordPart = "chapter" | "prologue" | "epilogue";

export type WritingRecord = {
  id: string;
  date: string;
  chapter: number;
  words: number;
  note: string;
  chapterFinished: boolean;
  part?: RecordPart;
};

export function recordPart(record: Pick<WritingRecord, "part">): RecordPart {
  return record.part === "prologue" || record.part === "epilogue" ? record.part : "chapter";
}

export function recordChapterLabel(record: WritingRecord): string {
  const part = recordPart(record);
  if (part === "prologue") return "Пролог";
  if (part === "epilogue") return "Эпилог";
  return `Глава ${record.chapter}`;
}

export type ManuscriptRound = {
  id: string;
  startedAt: string;
  chapterCount: number;
  wordsPerChapter: number;
  startingWords: number;
  startingChapters: number;
  records: WritingRecord[];
};

export type Book = {
  id: string;
  title: string;
  annotation: string;
  coverSrc: string | null;
  coverDataUrl: string | null;
  startedAt: string;
  chapterCount: number;
  wordsPerChapter: number;
  startingWords: number;
  startingChapters: number;
  tag: string | null;
  cycle: string | null;
  records: WritingRecord[];
  rounds: ManuscriptRound[];
};

export type WindowId = "tracker" | "library" | "reading" | "personalize" | "account" | "notes" | "cafe" | "awards" | "tasks";

export type PlannerKind = "task" | "event";

export type PlannerItem = {
  id: string;
  date: string;
  kind: PlannerKind | null;
  text: string;
  done: boolean;
  important: boolean;
  time: string;
};

export function sanitizePlanner(value: unknown): PlannerItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<PlannerItem>;
    if (typeof row.id !== "string" || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      return [];
    }
    const kind = row.kind === "event" || row.kind === "task" ? row.kind : row.kind === null ? null : "task";
    return [
      {
        id: row.id,
        date: row.date,
        kind,
        text: typeof row.text === "string" ? row.text : "",
        done: Boolean(row.done),
        important: kind === "task" && Boolean(row.important),
        time: kind === "event" && typeof row.time === "string" ? row.time.slice(0, 5) : "",
      },
    ];
  });
}

export type CountUnit = "words" | "chars";

export type WindowBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WindowState = {
  open: boolean;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  maximized: boolean;
  restore: WindowBounds | null;
};

export type NodeStatus = "complete" | "current" | "locked";

export type PathNode = {
  n: number;
  kind: RecordPart;
  status: NodeStatus;
  words: number;
  fill: number;
};

export type BookProgress = {
  totalWords: number;
  completedCount: number;
  current: number | null;
  allDone: boolean;
  nodes: PathNode[];
  wordsInCurrent: number;
  maxUnlocked: number;
  percent: number;
};

export function roundBook(book: Book, round: ManuscriptRound): Book {
  return {
    ...book,
    startedAt: round.startedAt,
    chapterCount: round.chapterCount,
    wordsPerChapter: round.wordsPerChapter,
    startingWords: round.startingWords,
    startingChapters: round.startingChapters,
    records: round.records,
    rounds: [],
  };
}

export function writingPasses(book: Book): Book[] {
  return [...(book.rounds ?? []).map((round) => roundBook(book, round)), book];
}

export function coverOf(book: Book): string | null {
  return book.coverDataUrl || book.coverSrc;
}

export function latestBookId(books: Book[]): string | null {
  if (books.length === 0) return null;
  return books.reduce((best, book) => {
    const date = book.records.reduce(
      (latest, record) => (record.date > latest ? record.date : latest),
      book.startedAt || "",
    );
    const bestDate = best.records.reduce(
      (latest, record) => (record.date > latest ? record.date : latest),
      best.startedAt || "",
    );
    return date > bestDate ? book : best;
  }).id;
}

export function getProgress(book: Book): BookProgress {
  const startingWords = Math.max(0, book.startingWords ?? 0);
  const startingChapters = Math.min(
    book.chapterCount,
    Math.max(0, book.startingChapters ?? 0),
  );
  const loggedWords = book.records.reduce((sum, record) => sum + record.words, 0);
  const totalWords = startingWords + loggedWords;
  const finished = new Set(
    book.records
      .filter((record) => recordPart(record) === "chapter" && record.chapterFinished)
      .map((record) => record.chapter),
  );
  for (let n = 1; n <= startingChapters; n += 1) {
    finished.add(n);
  }

  let current = 1;
  while (current <= book.chapterCount && finished.has(current)) {
    current += 1;
  }

  const allDone = current > book.chapterCount;
  const active = allDone ? null : current;
  const wordsInCurrent = active
    ? book.records
        .filter((record) => recordPart(record) === "chapter" && record.chapter === active)
        .reduce((sum, record) => sum + record.words, 0)
    : 0;
  const goal = Math.max(1, book.wordsPerChapter);
  const currentFill = allDone ? 1 : Math.min(1, wordsInCurrent / goal);

  const chapterNodes: PathNode[] = Array.from({ length: book.chapterCount }, (_, index) => {
    const n = index + 1;
    const words = book.records
      .filter((record) => recordPart(record) === "chapter" && record.chapter === n)
      .reduce((sum, record) => sum + record.words, 0);
    const status: NodeStatus = allDone || n < current ? "complete" : n === current ? "current" : "locked";
    const fill = status === "complete" ? 1 : status === "current" ? currentFill : 0;
    return { n, kind: "chapter", status, words, fill };
  });

  const extra = (kind: "prologue" | "epilogue", n: number): PathNode | null => {
    const rows = book.records.filter((record) => recordPart(record) === kind);
    if (rows.length === 0) return null;
    const words = rows.reduce((sum, record) => sum + record.words, 0);
    const done = rows.some((record) => record.chapterFinished);
    return {
      n,
      kind,
      words,
      status: done ? "complete" : "current",
      fill: done ? 1 : Math.min(1, words / goal),
    };
  };
  const prologue = extra("prologue", 0);
  const epilogue = extra("epilogue", book.chapterCount + 1);
  const nodes = [prologue, ...chapterNodes, epilogue].filter((node): node is PathNode => node !== null);

  const completedCount = chapterNodes.filter((node) => node.status === "complete").length;
  const maxUnlocked = allDone ? book.chapterCount : current;
  const extraDone = [prologue, epilogue].filter((node) => node?.status === "complete").length;
  const extraFill = [prologue, epilogue].reduce((sum, node) => sum + (node && node.status !== "complete" ? node.fill : 0), 0);
  const totalUnits = book.chapterCount + (prologue ? 1 : 0) + (epilogue ? 1 : 0);
  const chapterFraction = allDone ? book.chapterCount : completedCount + currentFill;
  const fraction = (chapterFraction + extraDone + extraFill) / Math.max(1, totalUnits);
  const percent = Math.round(Math.min(100, Math.max(0, fraction * 100)));

  return {
    totalWords,
    completedCount,
    current: active,
    allDone,
    nodes,
    wordsInCurrent,
    maxUnlocked,
    percent,
  };
}

export function formatWords(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function ruPlural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} ${one}`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function finishedChapterSet(book: Book): Set<number> {
  const finished = new Set(
    book.records
      .filter((record) => recordPart(record) === "chapter" && record.chapterFinished)
      .map((record) => record.chapter),
  );
  const starting = Math.min(book.chapterCount, Math.max(0, book.startingChapters ?? 0));
  for (let n = 1; n <= starting; n += 1) finished.add(n);
  return finished;
}

export function wordsByDate(records: WritingRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const record of records) {
    map.set(record.date, (map.get(record.date) ?? 0) + record.words);
  }
  return map;
}

export function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDay(iso: string, delta: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return localDay(date);
}

export function writingStreak(records: WritingRecord[], today = localDay()): number {
  const days = new Set(records.map((record) => record.date));
  if (days.size === 0) return 0;
  let cursor = today;
  if (!days.has(cursor)) {
    cursor = shiftDay(cursor, -1);
    if (!days.has(cursor)) return 0;
  }
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export function streakLabel(count: number): string {
  const n10 = count % 10;
  const n100 = count % 100;
  if (n10 === 1 && n100 !== 11) return "день подряд";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "дня подряд";
  return "дней подряд";
}

export function clampChapters(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(40, Math.max(1, Math.round(value)));
}

export function clampWordsPerChapter(value: number): number {
  if (!Number.isFinite(value)) return 2000;
  return Math.min(50000, Math.max(50, Math.round(value)));
}

export function clampStartingWords(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.round(value)));
}

export function clampStartingChapters(value: number, chapterCount: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(chapterCount, Math.max(0, Math.round(value)));
}

export function parseNumberInput(value: string, fallback: number): number {
  if (value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function acceptNumberDraft(value: string): boolean {
  return value === "" || /^\d+$/.test(value);
}

export function fileToImageDataUrl(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      let width = image.width;
      let height = image.height;
      if (width > max || height > max) {
        const scale = max / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read cover"));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read cover"));
    };
    image.src = url;
  });
}

export function fileToCoverDataUrl(file: File): Promise<string> {
  return fileToImageDataUrl(file, 640);
}

export function fileToWallpaperDataUrl(file: File): Promise<string> {
  const gif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
  if (!gif) return fileToImageDataUrl(file, 1400);
  if (file.size > 5_000_000) return Promise.reject(new Error("gif-too-big"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read wallpaper"));
    reader.readAsDataURL(file);
  });
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const SEED_BOOKS: Book[] = [
  {
    id: "orchard",
    title: "Последний сад",
    annotation:
      "Картограф возвращается в деревню на последний урожай и чертит рощи, которые не переживут зиму.",
    coverSrc: "/covers/orchard.jpg",
    coverDataUrl: null,
    startedAt: "2026-09-01",
    chapterCount: 12,
    wordsPerChapter: 2500,
    startingWords: 0,
    startingChapters: 0,
    tag: "draft2",
    cycle: null,
    rounds: [],
    records: [
      {
        id: "r1",
        date: "2026-09-01",
        chapter: 1,
        words: 820,
        note: "Первая прогулка по рощам.",
        chapterFinished: false,
      },
      { id: "r2", date: "2026-09-03", chapter: 1, words: 910, note: "", chapterFinished: false },
      {
        id: "r3",
        date: "2026-09-05",
        chapter: 1,
        words: 870,
        note: "Закрыла первую карту.",
        chapterFinished: true,
      },
      { id: "r4", date: "2026-09-08", chapter: 2, words: 640, note: "", chapterFinished: false },
      {
        id: "r5",
        date: "2026-09-12",
        chapter: 2,
        words: 1100,
        note: "Пруд у мельницы в дождь.",
        chapterFinished: false,
      },
      { id: "r6", date: "2026-09-16", chapter: 2, words: 780, note: "", chapterFinished: true },
      { id: "r7", date: "2026-09-18", chapter: 3, words: 420, note: "", chapterFinished: false },
      {
        id: "r8",
        date: "2026-09-20",
        chapter: 3,
        words: 310,
        note: "Картографа держать холоднее.",
        chapterFinished: false,
      },
    ],
  },
  {
    id: "mill",
    title: "Письма с мельницы",
    annotation:
      "Неотправленная переписка мельника, который держит реку и город в разговоре.",
    coverSrc: "/covers/mill.jpg",
    coverDataUrl: null,
    startedAt: "2026-09-12",
    chapterCount: 8,
    wordsPerChapter: 1800,
    startingWords: 0,
    startingChapters: 0,
    tag: "draft1",
    cycle: null,
    rounds: [],
    records: [],
  },
];

export type ReadingStatus = "reading" | "read" | "want" | "dropped";

export const READING_STATUSES: { id: ReadingStatus; label: string }[] = [
  { id: "reading", label: "читаю" },
  { id: "read", label: "прочитано" },
  { id: "want", label: "хочу прочитать" },
  { id: "dropped", label: "брошено" },
];

export type JournalSticker = {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  w: number;
  h?: number;
  rotation: number;
};

export type Quote = {
  id: string;
  text: string;
  source: string;
};

export type PageLogEntry = { date: string; pages: number };

export type ReadingBook = {
  id: string;
  title: string;
  author: string;
  coverSrc: string | null;
  coverDataUrl: string | null;
  status: ReadingStatus;
  note: string;
  journalText: string;
  stickers: JournalSticker[];
  quotes: Quote[];
  pagesRead: number;
  pagesTotal: number;
  pageLog: PageLogEntry[];
  rating: number | null;
  finishedAt: string | null;
};

export function readingCoverOf(book: ReadingBook): string | null {
  return book.coverDataUrl || book.coverSrc;
}

export function readingPercent(book: ReadingBook): number {
  const total = Math.max(0, book.pagesTotal ?? 0);
  const read = Math.max(0, book.pagesRead ?? 0);
  if (book.status === "read" && total <= 0) return 100;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((read / total) * 100));
}

export function bumpPageLog(log: PageLogEntry[] | undefined, delta: number, date = localDay()): PageLogEntry[] {
  const next = [...(log ?? [])];
  if (!delta) return next;
  const index = next.findIndex((entry) => entry.date === date);
  const pages = (index >= 0 ? next[index].pages : 0) + delta;
  if (pages === 0) {
    if (index >= 0) next.splice(index, 1);
    return next;
  }
  if (index >= 0) next[index] = { date, pages };
  else next.push({ date, pages });
  return next;
}

export function readingActivity(shelf: ReadingBook[], today = localDay()) {
  const byDate = new Map<string, number>();
  const covers = new Map<string, ReadingBook[]>();
  for (const book of shelf) {
    for (const entry of book.pageLog ?? []) {
      byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.pages);
      if (entry.pages > 0) {
        const list = covers.get(entry.date) ?? [];
        if (!list.some((item) => item.id === book.id)) list.push(book);
        covers.set(entry.date, list);
      }
    }
  }
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  let day = 0;
  let monthTotal = 0;
  let yearTotal = 0;
  for (const [date, pages] of byDate) {
    const value = Math.max(0, pages);
    if (date === today) day += value;
    if (date.startsWith(month)) monthTotal += value;
    if (date.startsWith(year)) yearTotal += value;
  }
  let booksMonth = 0;
  let booksYear = 0;
  for (const book of shelf) {
    if (book.status !== "read" || !book.finishedAt) continue;
    if (book.finishedAt.startsWith(month)) booksMonth += 1;
    if (book.finishedAt.startsWith(year)) booksYear += 1;
  }
  const activeDays = [...byDate.values()].filter((pages) => pages > 0);
  const average = activeDays.length
    ? Math.round(activeDays.reduce((sum, pages) => sum + pages, 0) / activeDays.length)
    : 0;
  const active = new Set([...byDate.entries()].filter(([, pages]) => pages > 0).map(([date]) => date));
  return {
    byDate,
    covers,
    day,
    month: monthTotal,
    year: yearTotal,
    booksMonth,
    booksYear,
    average,
    streak: streakFromDays(active, today),
  };
}

function streakFromDays(days: Set<string>, today: string): number {
  if (days.size === 0) return 0;
  let cursor = today;
  if (!days.has(cursor)) {
    cursor = shiftDay(cursor, -1);
    if (!days.has(cursor)) return 0;
  }
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export function migrateReadingBook(raw: ReadingBook & { journal?: unknown[] }): ReadingBook {
  let journalText = raw.journalText ?? "";
  let stickers = raw.stickers ?? [];
  if (!journalText && Array.isArray(raw.journal)) {
    const blocks = raw.journal as { id?: string; kind?: string; text?: string; dataUrl?: string }[];
    journalText = blocks
      .filter((block) => block.kind === "text")
      .map((block) => block.text ?? "")
      .join("\n\n");
    stickers = blocks
      .filter((block) => block.kind === "image" && block.dataUrl)
      .map((block, index) => ({
        id: block.id ?? `sticker-${index}`,
        dataUrl: block.dataUrl ?? "",
        x: 14 + (index % 3) * 8,
        y: 16 + index * 12,
        w: 36,
        rotation: index % 2 === 0 ? -4 : 5,
      }));
  }
  return {
    ...raw,
    author: raw.author ?? "",
    note: raw.note ?? "",
    journalText,
    stickers,
    quotes: raw.quotes ?? [],
    pagesRead: raw.pagesRead ?? 0,
    pagesTotal: raw.pagesTotal ?? 0,
    pageLog: Array.isArray(raw.pageLog)
      ? raw.pageLog.filter(
          (entry) => entry && typeof entry.date === "string" && typeof entry.pages === "number",
        )
      : [],
    rating: raw.rating && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null,
    finishedAt: raw.finishedAt ?? null,
  };
}

export const SEED_SHELF: ReadingBook[] = [
  {
    id: "train",
    title: "Ночной поезд",
    author: "Ева Сорокина",
    coverSrc: "/covers/train.jpg",
    coverDataUrl: null,
    status: "reading",
    note: "Дорога на север в сентябре, когда окна уже темнеют к пяти.",
    journalText:
      "Глава про станцию в тумане. Запомнить запах мокрого дерева и то, как проводница считает билеты вслух.",
    stickers: [],
    quotes: [
      {
        id: "qt1",
        text: "Проводница считает билеты вслух, как будто имена станций — молитва.",
        source: "с. 41",
      },
      {
        id: "qt2",
        text: "За окном уже темнеет к пяти, и лес идёт вдоль путей, не отставая.",
        source: "с. 58",
      },
    ],
    pagesRead: 84,
    pagesTotal: 312,
    pageLog: [],
    rating: 4,
    finishedAt: null,
  },
  {
    id: "honey",
    title: "Соль и мёд",
    author: "Мария Лебедева",
    coverSrc: "/covers/honey.jpg",
    coverDataUrl: null,
    status: "read",
    note: "Кухня как карта семьи. Дочитывать не хотелось.",
    journalText: "Рецепт яблочного пирога в середине книги — не декорация, а сюжет.",
    stickers: [],
    quotes: [
      {
        id: "qh1",
        text: "Соль и мёд не спорят на языке — они вспоминают одно и то же лето.",
        source: "с. 112",
      },
    ],
    pagesRead: 248,
    pagesTotal: 248,
    pageLog: [],
    rating: 5,
    finishedAt: "2026-08-18",
  },
  {
    id: "north",
    title: "Северная тетрадь",
    author: "Илья Морозов",
    coverSrc: "/covers/north.jpg",
    coverDataUrl: null,
    status: "want",
    note: "Зимние письма из деревни, где нет почты, но есть окно.",
    journalText: "",
    stickers: [],
    quotes: [],
    pagesRead: 0,
    pagesTotal: 0,
    pageLog: [],
    rating: null,
    finishedAt: null,
  },
  {
    id: "clock",
    title: "Город без часов",
    author: "Ким Орлов",
    coverSrc: "/covers/clock.jpg",
    coverDataUrl: null,
    status: "want",
    note: "Площадь, где башня перестала считать часы, и город научился иначе.",
    journalText: "",
    stickers: [],
    quotes: [],
    pagesRead: 0,
    pagesTotal: 0,
    pageLog: [],
    rating: null,
    finishedAt: null,
  },
];
