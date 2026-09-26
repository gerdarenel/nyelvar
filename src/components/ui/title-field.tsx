import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function TitleField({
  id,
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    };
    measure();
    const parent = node.parentElement;
    if (!parent) return;
    let width = parent.clientWidth;
    const observer = new ResizeObserver(() => {
      if (parent.clientWidth === width) return;
      width = parent.clientWidth;
      measure();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value.replace(/\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      className={cn("folio-plain resize-none overflow-hidden", className)}
    />
  );
}
