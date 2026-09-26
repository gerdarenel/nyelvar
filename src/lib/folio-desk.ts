import { createServerFn } from "@tanstack/react-start";
import type { CafeSettings } from "@/lib/cafe-audio";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  type Book,
  type CountUnit,
  type PlannerItem,
  type ReadingBook,
  type ReadingStatus,
  type TrackerTag,
  migrateReadingBook,
} from "@/lib/folio";
import type { ColorScheme, ThemeId } from "@/lib/theme";

export type DeskNote = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

export type DeskPayload = {
  books: Book[];
  activeBookId: string | null;
  shelf: ReadingBook[];
  activeReadingId: string | null;
  notes?: DeskNote[];
  planner?: PlannerItem[];
  activeNoteId?: string | null;
  tags?: TrackerTag[];
  themeId?: ThemeId;
  colorScheme?: ColorScheme;
  wallpaperSrc?: string | null;
  wallpaperMotion?: boolean;
  customWallpaper?: string | null;
  cafe?: CafeSettings;
  readingStats?: ("day" | "month" | "year" | "booksMonth" | "booksYear")[];
  shelfFilter?: ReadingStatus;
  libraryPane?: "stats" | "shelf";
  countUnit?: CountUnit;
  inbox?: { id: string; arrivedAt: string }[];
  seenAwards?: Record<string, number> | null;
  hourClock?: "12" | "24";
};

function parseJson(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return parseJson(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value;
}

function seenAwardsOf(bag: Record<string, unknown>): Record<string, number> | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(bag, "seenAwards")) return undefined;
  const value = bag.seenAwards;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const awards: Record<string, number> = {};
  for (const [id, count] of Object.entries(value)) {
    if (typeof count === "number" && count > 0) awards[id] = count;
  }
  return awards;
}

function asBooks(value: unknown): Book[] {
  return Array.isArray(value) ? (value as Book[]) : [];
}

function asShelf(value: unknown): ReadingBook[] {
  return Array.isArray(value) ? (value as ReadingBook[]) : [];
}

function optionalArray<T>(bag: object, key: string): T[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(bag, key)) return undefined;
  const value = (bag as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function unpack(raw: unknown): Omit<DeskPayload, "activeBookId"> {
  const data = parseJson(raw);
  if (Array.isArray(data)) {
    return { books: asBooks(data), shelf: [], activeReadingId: null };
  }
  if (data && typeof data === "object") {
    const bag = data as Record<string, unknown>;
    const books = asBooks(bag.manuscripts ?? bag.books);
    return {
      books,
      shelf: asShelf(bag.shelf),
      activeReadingId: typeof bag.activeReadingId === "string" ? bag.activeReadingId : null,
      notes: optionalArray(bag, "notes"),
      planner: optionalArray(bag, "planner"),
      activeNoteId: typeof bag.activeNoteId === "string" ? bag.activeNoteId : bag.activeNoteId === null ? null : undefined,
      tags: optionalArray(bag, "tags"),
      themeId: typeof bag.themeId === "string" ? (bag.themeId as ThemeId) : undefined,
      colorScheme:
        bag.colorScheme === "light" || bag.colorScheme === "dark" || bag.colorScheme === "system"
          ? bag.colorScheme
          : undefined,
      wallpaperSrc: typeof bag.wallpaperSrc === "string" ? bag.wallpaperSrc : bag.wallpaperSrc === null ? null : undefined,
      wallpaperMotion: typeof bag.wallpaperMotion === "boolean" ? bag.wallpaperMotion : undefined,
      customWallpaper:
        typeof bag.customWallpaper === "string" ? bag.customWallpaper : bag.customWallpaper === null ? null : undefined,
      cafe: bag.cafe && typeof bag.cafe === "object" ? (bag.cafe as CafeSettings) : undefined,
      readingStats: optionalArray(bag, "readingStats"),
      shelfFilter:
        bag.shelfFilter === "reading" ||
        bag.shelfFilter === "read" ||
        bag.shelfFilter === "want" ||
        bag.shelfFilter === "dropped"
          ? bag.shelfFilter
          : undefined,
      libraryPane: bag.libraryPane === "stats" || bag.libraryPane === "shelf" ? bag.libraryPane : undefined,
      countUnit: bag.countUnit === "chars" || bag.countUnit === "words" ? bag.countUnit : undefined,
      inbox: optionalArray(bag, "inbox"),
      seenAwards: seenAwardsOf(bag),
      hourClock: bag.hourClock === "12" || bag.hourClock === "24" ? bag.hourClock : undefined,
    };
  }
  return { books: [], shelf: [], activeReadingId: null };
}

function normalizeBook(book: Book): Book {
  return {
    ...book,
    startingWords: book.startingWords ?? 0,
    startingChapters: book.startingChapters ?? 0,
    tag: book.tag ?? null,
    cycle: typeof book.cycle === "string" && book.cycle.trim() ? book.cycle.trim() : null,
    rounds: (book.rounds ?? []).map((round) => ({
      ...round,
      startingWords: round.startingWords ?? 0,
      startingChapters: round.startingChapters ?? 0,
      records: (round.records ?? []).map((record) => ({
        ...record,
        note: record.note ?? "",
      })),
    })),
    records: (book.records ?? []).map((record) => ({
      ...record,
      note: record.note ?? "",
    })),
  };
}

export const loadDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskPayload | null> => {
    const sql = await getSql();
    const rows = await sql<{ books: unknown; active_book_id: string | null }>`
      select books, active_book_id from folio_desks where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return null;
    const packed = unpack(row.books);
    return {
      ...packed,
      books: packed.books.map(normalizeBook),
      activeBookId: row.active_book_id,
      shelf: packed.shelf.map((book) => migrateReadingBook(book)),
    };
  });

export const saveDesk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: DeskPayload) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const packed = JSON.stringify({
      manuscripts: Array.isArray(data.books) ? data.books : [],
      shelf: Array.isArray(data.shelf) ? data.shelf : [],
      activeReadingId: data.activeReadingId ?? null,
      notes: data.notes ?? [],
      planner: data.planner ?? [],
      activeNoteId: data.activeNoteId ?? null,
      tags: data.tags ?? [],
      themeId: data.themeId ?? null,
      colorScheme: data.colorScheme ?? "light",
      wallpaperSrc: data.wallpaperSrc ?? null,
      wallpaperMotion: data.wallpaperMotion !== false,
      customWallpaper: data.customWallpaper ?? null,
      cafe: data.cafe ?? null,
      readingStats: data.readingStats ?? [],
      shelfFilter: data.shelfFilter ?? "reading",
      libraryPane: data.libraryPane ?? "shelf",
      countUnit: data.countUnit ?? "words",
      inbox: data.inbox ?? [],
      seenAwards: data.seenAwards ?? null,
      hourClock: data.hourClock === "12" ? "12" : "24",
    });
    await sql.query(
      `insert into folio_desks (user_id, books, active_book_id, updated_at)
       values ($1, $2::jsonb, $3, now())
       on conflict (user_id) do update set
         books = excluded.books,
         active_book_id = excluded.active_book_id,
         updated_at = now()`,
      [context.userId, packed, data.activeBookId ?? null],
    );
  });
