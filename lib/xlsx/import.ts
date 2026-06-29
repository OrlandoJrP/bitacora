import "server-only";
import * as XLSX from "xlsx";

export type FilaNormalizada = Record<string, unknown>;

const DIACRITICS = /[̀-ͯ]/g;

function normKey(k: string): string {
  const nk = k.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
  if (nk === "ano") return "anio";
  return nk;
}

/**
 * Lee la hoja preferida (o la primera) de un archivo .xlsx/.csv y devuelve las
 * filas con las claves normalizadas (sin acentos, minúsculas; "año" → "anio").
 */
export function leerFilas(buf: ArrayBuffer, hojaPreferida: string): FilaNormalizada[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const nombre =
    wb.SheetNames.find((n) => n.toLowerCase() === hojaPreferida.toLowerCase()) ??
    wb.SheetNames[0];
  if (!nombre) return [];
  const ws = wb.Sheets[nombre];
  if (!ws) return [];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  });
  return filas.map((f) => {
    const o: FilaNormalizada = {};
    for (const [k, v] of Object.entries(f)) o[normKey(k)] = v;
    return o;
  });
}

/** Convierte una celda de fecha (Date, serial Excel o string) a "YYYY-MM-DD". */
export function aFechaISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  return null;
}

export function aNumero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function aTexto(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
