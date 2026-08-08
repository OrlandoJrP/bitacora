import "server-only";
import * as XLSX from "xlsx";
import type { MesLedger, ResumenAnual } from "@/lib/finance/ledger";
import { nombreMes } from "@/lib/format";

export type ClienteInfo = { nombre: string; email: string };
export type ItemLedger = {
  cliente: ClienteInfo & { id: string; estado: string };
  meses: MesLedger[];
  porAnio: ResumenAnual[];
  resumen: { saldoActual: number; comisionOperador: number; gananciaNeta: number; roiAcumulado: number };
  /** Dónde está la comisión respecto del saldo. */
  tratamientoComision?: "descontada" | "ya_retirada" | "pagada_aparte";
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Cuando la comisión no se descuenta del saldo, "Rend. neto" sería idéntico al
 *  bruto y la fila invitaría a restarla otra vez: se sustituye la columna por la
 *  base sobre la que se calculó. */
function filasMensuales(meses: MesLedger[], informativa = false) {
  return meses.map((m) => ({
    Año: m.anio,
    Mes: nombreMes(m.anio, m.mes),
    "Saldo inicial": r2(m.saldoInicial),
    Depósitos: r2(m.depositos),
    Retiros: r2(m.retiros),
    "Base operativa": r2(m.baseOperativa),
    Resultado: r2(m.rendBruto),
    ...(informativa
      ? { "Base comisión": r2(m.baseComision), "Comisión (cobrada aparte)": r2(m.comision) }
      : { Comisión: r2(m.comision), "Rend. neto": r2(m.rendNeto) }),
    "ROI %": r4(m.roiMes * 100),
    "Saldo final": r2(m.saldoFinal),
  }));
}

function filasAnuales(porAnio: ResumenAnual[]) {
  return porAnio.map((a) => ({
    Año: a.anio,
    "Depósitos": r2(a.depositos),
    "Retiros": r2(a.retiros),
    "Resultado neto": r2(a.rendNeto),
    Comisión: r2(a.comision),
    "ROI anual %": r4(a.roiAnual * 100),
    "Saldo cierre": r2(a.saldoFinal),
  }));
}

function autoWidth(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]!).map((k) => {
    const max = Math.max(k.length, ...rows.map((row) => String(row[k] ?? "").length));
    return { wch: Math.min(28, max + 2) };
  });
}

function hoja(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoWidth(rows);
  return ws;
}

/** Workbook por cliente: hoja mensual + hoja anual. */
export function workbookCliente(item: ItemLedger): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hoja(filasMensuales(item.meses, item.tratamientoComision !== "descontada")), "Mensual");
  XLSX.utils.book_append_sheet(wb, hoja(filasAnuales(item.porAnio)), "Anual");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** CSV mensual por cliente. */
export function csvCliente(item: ItemLedger): string {
  const ws = XLSX.utils.json_to_sheet(filasMensuales(item.meses, item.tratamientoComision !== "descontada"));
  return XLSX.utils.sheet_to_csv(ws);
}

/** Workbook consolidado: resumen + una hoja con todos los meses de todos. */
export function workbookConsolidado(items: ItemLedger[]): Buffer {
  const wb = XLSX.utils.book_new();

  const resumen = items.map((it) => ({
    Cliente: it.cliente.nombre,
    Estado: it.cliente.estado,
    "Saldo actual": r2(it.resumen.saldoActual),
    "Ganancia neta": r2(it.resumen.gananciaNeta),
    "ROI acumulado %": r4(it.resumen.roiAcumulado * 100),
    "Comisión acumulada": r2(it.resumen.comisionOperador),
  }));
  XLSX.utils.book_append_sheet(wb, hoja(resumen), "Resumen");

  const todos = items.flatMap((it) =>
    filasMensuales(it.meses, it.tratamientoComision !== "descontada").map((f) => ({ Cliente: it.cliente.nombre, ...f })),
  );
  XLSX.utils.book_append_sheet(wb, hoja(todos), "Detalle mensual");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Workbook de comisiones del operador: por mes y por cliente. */
export function workbookComisiones(items: ItemLedger[]): Buffer {
  const wb = XLSX.utils.book_new();

  const porCliente = items.map((it) => ({
    Cliente: it.cliente.nombre,
    "Comisión acumulada": r2(it.resumen.comisionOperador),
  }));
  XLSX.utils.book_append_sheet(wb, hoja(porCliente), "Por cliente");

  // Comisión por mes (agregada) y por cliente-mes.
  const agg = new Map<string, { anio: number; mes: number; comision: number }>();
  const detalle: Record<string, unknown>[] = [];
  for (const it of items) {
    for (const m of it.meses) {
      if (m.comision === 0 && !m.tieneRendimiento) continue;
      detalle.push({
        Cliente: it.cliente.nombre,
        Año: m.anio,
        Mes: nombreMes(m.anio, m.mes),
        "Comisión": r2(m.comision),
      });
      const cur = agg.get(m.key) ?? { anio: m.anio, mes: m.mes, comision: 0 };
      cur.comision += m.comision;
      agg.set(m.key, cur);
    }
  }
  const porMes = [...agg.values()]
    .sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes))
    .map((s) => ({ Año: s.anio, Mes: nombreMes(s.anio, s.mes), "Comisión total": r2(s.comision) }));

  XLSX.utils.book_append_sheet(wb, hoja(porMes), "Por mes");
  XLSX.utils.book_append_sheet(wb, hoja(detalle), "Detalle");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
