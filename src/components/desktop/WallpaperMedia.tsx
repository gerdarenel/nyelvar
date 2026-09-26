import { useEffect, useState } from "react";
import { visibleWallpaper, wallpaperMotionAllowed } from "@/lib/theme";
import { cn } from "@/lib/utils";

function isGif(src: string) {
  return src.endsWith(".gif") || src.startsWith("data:image/gif");
}

function isVideo(src: string) {
  return src.endsWith(".mp4");
}

export function useWallpaperMotionAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    setAllowed(wallpaperMotionAllowed());
  }, []);
  return allowed;
}

export function WallpaperMedia({ src, className }: { src: string; className?: string }) {
  const allowMotion = useWallpaperMotionAllowed();
  const animated = allowMotion && (isGif(src) || isVideo(src));
  const still = isGif(src) || isVideo(src) ? visibleWallpaper(src, false) : src;
  const [gifReady, setGifReady] = useState(false);
  const [frozen, setFrozen] = useState<string | null>(null);
  const placed = className?.includes("absolute") ?? false;

  useEffect(() => {
    if (!animated || !isGif(src)) {
      setGifReady(false);
      return;
    }
    setGifReady(false);
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const image = new Image();
      image.decoding = "sync";
      image.onload = () => {
        if (!cancelled) setGifReady(true);
      };
      image.src = src;
    };
    const idle = window.requestIdleCallback?.(start, { timeout: 1200 });
    const timer = idle === undefined ? window.setTimeout(start, 700) : undefined;
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [animated, src]);

  useEffect(() => {
    if (allowMotion || !isGif(still)) {
      setFrozen(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 1;
      canvas.height = image.naturalHeight || 1;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      if (!cancelled) setFrozen(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.src = still;
    return () => {
      cancelled = true;
    };
  }, [allowMotion, still]);

  const base = !allowMotion && isGif(still) ? frozen ?? undefined : still;

  return (
    <span
      key={animated ? `motion:${src}` : `still:${still}`}
      className={cn("block overflow-hidden", className)}
      style={placed ? undefined : { position: "relative" }}
    >
      {base ? (
        <img src={base} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : null}
      {animated && isGif(src) && gifReady ? (
        <img src={src} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : null}
      {animated && isVideo(src) ? (
        <video src={src} autoPlay loop muted playsInline className="absolute inset-0 size-full object-cover" />
      ) : null}
    </span>
  );
}