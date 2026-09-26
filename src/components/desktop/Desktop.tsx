import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccountSettings } from "@/components/desktop/AccountSettings";
import { AppWindow } from "@/components/desktop/AppWindow";
import { DesktopIcon } from "@/components/desktop/DesktopIcon";
import { FolioSync } from "@/components/desktop/FolioSync";
import { MenuBar } from "@/components/desktop/MenuBar";
import { Personalize } from "@/components/desktop/Personalize";
import { CafeTimerKeeper } from "@/components/cafe/CafeTimerKeeper";
import { WallpaperMedia, useWallpaperMotionAllowed } from "@/components/desktop/WallpaperMedia";
import { Awards } from "@/components/awards/Awards";
import { Cafe } from "@/components/cafe/Cafe";
import { Notebook } from "@/components/notes/Notebook";
import { Tasks } from "@/components/tasks/Tasks";
import { ReadingLibrary } from "@/components/reading/ReadingLibrary";
import { WriterTracker } from "@/components/writer/WriterTracker";
import { themeOf, visibleWallpaper } from "@/lib/theme";
import { buildAwards } from "@/lib/achievements";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function deskIcon(themeId: string, name: "writer" | "reading" | "notes" | "cafe" | "tasks") {
  if (themeId === "autumn") return `/icon-${name}-autumn.png`;
  if (themeId === "green") return `/icon-${name}-green.png`;
  if (themeId === "purple") return `/icon-${name}-purple.png`;
  return `/icon-${name}.png`;
}

export function Desktop() {
  const themeId = useFolioStore((state) => state.themeId);
  const colorScheme = useFolioStore((state) => state.colorScheme);
  const wallpaperSrc = useFolioStore((state) => state.wallpaperSrc);
  const wallpaperMotion = useFolioStore((state) => state.wallpaperMotion);
  const motionAllowed = useWallpaperMotionAllowed();
  const windows = useFolioStore((state) => state.windows);
  const openWindow = useFolioStore((state) => state.openWindow);
  const setActiveBook = useFolioStore((state) => state.setActiveBook);
  const setActiveReading = useFolioStore((state) => state.setActiveReading);
  const setShelfFilter = useFolioStore((state) => state.setShelfFilter);
  const setLibraryPane = useFolioStore((state) => state.setLibraryPane);
  const books = useFolioStore((state) => state.books);
  const shelf = useFolioStore((state) => state.shelf);
  const seenAwards = useFolioStore((state) => state.seenAwards);
  const ackAwards = useFolioStore((state) => state.ackAwards);
  const [twoRows, setTwoRows] = useState(false);
  const [shade, setShade] = useState(176);
  const navRef = useRef<HTMLDivElement>(null);
  const wallpaper = visibleWallpaper(
    wallpaperSrc || themeOf(themeId).wallpaper,
    wallpaperMotion && motionAllowed,
  );
  const pixel = themeId === "autumn" || themeId === "green" || themeId === "purple" || themeId === "beige";
  const [hydrated, setHydrated] = useState(() => useFolioStore.persist.hasHydrated());
  const unlockedAwards = useMemo(
    () =>
      buildAwards(books, shelf)
        .filter((award) => award.unlocked)
        .map((award) => ({ id: award.id, count: award.count })),
    [books, shelf],
  );
  const awardsFresh =
    seenAwards != null &&
    unlockedAwards.some((award) => (seenAwards[award.id] ?? 0) < award.count) &&
    !(windows.awards.open && !windows.awards.minimized);

  useEffect(() => {
    if (useFolioStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useFolioStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const watching = windows.awards.open && !windows.awards.minimized;
    if (seenAwards == null || watching) ackAwards(unlockedAwards);
  }, [ackAwards, hydrated, seenAwards, unlockedAwards, windows.awards.minimized, windows.awards.open]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeId === "autumn" ? "" : themeId;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = colorScheme === "dark" || (colorScheme === "system" && media.matches);
      root.dataset.scheme = dark ? "dark" : "light";
    };
    apply();
    if (colorScheme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [themeId, colorScheme]);

  useLayoutEffect(() => {
    const measure = () => {
      const node = navRef.current;
      if (!node) return;
      const gap = 24;
      const children = [...node.children] as HTMLElement[];
      const stacked =
        children.reduce((sum, child) => sum + child.offsetHeight, 0) + gap * Math.max(0, children.length - 1);
      const available = window.innerHeight - 12 - 48;
      setTwoRows(stacked > available + 1);
      setShade(node.offsetWidth + 80);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="relative h-dvh overflow-hidden bg-chrome text-chrome-text">
      <WallpaperMedia src={wallpaper} className="absolute inset-0 size-full object-cover" />
      <CafeTimerKeeper />
      <FolioSync />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] bg-gradient-to-r from-chrome/80 via-chrome/40 to-transparent"
        style={{ width: shade }}
      />
      <nav
        ref={navRef}
        className={cn(
          "absolute top-3 bottom-12 left-1 z-10 gap-6",
          twoRows ? "grid w-max grid-cols-3 content-start" : "flex w-24 flex-col items-center",
        )}
      >
        <DesktopIcon
          src={deskIcon(themeId, "writer")}
          label="Писательский трекер"
          active={windows.tracker.open}
          crisp={pixel}
          onOpen={() => setActiveBook(null)}
        />
        <DesktopIcon
          src={deskIcon(themeId, "reading")}
          label="Библиотека"
          active={windows.reading.open}
          crisp={pixel}
          onOpen={() => {
            setShelfFilter("reading");
            setLibraryPane("stats");
            setActiveReading(null);
          }}
        />
        <DesktopIcon
          src={deskIcon(themeId, "notes")}
          label="Блокнот"
          active={windows.notes.open}
          crisp={pixel}
          onOpen={() => openWindow("notes")}
        />
        <DesktopIcon
          src={deskIcon(themeId, "tasks")}
          label="Ежедневник"
          active={windows.tasks.open}
          crisp={pixel}
          onOpen={() => openWindow("tasks")}
        />
        <DesktopIcon
          src={deskIcon(themeId, "cafe")}
          label="Кафе"
          active={windows.cafe.open}
          crisp={pixel}
          onOpen={() => openWindow("cafe")}
        />
        <DesktopIcon
          src="/icon-awards.png"
          label="Достижения"
          active={windows.awards.open}
          crisp
          badge={awardsFresh}
          onOpen={() => openWindow("awards")}
        />
      </nav>

      <AppWindow id="tracker" title="Писательский трекер">
        <WriterTracker />
      </AppWindow>
      <AppWindow id="reading" title="Библиотека">
        <ReadingLibrary />
      </AppWindow>
      <AppWindow id="personalize" title="Оформление">
        <Personalize />
      </AppWindow>
      <AppWindow id="account" title="Настройки">
        <AccountSettings />
      </AppWindow>
      <AppWindow id="notes" title="Блокнот">
        <Notebook />
      </AppWindow>
      <AppWindow id="tasks" title="Ежедневник">
        <Tasks />
      </AppWindow>
      <AppWindow id="cafe" title="Кафе">
        <Cafe />
      </AppWindow>
      <AppWindow id="awards" title="Достижения">
        <Awards />
      </AppWindow>
      <MenuBar />
    </div>
  );
}
