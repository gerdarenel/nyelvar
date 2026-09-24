import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { acceptNumberDraft } from "@/lib/folio";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function NumberField({ value, onValueChange, className, ...props }: Props) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        if (acceptNumberDraft(next)) onValueChange(next);
      }}
      className={cn("folio-control text-sm tabular-nums", className)}
    />
  );
}
