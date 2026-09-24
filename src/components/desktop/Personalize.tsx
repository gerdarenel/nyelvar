import { useRef, useState } from "react";
import { fileToWallpaperDataUrl } from "@/lib/folio";
import { WallpaperMedia } from "@/components/desktop/WallpaperMedia";
import { THEMES, isAnimatedWallpaper, themeOf, visibleWallpaper } from "@/lib/theme";
import { useFolioStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Personalize() {
  const themeId = useFolioStore((state) => state.themeId);
  const wallpaperSrc = useFolioStore((state) => state.wallpaperSrc);
  const wallpaperMotion = useFolioStore((state) => state.wallpaperMotion);
  const customWallpaper = useFolioStore((state) => state.customWallpaper);
  const setTheme = useFolioStore((state) => state.setTheme);
  const setWallpaper = useFolioStore((state) => state.setWallpaper);
  const setWallpaperMotion = useFolioStore((state) => state.setWallpaperMotion);
  const setCustomWallpaper = useFolioStore((state) => state.setCustomWallpaper);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const theme = themeOf(themeId);
  const wallpapers = [
    ...THEMES.map((item) => ({ id: item.id, label: item.label, src: item.wallpaper })),
    ...(customWallpaper ? [{ id: "custom", label: "Своё", src: customWallpaper }] : []),
  ];

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToWallpaperDataUrl(file);
      setCustomWallpaper(dataUrl);
      setNotice(null);
    } catch (error) {
      setNotice(
        error instanceof Error && error.message === "gif-too-big"
          ? "Гифка слишком большая — выберите файл до 5 МБ."
          : "Не удалось прочитать изображение.",
      );
    }
  }

  return (
    <div className="folio-scroll h-full overflow-y-auto px-4 py-4 md:px-5">
      <h3 className="font-display text-xl font-semibold tracking-tight">Оформление</h3>
      <p className="mt-1 text-sm text-muted">
        Тема меняет цвета и фон. Свой загруженный фон остаётся.
      </p>

      <p className="mt-5 text-xs font-medium tracking-wide text-muted">Тема</p>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {THEMES.map((item) => {
          const active = item.id === themeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setTheme(item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 bg-paper-deep px-2 py-2 text-left shadow-[var(--shadow-border)]",
                  active && "shadow-[0_0_0_2px_var(--color-rust)]",
                )}
              >
                <span className="text-sm">{item.label}</span>
                <span className="flex shrink-0" aria-hidden="true">
                  {item.colors.map((color) => (
                    <span key={color} className="size-4" style={{ background: color }} />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-xs font-medium tracking-wide text-muted">Фон рабочего стола</p>
      <ul
        className="mt-2 grid gap-2"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(max(8.5rem, calc((100% - 1rem) / 3)), 1fr))",
        }}
      >
        {wallpapers.map((item) => {
          const active = wallpaperSrc ? wallpaperSrc === item.src : item.src === theme.wallpaper;
          const motion = isAnimatedWallpaper(item.src);
          return (
            <li key={item.id} className="relative min-w-0">
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => setWallpaper(item.src)}
                className={cn(
                  "block w-full overflow-hidden shadow-[var(--shadow-border)]",
                  active && "shadow-[0_0_0_2px_var(--color-rust)]",
                )}
              >
                <WallpaperMedia
                  src={motion ? visibleWallpaper(item.src, wallpaperMotion) : item.src}
                  className="aspect-[16/10] w-full object-cover"
                />
              </button>
              {motion ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink/80 via-ink/45 to-transparent px-1.5 pt-5 pb-1.5">
                  <span className="text-[11px] text-paper">анимация</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={wallpaperMotion}
                    aria-label="анимация"
                    onClick={(event) => {
                      event.stopPropagation();
                      setWallpaperMotion(!wallpaperMotion);
                    }}
                    className={cn(
                      "pointer-events-auto relative h-4 w-8 shrink-0",
                      wallpaperMotion ? "bg-paper" : "bg-paper/35",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-3 transition-transform duration-(--motion-quick)",
                        wallpaperMotion ? "bg-ink" : "bg-paper",
                      )}
                      style={{ left: wallpaperMotion ? 16 : 2 }}
                    />
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mt-3 flex h-10 w-full items-center justify-center border border-ink/25 text-sm text-ink hover:bg-ink/6"
      >
        Загрузить свой фон
      </button>
      <p className="mt-1.5 text-xs text-muted">Можно загрузить и GIF-анимацию, до 5 МБ.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {notice ? <p className="mt-2 text-sm text-rust">{notice}</p> : null}
    </div>
  );
}
