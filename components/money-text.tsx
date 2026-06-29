import { formatUSD, formatUSDSigned, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

function toNum(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Monto en USD. `colored` aplica verde/rojo según signo; `signed` antepone +/−. */
export function MoneyText({
  value,
  signed = false,
  colored = false,
  className,
}: {
  value: number | string | null | undefined;
  signed?: boolean;
  colored?: boolean;
  className?: string;
}) {
  const n = toNum(value);
  return (
    <span
      className={cn(
        "tabular",
        colored && (n > 0 ? "text-pos" : n < 0 ? "text-neg" : "text-muted-foreground"),
        className,
      )}
    >
      {signed ? formatUSDSigned(n) : formatUSD(n)}
    </span>
  );
}

/** Porcentaje (recibe una fracción, ej. 0.052) con color por signo. */
export function PctText({
  fraction,
  colored = true,
  className,
}: {
  fraction: number | null | undefined;
  colored?: boolean;
  className?: string;
}) {
  const f = fraction ?? 0;
  return (
    <span
      className={cn(
        "tabular",
        colored && (f > 0 ? "text-pos" : f < 0 ? "text-neg" : "text-muted-foreground"),
        className,
      )}
    >
      {formatPct(f)}
    </span>
  );
}
