import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CAFE, type CafeSettings } from "@/lib/cafe-audio";
import {
  type Book,
  type ReadingBook,
  type ReadingStatus,
  type WindowBounds,
  type WindowId,
  type CountUnit,
  type WindowState,
  type WritingRecord,
  type TrackerTag,
  type PlannerItem,
  type PlannerKind,
  sanitizePlanner,
  DEFAULT_TAGS,
  withLockedTags,
  clampChapters,
  clampWordsPerChapter,
  clampStartingWords,
  clampStartingChapters,
  migrateReadingBook,
  bumpPageLog,
  localDay,
  newId,
} from "@/lib/folio";
import { dueMailIds } from "@/lib/letter";
import { type ThemeId, type ColorScheme, themeOf } from "@/lib/theme";
import type { DeskPayload } from "@/lib/folio-desk";

type Windows = Record<WindowId, WindowState>;

type DeskNote = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

type StatId = "day" | "month" | "year" | "booksMonth" | "booksYear";

const SEED_BOOK_IDS = new Set(["orchard", "mill"]);
const SEED_SHELF_IDS = new Set(["train", "honey", "north", "clock"]);

type FolioState = {
  books: Book[];
  activeBookId: string | null;
  shelf: ReadingBook[];
  activeReadingId: string | null;
  shelfFilter: ReadingStatus;
  libraryPane: "stats" | "shelf";
  readingStats: StatId[];
  readingStatsV: number;
  countUnit: CountUnit;
  windows: Windows;
  nextZ: number;
  themeId: ThemeId;
  colorScheme: ColorScheme;
  wallpaperSrc: string | null;
  wallpaperMotion: boolean;
  customWallpaper: string | null;
  inbox: { id: string; arrivedAt: string }[];
  cafe: CafeSettings;
  tags: TrackerTag[];
  notes: DeskNote[];
  activeNoteId: string | null;
  planner: PlannerItem[];
  hourClock: "12" | "24";
  seenAwards: Record<string, number> | null;
  setTheme: (id: ThemeId) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setWallpaper: (src: string | null) => void;
  setWallpaperMotion: (on: boolean) => void;
  setCustomWallpaper: (dataUrl: string) => void;
  syncInbox: () => void;
  setCafe: (cafe: CafeSettings) => void;
  addNote: () => string;
  updateNote: (id: string, patch: Partial<Pick<DeskNote, "title" | "body">>) => void;
  deleteNote: (id: string) => void;
  addPlannerItem: (date: string, kind: PlannerKind | null) => string;
  updatePlannerItem: (id: string, patch: Partial<Omit<PlannerItem, "id">>) => void;
  deletePlannerItem: (id: string) => void;
  reorderPlannerItem: (id: string, beforeId: string | null) => void;
  setHourClock: (clock: "12" | "24") => void;
  ackAwards: (entries: { id: string; count: number }[]) => void;
  setTrackerTags: (tags: TrackerTag[]) => void;
  addBook: () => void;
  updateBook: (id: string, patch: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  setActiveBook: (id: string | null) => void;
  addRecord: (bookId: string, record: Omit<WritingRecord, "id">) => void;
  updateRecord: (bookId: string, recordId: string, patch: Partial<WritingRecord>) => void;
  deleteRecord: (bookId: string, recordId: string) => void;
  startRound: (bookId: string) => void;
  addReadingBook: () => void;
  updateReadingBook: (id: string, patch: Partial<ReadingBook>, logDate?: string) => void;
  deleteReadingBook: (id: string) => void;
  setActiveReading: (id: string | null) => void;
  setShelfFilter: (status: ReadingStatus) => void;
  setLibraryPane: (pane: "stats" | "shelf") => void;
  setReadingStats: (stats: StatId[]) => void;
  setCountUnit: (unit: CountUnit) => void;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  moveWindow: (id: WindowId, x: number, y: number) => void;
  resizeWindow: (id: WindowId, bounds: Partial<WindowBounds>) => void;
  toggleMinimized: (id: WindowId) => void;
  toggleMaximized: (id: WindowId) => void;
  hydrateDesk: (desk: DeskPayload) => void;
  resetDesk: () => void;
};

const initialWindows: Windows = {
  tracker: { open: false, z: 2, x: 168, y: 24, w: 832, h: 640, minimized: false, maximized: false, restore: null },
  library: { open: false, z: 1, x: 200, y: 48, w: 720, h: 560, minimized: false, maximized: false, restore: null },
  reading: { open: false, z: 1, x: 140, y: 36, w: 860, h: 640, minimized: false, maximized: false, restore: null },
  personalize: { open: false, z: 1, x: 220, y: 64, w: 520, h: 560, minimized: false, maximized: false, restore: null },
  account: { open: false, z: 1, x: 240, y: 72, w: 480, h: 560, minimized: false, maximized: false, restore: null },
  notes: { open: false, z: 1, x: 180, y: 40, w: 640, h: 480, minimized: false, maximized: false, restore: null },
  cafe: { open: false, z: 1, x: 160, y: 32, w: 720, h: 520, minimized: false, maximized: false, restore: null },
  awards: { open: false, z: 1, x: 190, y: 48, w: 680, h: 560, minimized: false, maximized: false, restore: null },
  tasks: { open: false, z: 1, x: 120, y: 28, w: 920, h: 640, minimized: false, maximized: false, restore: null },
};

function nextStackZ(windows: Windows, nextZ: number) {
  return Math.max(nextZ, ...Object.values(windows).map((win) => win.z)) + 1;
}

function patchBook(books: Book[], id: string, patch: (book: Book) => Book) {
  return books.map((book) => (book.id === id ? patch(book) : book));
}

function mergeCafe(saved: CafeSettings | undefined): CafeSettings {
  if (!saved) return DEFAULT_CAFE;
  return {
    focusMin: saved.focusMin || DEFAULT_CAFE.focusMin,
    shortMin: saved.shortMin || DEFAULT_CAFE.shortMin,
    longMin: saved.longMin || DEFAULT_CAFE.longMin,
    autoStart: saved.autoStart !== false,
    sounds: { ...DEFAULT_CAFE.sounds, ...(saved.sounds ?? {}) },
  };
}

function hydrateWindow(id: WindowId, saved: WindowState | undefined): WindowState {
  const base = initialWindows[id];
  if (!saved) return { ...base };
  return { ...base, ...saved, open: false, minimized: false, restore: saved.restore ?? null };
}

function timeTo12(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const minutes = Number(match[2]);
  let hour = Number(match[1]);
  if (hour > 23 || minutes > 59) return time;
  const period = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${match[2]} ${period}`;
}

function timeTo24(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time;
  const minutes = Number(match[2]);
  let hour = Number(match[1]);
  if (hour < 1 || hour > 12 || minutes > 59) return time;
  const pm = match[3].toUpperCase() === "PM";
  if (pm && hour < 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export const useFolioStore = create<FolioState>()(
  persist(
    (set, get) => ({
      books: [],
      activeBookId: null,
      shelf: [],
      activeReadingId: null,
      shelfFilter: "reading",
      libraryPane: "stats",
      readingStats: ["day", "booksMonth"],
      readingStatsV: 2,
      countUnit: "words",
      windows: initialWindows,
      nextZ: 3,
      themeId: "autumn",
      colorScheme: "light",
      wallpaperSrc: null,
      wallpaperMotion: false,
      customWallpaper: null,
      inbox: [],
      cafe: DEFAULT_CAFE,
      tags: DEFAULT_TAGS,
      notes: [],
      activeNoteId: null,
      planner: [],
      hourClock: "24",
      seenAwards: null,

      setTheme: (id) =>
        set((state) => {
          const custom = Boolean(state.customWallpaper) && state.wallpaperSrc === state.customWallpaper;
          return {
            themeId: id,
            wallpaperSrc: custom ? state.wallpaperSrc : themeOf(id).wallpaper,
          };
        }),
      setColorScheme: (scheme) => set({ colorScheme: scheme }),
      setWallpaper: (src) => set({ wallpaperSrc: src }),
      setWallpaperMotion: (on) => set({ wallpaperMotion: on }),
      setCustomWallpaper: (dataUrl) => set({ customWallpaper: dataUrl, wallpaperSrc: dataUrl }),
      syncInbox: () => {
        const { books, shelf, inbox } = get();
        const have = new Set(inbox.map((item) => item.id));
        const arrivedAt = new Date().toISOString().slice(0, 10);
        const added = dueMailIds(books, shelf)
          .filter((id) => !have.has(id))
          .map((id) => ({ id, arrivedAt }));
        if (added.length > 0) set({ inbox: [...inbox, ...added] });
      },
      setCafe: (cafe) => set({ cafe }),

      addNote: () => {
        const id = newId("note");
        const note: DeskNote = { id, title: "", body: "", updatedAt: new Date().toISOString() };
        set((state) => ({ notes: [note, ...state.notes], activeNoteId: id }));
        return id;
      },
      updateNote: (id, patch) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note,
          ),
          activeNoteId: id,
        })),
      deleteNote: (id) =>
        set((state) => {
          const notes = state.notes.filter((note) => note.id !== id);
          return {
            notes,
            activeNoteId: state.activeNoteId === id ? (notes[0]?.id ?? null) : state.activeNoteId,
          };
        }),
      addPlannerItem: (date, kind) => {
        const id = newId("plan");
        const item: PlannerItem = { id, date, kind, text: "", done: false, important: false, time: "" };
        set((state) => ({ planner: [...state.planner, item] }));
        return id;
      },
      updatePlannerItem: (id, patch) =>
        set((state) => ({
          planner: state.planner.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, ...patch };
            if (next.kind !== "task") next.important = false;
            if (next.kind !== "event") next.time = "";
            return next;
          }),
        })),
      deletePlannerItem: (id) => set((state) => ({ planner: state.planner.filter((item) => item.id !== id) })),
      reorderPlannerItem: (id, beforeId) =>
        set((state) => {
          const from = state.planner.findIndex((item) => item.id === id);
          if (from < 0 || beforeId === id) return state;
          const item = state.planner[from];
          const rest = state.planner.filter((entry) => entry.id !== id);
          let insertAt = rest.length;
          if (beforeId) {
            const target = rest.findIndex((entry) => entry.id === beforeId && entry.date === item.date);
            if (target < 0) return state;
            insertAt = target;
          } else {
            let last = -1;
            rest.forEach((entry, index) => {
              if (entry.date === item.date) last = index;
            });
            insertAt = last < 0 ? rest.length : last + 1;
          }
          const planner = [...rest.slice(0, insertAt), item, ...rest.slice(insertAt)];
          return { planner };
        }),
      setHourClock: (clock) =>
        set((state) => {
          if (state.hourClock === clock) return state;
          const convert = clock === "12" ? timeTo12 : timeTo24;
          return {
            hourClock: clock,
            planner: state.planner.map((item) => (item.time ? { ...item, time: convert(item.time) } : item)),
          };
        }),
      ackAwards: (entries) =>
        set((state) => {
          const prev = state.seenAwards ?? {};
          let changed = state.seenAwards == null;
          const next = { ...prev };
          for (const entry of entries) {
            if (entry.count <= 0) continue;
            if ((next[entry.id] ?? 0) < entry.count) {
              next[entry.id] = entry.count;
              changed = true;
            }
          }
          return changed ? { seenAwards: next } : state;
        }),

      setTrackerTags: (tags) =>
        set((state) => {
          const next = withLockedTags(tags);
          const ids = new Set(next.map((tag) => tag.id));
          return {
            tags: next,
            books: state.books.map((book) => ({
              ...book,
              tag: book.tag && ids.has(book.tag) ? book.tag : null,
            })),
          };
        }),

      addBook: () => {
        const id = newId("book");
        const book: Book = {
          id,
          title: "Без названия",
          annotation: "",
          coverSrc: null,
          coverDataUrl: null,
          startedAt: localDay(),
          chapterCount: 12,
          wordsPerChapter: 2000,
          startingWords: 0,
          startingChapters: 0,
          tag: "draft1",
          cycle: null,
          rounds: [],
          records: [],
        };
        set((state) => ({ books: [book, ...state.books], activeBookId: id }));
        get().openWindow("tracker");
      },
      updateBook: (id, patch) =>
        set((state) => ({
          books: patchBook(state.books, id, (book) => {
            const next = { ...book, ...patch };
            next.chapterCount = clampChapters(next.chapterCount);
            next.wordsPerChapter = clampWordsPerChapter(next.wordsPerChapter);
            next.startingWords = clampStartingWords(next.startingWords ?? 0);
            next.startingChapters = clampStartingChapters(next.startingChapters ?? 0, next.chapterCount);
            return next;
          }),
        })),
      deleteBook: (id) =>
        set((state) => ({
          books: state.books.filter((book) => book.id !== id),
          activeBookId: state.activeBookId === id ? null : state.activeBookId,
        })),
      setActiveBook: (id) => {
        set({ activeBookId: id });
        get().openWindow("tracker");
      },
      addRecord: (bookId, record) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            ...book,
            records: [...book.records, { ...record, id: newId("rec"), note: record.note ?? "" }],
          })),
        })),
      updateRecord: (bookId, recordId, patch) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            ...book,
            records: book.records.map((record) =>
              record.id === recordId ? { ...record, ...patch, note: patch.note ?? record.note ?? "" } : record,
            ),
          })),
        })),
      deleteRecord: (bookId, recordId) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => ({
            ...book,
            records: book.records.filter((record) => record.id !== recordId),
          })),
        })),
      startRound: (bookId) =>
        set((state) => ({
          books: patchBook(state.books, bookId, (book) => {
            const hasWork =
              book.records.length > 0 ||
              (book.startingWords ?? 0) > 0 ||
              (book.startingChapters ?? 0) > 0;
            const archived = hasWork
              ? {
                  id: newId("round"),
                  startedAt: book.startedAt,
                  chapterCount: book.chapterCount,
                  wordsPerChapter: book.wordsPerChapter,
                  startingWords: book.startingWords ?? 0,
                  startingChapters: book.startingChapters ?? 0,
                  records: book.records,
                }
              : null;
            return {
              ...book,
              startedAt: localDay(),
              startingWords: 0,
              startingChapters: 0,
              records: [],
              rounds: [...(book.rounds ?? []), ...(archived ? [archived] : [])],
            };
          }),
        })),

      addReadingBook: () => {
        const id = newId("read");
        const status = get().shelfFilter;
        const book: ReadingBook = {
          id,
          title: "Без названия",
          author: "",
          coverSrc: null,
          coverDataUrl: null,
          status,
          note: "",
          journalText: "",
          stickers: [],
          quotes: [],
          pagesRead: 0,
          pagesTotal: 0,
          pageLog: [],
          rating: null,
          finishedAt: status === "read" ? localDay() : null,
        };
        set((state) => ({ shelf: [book, ...state.shelf], activeReadingId: id }));
        get().openWindow("reading");
      },
      updateReadingBook: (id, patch, logDate) =>
        set((state) => ({
          shelf: state.shelf.map((book) => {
            if (book.id !== id) return book;
            const next = { ...book, ...patch };
            if (typeof patch.pagesRead === "number" && patch.pagesRead !== book.pagesRead) {
              next.pageLog = bumpPageLog(
                book.pageLog,
                patch.pagesRead - (book.pagesRead ?? 0),
                logDate || localDay(),
              );
            }
            return next;
          }),
        })),
      deleteReadingBook: (id) =>
        set((state) => ({
          shelf: state.shelf.filter((book) => book.id !== id),
          activeReadingId: state.activeReadingId === id ? null : state.activeReadingId,
        })),
      setActiveReading: (id) => {
        set({ activeReadingId: id });
        get().openWindow("reading");
      },
      setShelfFilter: (status) => set({ shelfFilter: status }),
      setLibraryPane: (pane) => set({ libraryPane: pane }),
      setReadingStats: (stats) =>
        set({
          readingStats: stats.filter(
            (item) =>
              item === "day" ||
              item === "month" ||
              item === "year" ||
              item === "booksMonth" ||
              item === "booksYear",
          ),
        }),
      setCountUnit: (unit) => set({ countUnit: unit === "chars" ? "chars" : "words" }),

      openWindow: (id) => {
        const { windows, nextZ } = get();
        const z = nextStackZ(windows, nextZ);
        set({
          nextZ: z + 1,
          windows: { ...windows, [id]: { ...windows[id], open: true, minimized: false, z } },
        });
      },
      closeWindow: (id) =>
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], open: false, minimized: false, maximized: false },
          },
        })),
      focusWindow: (id) => {
        const { windows, nextZ } = get();
        const z = nextStackZ(windows, nextZ);
        if (windows[id].z === z - 1 && !windows[id].minimized) return;
        set({
          nextZ: z + 1,
          windows: { ...windows, [id]: { ...windows[id], z, minimized: false } },
        });
      },
      moveWindow: (id, x, y) =>
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], x, y, maximized: false },
          },
        })),
      resizeWindow: (id, bounds) =>
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], ...bounds, maximized: false },
          },
        })),
      toggleMinimized: (id) =>
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], minimized: !state.windows[id].minimized },
          },
        })),
      toggleMaximized: (id) =>
        set((state) => {
          const win = state.windows[id];
          if (win.maximized) {
            const restored = win.restore ?? initialWindows[id];
            return {
              windows: {
                ...state.windows,
                [id]: {
                  ...win,
                  maximized: false,
                  x: restored.x,
                  y: restored.y,
                  w: restored.w,
                  h: restored.h,
                  restore: null,
                },
              },
            };
          }
          return {
            windows: {
              ...state.windows,
              [id]: {
                ...win,
                maximized: true,
                minimized: false,
                restore: { x: win.x, y: win.y, w: win.w, h: win.h },
              },
            },
          };
        }),

      hydrateDesk: (desk) =>
        set(() => {
          const books = desk.books.filter((book) => !SEED_BOOK_IDS.has(book.id));
          const shelf = (desk.shelf ?? []).filter((book) => !SEED_SHELF_IDS.has(book.id));
          const readingStats = (desk.readingStats ?? ["day", "booksMonth"]).filter(
            (item): item is StatId =>
              item === "day" || item === "month" || item === "year" || item === "booksMonth" || item === "booksYear",
          );
          return {
            books,
            activeBookId:
              desk.activeBookId && books.some((book) => book.id === desk.activeBookId) ? desk.activeBookId : null,
            shelf,
            activeReadingId:
              desk.activeReadingId && shelf.some((book) => book.id === desk.activeReadingId)
                ? desk.activeReadingId
                : null,
            notes: desk.notes ?? [],
            planner: sanitizePlanner(desk.planner ?? []),
            activeNoteId: desk.activeNoteId ?? null,
            tags: withLockedTags(desk.tags ?? DEFAULT_TAGS),
            themeId: desk.themeId ?? "autumn",
            colorScheme: desk.colorScheme ?? "light",
            wallpaperSrc: desk.wallpaperSrc ?? null,
            wallpaperMotion: desk.wallpaperMotion ?? false,
            customWallpaper: desk.customWallpaper ?? null,
            cafe: mergeCafe(desk.cafe),
            readingStats: readingStats.length > 0 ? readingStats : ["day", "booksMonth"],
            shelfFilter: desk.shelfFilter ?? "reading",
            libraryPane: desk.libraryPane ?? "stats",
            countUnit: desk.countUnit ?? "words",
            inbox: desk.inbox ?? [],
            seenAwards: desk.seenAwards ?? null,
            hourClock: desk.hourClock === "12" ? "12" : "24",
          };
        }),

      resetDesk: () =>
        set({
          books: [],
          activeBookId: null,
          shelf: [],
          activeReadingId: null,
          notes: [],
          activeNoteId: null,
          planner: [],
          hourClock: "24",
          inbox: [],
          seenAwards: null,
          tags: DEFAULT_TAGS,
          themeId: "autumn",
          colorScheme: "light",
          wallpaperSrc: null,
          wallpaperMotion: false,
          customWallpaper: null,
          cafe: DEFAULT_CAFE,
          readingStats: ["day", "booksMonth"],
          shelfFilter: "reading",
          libraryPane: "stats",
          countUnit: "words",
          windows: initialWindows,
          nextZ: 3,
        }),
    }),
    {
      name: "folio-desk-v3",
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<FolioState> & { wallpaperDataUrl?: string | null };
        const books = (saved.books ?? [])
          .map((book) => ({
            ...book,
            startingWords: book.startingWords ?? 0,
            startingChapters: book.startingChapters ?? 0,
            tag: book.tag ?? null,
            cycle: book.cycle?.trim() || null,
            rounds: (book.rounds ?? []).map((round) => ({
              ...round,
              startingWords: round.startingWords ?? 0,
              startingChapters: round.startingChapters ?? 0,
              records: (round.records ?? []).map(
                (record): WritingRecord => ({
                  id: record.id,
                  date: record.date,
                  chapter: record.chapter,
                  words: record.words,
                  note: record.note ?? "",
                  chapterFinished: Boolean(record.chapterFinished),
                  part: record.part === "prologue" ? "prologue" : record.part === "epilogue" ? "epilogue" : "chapter",
                }),
              ),
            })),
            records: (book.records ?? []).map(
              (record): WritingRecord => ({
                id: record.id,
                date: record.date,
                chapter: record.chapter,
                words: record.words,
                note: record.note ?? "",
                chapterFinished: Boolean(record.chapterFinished),
                part: record.part === "prologue" ? "prologue" : record.part === "epilogue" ? "epilogue" : "chapter",
              }),
            ),
          }))
          .filter((book) => !SEED_BOOK_IDS.has(book.id));
        const shelf = (saved.shelf ?? [])
          .map((book) => migrateReadingBook(book as ReadingBook))
          .filter((book) => !SEED_SHELF_IDS.has(book.id));
        return {
          ...current,
          ...saved,
          books,
          shelf,
          activeBookId:
            saved.activeBookId && books.some((book) => book.id === saved.activeBookId) ? saved.activeBookId : null,
          windows: {
            tracker: hydrateWindow("tracker", saved.windows?.tracker),
            library: hydrateWindow("library", saved.windows?.library),
            reading: hydrateWindow("reading", saved.windows?.reading),
            personalize: hydrateWindow("personalize", saved.windows?.personalize),
            account: hydrateWindow("account", saved.windows?.account),
            notes: hydrateWindow(
              "notes",
              saved.windows?.notes ?? (saved.windows as { mail?: WindowState } | undefined)?.mail,
            ),
            cafe: hydrateWindow("cafe", saved.windows?.cafe),
            awards: hydrateWindow("awards", saved.windows?.awards),
            tasks: hydrateWindow("tasks", saved.windows?.tasks),
          },
          themeId: saved.themeId ?? "autumn",
          colorScheme: saved.colorScheme === "dark" || saved.colorScheme === "system" ? saved.colorScheme : "light",
          wallpaperSrc: (() => {
            const src = saved.wallpaperSrc ?? saved.wallpaperDataUrl ?? null;
            if (src === "/wallpaper.jpg" || src === "/wallpaper-autumn.mp4" || src === "/wallpaper-autumn.gif") {
              return "/wallpaper-autumn.gif";
            }
            if (
              src === "/wallpaper-green.jpg" ||
              src === "/wallpaper-green.gif" ||
              src === "/wallpaper-green.mp4"
            ) {
              return "/wallpaper-green-still.jpg";
            }
            return src;
          })(),
          wallpaperMotion: saved.wallpaperMotion !== false,
          customWallpaper: saved.customWallpaper ?? saved.wallpaperDataUrl ?? null,
          inbox: Array.isArray(saved.inbox)
            ? saved.inbox.filter((item) => item && typeof item.id === "string" && typeof item.arrivedAt === "string")
            : [],
          cafe: mergeCafe(saved.cafe),
          shelfFilter:
            saved.shelfFilter === "reading" ||
            saved.shelfFilter === "read" ||
            saved.shelfFilter === "want" ||
            saved.shelfFilter === "dropped"
              ? saved.shelfFilter
              : "reading",
          libraryPane: saved.libraryPane === "stats" ? "stats" : "shelf",
          readingStats: (() => {
            const allowed: StatId[] = ["day", "month", "year", "booksMonth", "booksYear"];
            const list: StatId[] = Array.isArray(saved.readingStats)
              ? saved.readingStats.filter((item): item is StatId => allowed.includes(item as StatId))
              : ["day", "booksMonth"];
            if ((saved.readingStatsV ?? 1) < 2 && !list.includes("booksMonth")) list.push("booksMonth");
            return list;
          })(),
          readingStatsV: 2,
          countUnit: saved.countUnit === "chars" ? "chars" : "words",
          tags: withLockedTags(
            Array.isArray(saved.tags)
              ? saved.tags.filter((tag) => tag && typeof tag.id === "string" && typeof tag.label === "string")
              : DEFAULT_TAGS,
          ),
          notes: Array.isArray(saved.notes) ? saved.notes : [],
          planner: sanitizePlanner(saved.planner),
          hourClock: saved.hourClock === "12" ? "12" : "24",
          activeNoteId: saved.activeNoteId ?? null,
          seenAwards:
            saved.seenAwards && typeof saved.seenAwards === "object" && !Array.isArray(saved.seenAwards)
              ? saved.seenAwards
              : null,
          activeReadingId:
            saved.activeReadingId && shelf.some((book) => book.id === saved.activeReadingId)
              ? saved.activeReadingId
              : null,
        };
      },
    },
  ),
);

export function deskSnapshot(state: FolioState): DeskPayload {
  return {
    books: state.books,
    activeBookId: state.activeBookId,
    shelf: state.shelf,
    activeReadingId: state.activeReadingId,
    notes: state.notes,
    planner: state.planner,
    hourClock: state.hourClock,
    activeNoteId: state.activeNoteId,
    tags: state.tags,
    themeId: state.themeId,
    colorScheme: state.colorScheme,
    wallpaperSrc: state.wallpaperSrc,
    wallpaperMotion: state.wallpaperMotion,
    customWallpaper: state.customWallpaper,
    cafe: state.cafe,
    readingStats: state.readingStats,
    shelfFilter: state.shelfFilter,
    libraryPane: state.libraryPane,
    countUnit: state.countUnit,
    inbox: state.inbox,
    seenAwards: state.seenAwards,
  };
}

export function useActiveBook() {
  const books = useFolioStore((state) => state.books);
  const activeBookId = useFolioStore((state) => state.activeBookId);
  return books.find((book) => book.id === activeBookId) ?? null;
}

export function useActiveReading() {
  const shelf = useFolioStore((state) => state.shelf);
  const activeReadingId = useFolioStore((state) => state.activeReadingId);
  return shelf.find((book) => book.id === activeReadingId) ?? null;
}
