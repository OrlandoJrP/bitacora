/** Exporta la cadena del fondo (motor puro, desde las constantes) a JSON.
 *  Uso: tsx scripts/export-fondo-json.ts <destino.json> — insumo de reportes. */
import { writeFileSync } from "node:fs";
import { construirCadenaPool, resumenPool, type PoolInput } from "../lib/finance/pool";
import { FONDO, MOVIMIENTOS, OVERRIDES, RENDIMIENTOS, SOCIOS } from "./data/fondo-historico";

const input: PoolInput = {
  fechaInicio: FONDO.fechaInicio,
  socios: SOCIOS.map((s) => ({
    id: s.ref,
    nombre: s.nombre,
    capitalInicial: s.capitalInicial,
    fechaAlta: s.fechaAlta,
    estado: s.estado,
  })),
  movimientos: MOVIMIENTOS.map((m) => ({
    socioId: m.socio,
    tipo: m.tipo,
    monto: m.monto,
    fecha: m.fecha,
    transferenciaId: m.transferRef ?? null,
    descripcion: m.descripcion,
  })),
  rendimientos: RENDIMIENTOS.map((r) => ({
    anio: r.anio,
    mes: r.mes,
    modo: r.modo,
    valor: r.valor,
    enCurso: r.enCurso ?? false,
    tasaTwr: r.tasaTwr ?? null,
    descripcion: r.descripcion ?? null,
  })),
  overrides: OVERRIDES.map((o) => ({
    socioId: o.socio,
    anio: o.anio,
    mes: o.mes,
    saldoFinal: o.saldoFinal,
  })),
  config: { comisionPct: Number(FONDO.comisionPct), baseComision: FONDO.baseComision },
};

const meses = construirCadenaPool(input);
const resumen = resumenPool(meses, input);
const dest = process.argv[2];
if (!dest) throw new Error("Uso: tsx scripts/export-fondo-json.ts <destino.json>");
writeFileSync(
  dest,
  JSON.stringify({ fondo: FONDO, socios: SOCIOS, movimientos: MOVIMIENTOS, meses, resumen }, null, 1),
  "utf8",
);
console.log(`✓ Exportado a ${dest}: ${meses.length} meses.`);
