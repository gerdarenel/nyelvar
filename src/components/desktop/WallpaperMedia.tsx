import { useEffect, useState } from "react";
import { visibleWallpaper } from "@/lib/theme";

export function WallpaperMedia({ src, className }: { src: string; className?: string }) {
  const animated = src.endsWith(".gif") || src.endsWith(".mp4");
  const poster = animated ? visibleWallpaper(src, false) : src;
  const [shown, setShown] = useState(poster);

  useEffect(() => {
    if (!animated) {
      setShown(src);
      return;
    }
    setShown(poster);
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      if (src.endsWith(".mp4")) {
        setShown(src);
        return;
      }
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (!cancelled) setShown(src);
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
  }, [src, animated, poster]);

  if (shown.endsWith(".mp4")) {
    return <video src={shown} autoPlay loop muted playsInline className={className} />;
  }
  return <img src={shown} alt="" decoding="async" className={className} />;
}