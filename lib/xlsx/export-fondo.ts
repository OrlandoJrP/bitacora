import "server-only";
import * as XLSX from "xlsx";
import type { PoolLedger } from "@/lib/data/pool";
import { nombreMes } from "@/lib/format";

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

function hoja(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (rows.length > 0) {
    ws["!cols"] = Object.keys(rows[0]!).map((k) => {
      const max = Math.max(k.length, ...rows.map((row) => String(row[k] ?? "").length));
      return { wch: Math.min(30, max + 2) };
    });
  }
  return ws;
}

/** Workbook del fondo: Resumen por socio + Mensual + Movimientos + Comisión. */
export function workbookFondo(pool: PoolLedger): Buffer {
  const wb = XLSX.utils.book_new();
  const r = pool.resumen;
  const nombrePorSocio = new Map(pool.socios.map((s) => [s.id, s.nombre]));

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      r.socios.map((s) => ({
        Socio: s.nombre + (s.estado === "inactivo" ? " (salió)" : ""),
        "Capital actual": r2(s.capitalActual),
        "% del fondo": r4(s.participacion * 100),
        "Capital aportado": r2(s.totalAportado),
        Retiros: r2(s.totalRetirado),
        "Ganancia neta": r2(s.gananciaNeta),
        "Ganancia / Aportado %": r4(s.rentabilidad * 100),
      })),
    ),
    "Resumen",
  );

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      pool.meses.map((m) => ({
        Año: m.anio,
        Mes: nombreMes(m.anio, m.mes) + (m.enCurso ? " (en curso *)" : ""),
        "Capital inicial": r2(m.saldoInicial),
        Aportes: r2(m.aportes),
        Retiros: r2(m.retiros),
        Resultado: r2(m.resultado),
        "Tasa % (TWR)": r4(m.tasaTwr * 100),
        "Capital final": r2(m.saldoFinal),
      })),
    ),
    "Mensual",
  );

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      pool.movimientos.map((m) => ({
        Fecha: m.fecha,
        Socio: nombrePorSocio.get(m.socioId) ?? "—",
        Tipo: m.tipo === "deposito" ? "Aporte" : "Retiro",
        Monto: r2(Number(m.monto)),
        Concepto: m.descripcion ?? "",
        Transferencia: m.transferenciaId ? "Sí" : "",
      })),
    ),
    "Movimientos",
  );

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      pool.meses
        .filter((m) => m.tieneRendimiento)
        .map((m) => ({
          Año: m.anio,
          Mes: nombreMes(m.anio, m.mes),
          "Resultado del fondo": r2(m.resultado),
          "Ganancia acumulada": r2(m.gananciaAcumulada),
          "Comisión acumulada (informativa)": r2(m.comisionAcumulada),
          "Comisión del mes": r2(m.comisionMes),
        })),
    ),
    "Comision (informativa)",
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
