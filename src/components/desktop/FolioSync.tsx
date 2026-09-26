import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadDesk, saveDesk } from "@/lib/folio-desk";
import { deskSnapshot, useFolioStore } from "@/lib/store";

const OWNER_KEY = "folio-desk-owner";
const STAMPS_KEY = "folio-desk-stamps";

type Stamp = { userId: string; createdAt: string; fingerprint: string };

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(userId: string) {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* ignore */
  }
}

function readStamps(): Stamp[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STAMPS_KEY) ?? "[]") as Stamp[];
    return Array.isArray(raw) ? raw.filter((item) => item && typeof item.userId === "string") : [];
  } catch {
    return [];
  }
}

function writeStamp(stamp: Stamp) {
  const next = readStamps().filter((item) => item.userId !== stamp.userId);
  next.push(stamp);
  try {
    localStorage.setItem(STAMPS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

type DeskIds = {
  books: { id: string }[];
  shelf: { id: string }[];
  notes?: { id: string }[];
  planner?: { id: string }[];
};

function idList(list?: { id: string }[]) {
  return (list ?? [])
    .map((item) => item.id)
    .sort()
    .join(",");
}

function legacyFingerprint(desk: DeskIds) {
  return `${idList(desk.books)}#${idList(desk.shelf)}#${idList(desk.notes)}`;
}

function fingerprint(desk: DeskIds) {
  return `${legacyFingerprint(desk)}#${idList(desk.planner)}`;
}

function sameWork(stamp: string, desk: DeskIds) {
  return stamp === fingerprint(desk) || stamp === legacyFingerprint(desk);
}

function hasWork(desk: DeskIds) {
  return (
    desk.books.length > 0 ||
    desk.shelf.length > 0 ||
    (desk.notes?.length ?? 0) > 0 ||
    (desk.planner?.length ?? 0) > 0
  );
}

export function FolioSync() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const createdAt = user?.createdAt ?? "";
  const hydrateDesk = useFolioStore((state) => state.hydrateDesk);
  const resetDesk = useFolioStore((state) => state.resetDesk);
  const ready = useRef(false);

  useEffect(() => {
    if (isPending || !userId) {
      ready.current = false;
      if (!isPending && !userId && readOwner()) resetDesk();
      return;
    }
    let cancelled = false;
    const localOwner = readOwner();
    const local = deskSnapshot(useFolioStore.getState());
    const foreign = Boolean(localOwner && localOwner !== userId);
    void loadDesk()
      .then((desk) => {
        if (cancelled) return;
        const stamps = readStamps();
        const copiedOntoNewer =
          Boolean(desk) &&
          hasWork(desk!) &&
          Boolean(createdAt) &&
          stamps.some(
            (stamp) =>
              stamp.userId !== userId &&
              sameWork(stamp.fingerprint, desk!) &&
              stamp.createdAt &&
              stamp.createdAt < createdAt,
          );

        if (copiedOntoNewer || (foreign && !desk)) {
          resetDesk();
          const empty = deskSnapshot(useFolioStore.getState());
          void saveDesk({ data: empty }).catch(() => undefined);
          writeStamp({ userId, createdAt, fingerprint: fingerprint(empty) });
        } else if (desk) {
          if (foreign) resetDesk();
          const own = foreign
            ? desk
            : {
                ...desk,
                planner: desk.planner ?? local.planner,
                notes: desk.notes ?? local.notes,
              };
          hydrateDesk(own);
          const merged = deskSnapshot(useFolioStore.getState());
          if (!foreign && (desk.planner === undefined || desk.notes === undefined)) {
            void saveDesk({ data: merged }).catch(() => undefined);
          }
          if (hasWork(merged)) writeStamp({ userId, createdAt, fingerprint: fingerprint(merged) });
        } else {
          void saveDesk({ data: local }).catch(() => undefined);
          if (hasWork(local)) writeStamp({ userId, createdAt, fingerprint: fingerprint(local) });
        }
        writeOwner(userId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) ready.current = true;
      });
    return () => {
      cancelled = true;
      ready.current = false;
    };
  }, [userId, createdAt, isPending, hydrateDesk, resetDesk]);

  useEffect(() => {
    if (isPending || !userId) return;
    let timer: number | undefined;
    const save = () => {
      if (!ready.current) return;
      void saveDesk({ data: deskSnapshot(useFolioStore.getState()) }).catch(() => undefined);
    };
    const unsub = useFolioStore.subscribe(() => {
      if (!ready.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 600);
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      window.clearTimeout(timer);
      save();
    };
  }, [userId, isPending]);

  return null;
}
