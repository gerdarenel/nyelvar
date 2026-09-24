export type ThemeId = "autumn" | "beige" | "green" | "purple";

export const AUTUMN_MOTION = "/wallpaper-autumn.gif";
export const AUTUMN_STILL = "/wallpaper-autumn-still.jpg";

const ANIMATED = [
  { motion: AUTUMN_MOTION, still: AUTUMN_STILL, aliases: ["/wallpaper-autumn.mp4", "/wallpaper.jpg"] },
];

export const THEMES: { id: ThemeId; label: string; wallpaper: string; colors: string[] }[] = [
  { id: "autumn", label: "Осень", wallpaper: AUTUMN_MOTION, colors: ["#1c140e", "#9c4e2a", "#4e6b3c", "#f4e8d4"] },
  { id: "beige", label: "Беж", wallpaper: "/wallpaper-beige.jpg", colors: ["#2a2622", "#8a7355", "#6a7564", "#f3efe6"] },
  { id: "green", label: "Зелень", wallpaper: "/wallpaper-green-still.jpg", colors: ["#142018", "#3f6b4a", "#2f5d3a", "#e7f0e4"] },
  { id: "purple", label: "Сирень", wallpaper: "/wallpaper-purple.jpg", colors: ["#24182c", "#7a4e8a", "#5b4e7a", "#f3eaf6"] },
];

export function themeOf(id: ThemeId | undefined) {
  return THEMES.find((item) => item.id === id) ?? THEMES[0];
}

export function isAnimatedWallpaper(src: string) {
  return ANIMATED.some((item) => item.motion === src || item.still === src || item.aliases.includes(src));
}

export function visibleWallpaper(src: string, motion: boolean) {
  const pair = ANIMATED.find((item) => item.motion === src || item.still === src || item.aliases.includes(src));
  if (!pair) return src;
  return motion ? pair.motion : pair.still;
}