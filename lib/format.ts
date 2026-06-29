/**
 * lib/format.ts — Formateo consistente de dinero, porcentajes y fechas.
 * Todo el dinero en USD ($1,234.56). Meses y fechas en español.
 */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea un monto en USD: 1234.56 → "$1,234.56". Acepta string (numeric) o number. */
export function formatUSD(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return usd.format(Number.isFinite(n as number) ? (n as number) : 0);
}

/** Igual que formatUSD pero con signo explícito (+/−) para resultados. */
export function formatUSDSigned(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${usd.format(v)}`;
}

/** Formatea una fracción ROI (0.052) como porcentaje ("+5.20%"). */
export function formatPct(fraction: number | null | undefined, withSign = true): string {
  const v = (fraction ?? 0) * 100;
  const sign = withSign && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

/** Formatea un valor que ya está en porcentaje (5.25 → "5.25%"). */
export function formatPctValue(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return `${v.toFixed(2)}%`;
}

export const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const MESES_ES_CORTO = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

/** Nombre del mes en español: (2024, 9) → "Septiembre 2024". */
export function nombreMes(anio: number, mes: number, corto = false): string {
  const arr = corto ? MESES_ES_CORTO : MESES_ES;
  const nombre = arr[mes - 1] ?? `Mes ${mes}`;
  return `${nombre} ${anio}`;
}

/** Etiqueta corta para gráficos: (2024, 9) → "Sep '24". */
export function etiquetaMesCorta(anio: number, mes: number): string {
  const nombre = MESES_ES_CORTO[mes - 1] ?? `${mes}`;
  return `${nombre} '${String(anio).slice(2)}`;
}

/** Formatea una fecha "YYYY-MM-DD" a "15 de noviembre de 2024". */
export function formatFechaLarga(fecha: string | Date | null | undefined): string {
  if (!fecha) return "—";
  const s = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha);
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return s;
  return `${d} de ${(MESES_ES[m - 1] ?? "").toLowerCase()} de ${y}`;
}

/** Formatea un timestamp a "15/11/2024, 14:30". */
export function formatFechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Devuelve el año-mes actual (UTC) como {anio, mes}. */
export function mesActual(): { anio: number; mes: number } {
  const now = new Date();
  return { anio: now.getUTCFullYear(), mes: now.getUTCMonth() + 1 };
}
