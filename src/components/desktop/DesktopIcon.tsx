import { cn } from "@/lib/utils";

export function DesktopIcon({
  src,
  label,
  active,
  crisp,
  badge,
  onOpen,
}: {
  src: string;
  label: string;
  active?: boolean;
  crisp?: boolean;
  badge?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={Boolean(active)}
      className="flex w-24 shrink-0 flex-col items-center gap-1 self-start text-chrome-text select-none"
    >
      <span className="relative transition-transform duration-(--motion-quick) ease-(--ease-out) hover:-translate-y-0.5 active:scale-[0.96]">
        <img
          src={src}
          alt=""
          decoding="async"
          className={cn(
            "size-16 object-contain drop-shadow-[0_10px_14px_rgba(28,20,14,0.35)]",
            crisp && "[image-rendering:pixelated]",
          )}
        />
        {badge ? (
          <span
            aria-hidden
            className="absolute top-0 right-0 size-3 rounded-full bg-[#d32626] ring-2 ring-[#f4e8d4]"
          />
        ) : null}
      </span>
      <span className="text-center text-xs font-medium leading-snug text-pretty drop-shadow-[0_1px_2px_rgba(28,20,14,0.65)]">
        {label}
      </span>
    </button>
  );
}
