/**
 * scripts/seed-fondo.ts — Importa el historial real del fondo compartido y lo
 * VERIFICA al centavo contra el cuadro del Excel.
 *
 *   pnpm db:seed-fondo -- --check   → solo verifica la transcripción en memoria
 *                                     (motor + datos, sin tocar la BD)
 *   pnpm db:seed-fondo              → verifica, importa (idempotente) y vuelve a
 *                                     verificar leyendo desde la BD
 *
 * Sale con código ≠ 0 si algún mes no cuadra (gate de aceptación).
 */
import "./load-env";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { connectForScript } from "./db-connect";
import {
  fondos,
  fondoSocios,
  fondoMovimientos,
  fondoRendimientos,
  fondoOverrides,
} from "../drizzle/schema";
import {
  construirCadenaPool,
  resumenPool,
  type PoolInput,
} from "../lib/finance/pool";
import { round2 } from "../lib/finance/ledger";
import {
  ESPERADO,
  FONDO,
  MOVIMIENTOS,
  OVERRIDES,
  RENDIMIENTOS,
  SOCIOS,
  TWR_2026_ESPERADO_PCT,
  TWR_ESPERADO_PCT,
} from "./data/fondo-historico";

const SOLO_CHECK = process.argv.includes("--check");

/* ── Construcción del input del motor desde las constantes ───────────────── */
function inputDesdeConstantes(): PoolInput {
  return {
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
}

/* ── Verificación contra ESPERADO ────────────────────────────────────────── */
function verificar(input: PoolInput, etiqueta: string): boolean {
  const meses = construirCadenaPool(input);
  const porKey = new Map(meses.map((m) => [`${m.anio}-${m.mes}`, m]));
  let fallos = 0;

  console.log(`\n→ Verificando ${etiqueta} (${ESPERADO.length} meses)…`);
  for (const e of ESPERADO) {
    const m = porKey.get(`${e.anio}-${e.mes}`);
    if (!m) {
      console.error(`  ✗ ${e.mes}/${e.anio}: mes ausente en la cadena`);
      fallos++;
      continue;
    }
    const problemas: string[] = [];
    if (m.saldoFinal !== e.fondo) problemas.push(`fondo ${m.saldoFinal} ≠ ${e.fondo}`);
    for (const ref of ["LENIN", "ARLET", "RAILEN"] as const) {
      const socio = m.socios.find((s) => s.socioId === ref || s.socioId.startsWith(ref));
      const real = socio?.saldoFinal ?? NaN;
      if (real !== e[ref]) problemas.push(`${ref} ${real} ≠ ${e[ref]}`);
    }
    if (m.descuadre !== 0) problemas.push(`descuadre ${m.descuadre}`);
    if (problemas.length) {
      console.error(`  ✗ ${String(e.mes).padStart(2, "0")}/${e.anio}: ${problemas.join(" | ")}`);
      fallos++;
    }
  }

  const r = resumenPool(meses, input);
  const twrTotal = round2(r.twrDesdeInicio * 100);
  const twr2026 = round2(r.twrAnual * 100);
  if (twrTotal !== TWR_ESPERADO_PCT) {
    console.error(`  ✗ TWR desde inicio: ${twrTotal}% ≠ ${TWR_ESPERADO_PCT}%`);
    fallos++;
  }
  if (twr2026 !== TWR_2026_ESPERADO_PCT) {
    console.error(`  ✗ TWR 2026: ${twr2026}% ≠ ${TWR_2026_ESPERADO_PCT}%`);
    fallos++;
  }

  if (fallos === 0) {
    console.log(
      `  ✓ ${ESPERADO.length} meses al centavo · TWR ${twrTotal}% · capital ${r.capitalActual.toFixed(2)} · comisión informativa ${r.comisionPorCobrar.toFixed(2)}`,
    );
  }
  return fallos === 0;
}

/* ── Seed idempotente y TRANSACCIONAL ────────────────────────────────────────
 * Todo (fondo, socios, movimientos, rendimientos, overrides y la verificación
 * post-import leyendo de la BD) corre en UNA transacción: si algo no cuadra
 * al centavo, se revierte y la base queda exactamente como estaba. */
async function seed(): Promise<void> {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  const dbi = drizzle(sql);

  try {
    await dbi.transaction(async (db) => {
  // 1) Fondo (por nombre). GUARDIA: si no aparece por nombre pero SÍ existen
  // otros fondos (p. ej. fue renombrado en Admin), abortamos en vez de crear
  // un duplicado con todo el historial.
  let [fondo] = await db.select().from(fondos).where(eq(fondos.nombre, FONDO.nombre)).limit(1);
  if (!fondo) {
    const otros = await db.select({ nombre: fondos.nombre }).from(fondos);
    if (otros.length > 0) {
      throw new Error(
        `No existe un fondo llamado "${FONDO.nombre}" pero hay ${otros.length} fondo(s): ` +
          otros.map((o) => `"${o.nombre}"`).join(", ") +
          `. Si lo renombraste en Admin, actualiza FONDO.nombre en scripts/data/fondo-historico.ts.`,
      );
    }
    [fondo] = await db
      .insert(fondos)
      .values({
        nombre: FONDO.nombre,
        fechaInicio: FONDO.fechaInicio,
        capitalInicial: FONDO.capitalInicial,
        comisionPct: FONDO.comisionPct,
        baseComision: FONDO.baseComision,
        notas: FONDO.notas,
      })
      .returning();
    console.log(`✓ Fondo creado: ${FONDO.nombre}`);
  } else {
    console.log(`• Fondo ya existe: ${FONDO.nombre}`);
  }
  const fondoId = fondo!.id;

  // 2) Socios (por nombre dentro del fondo).
  const idPorRef = new Map<string, string>();
  for (const s of SOCIOS) {
    const [existente] = await db
      .select()
      .from(fondoSocios)
      .where(and(eq(fondoSocios.fondoId, fondoId), eq(fondoSocios.nombre, s.nombre)))
      .limit(1);
    if (existente) {
      idPorRef.set(s.ref, existente.id);
      continue;
    }
    const [nuevo] = await db
      .insert(fondoSocios)
      .values({
        fondoId,
        clienteId: null,
        nombre: s.nombre,
        capitalInicial: s.capitalInicial,
        fechaAlta: s.fechaAlta,
        estado: s.estado,
      })
      .returning();
    idPorRef.set(s.ref, nuevo!.id);
    console.log(`✓ Socio creado: ${s.nombre}`);
  }

  // 3) Movimientos (firma para idempotencia) con transferencias enlazadas.
  const existentes = await db
    .select()
    .from(fondoMovimientos)
    .where(eq(fondoMovimientos.fondoId, fondoId));
  const firmaDe = (socioId: string, tipo: string, fecha: string, monto: number | string, descripcion: string | null) =>
    `${socioId}|${tipo}|${fecha}|${Number(monto)}|${descripcion ?? ""}`;
  const firmas = new Set(
    existentes.map((m) => firmaDe(m.socioId, m.tipo, m.fecha, m.monto, m.descripcion)),
  );
  // Si una pata de la transferencia ya existe en BD, reutiliza SU
  // transferencia_id para la pata que falte (evita pares desenlazados en
  // re-ejecuciones tras un fallo parcial).
  const transferIds = new Map<string, string>();
  for (const m of MOVIMIENTOS) {
    if (!m.transferRef || transferIds.has(m.transferRef)) continue;
    const socioId = idPorRef.get(m.socio)!;
    const firma = firmaDe(socioId, m.tipo, m.fecha, m.monto, m.descripcion);
    const ex = existentes.find(
      (e) =>
        e.transferenciaId && firmaDe(e.socioId, e.tipo, e.fecha, e.monto, e.descripcion) === firma,
    );
    if (ex?.transferenciaId) transferIds.set(m.transferRef, ex.transferenciaId);
  }
  let nuevosMovs = 0;
  for (const m of MOVIMIENTOS) {
    const socioId = idPorRef.get(m.socio)!;
    const firma = firmaDe(socioId, m.tipo, m.fecha, m.monto, m.descripcion);
    if (firmas.has(firma)) continue;
    let transferenciaId: string | null = null;
    if (m.transferRef) {
      if (!transferIds.has(m.transferRef)) transferIds.set(m.transferRef, randomUUID());
      transferenciaId = transferIds.get(m.transferRef)!;
    }
    await db.insert(fondoMovimientos).values({
      fondoId,
      socioId,
      tipo: m.tipo,
      monto: m.monto,
      fecha: m.fecha,
      transferenciaId,
      descripcion: m.descripcion,
    });
    nuevosMovs++;
  }
  console.log(`✓ Movimientos: ${nuevosMovs} nuevos (${MOVIMIENTOS.length} totales).`);

  // 4) Rendimientos (upsert por fondo+anio+mes).
  for (const r of RENDIMIENTOS) {
    await db
      .insert(fondoRendimientos)
      .values({
        fondoId,
        anio: r.anio,
        mes: r.mes,
        modo: r.modo,
        valor: Number(r.valor).toFixed(4),
        enCurso: r.enCurso ?? false,
        tasaTwr: r.tasaTwr != null ? Number(r.tasaTwr).toFixed(4) : null,
        descripcion: r.descripcion ?? null,
      })
      .onConflictDoUpdate({
        target: [fondoRendimientos.fondoId, fondoRendimientos.anio, fondoRendimientos.mes],
        set: {
          modo: r.modo,
          valor: Number(r.valor).toFixed(4),
          enCurso: r.enCurso ?? false,
          tasaTwr: r.tasaTwr != null ? Number(r.tasaTwr).toFixed(4) : null,
          descripcion: r.descripcion ?? null,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`✓ Rendimientos: ${RENDIMIENTOS.length} meses (upsert).`);

  // 5) Overrides (upsert por socio+anio+mes).
  for (const o of OVERRIDES) {
    const socioId = idPorRef.get(o.socio)!;
    await db
      .insert(fondoOverrides)
      .values({
        fondoId,
        socioId,
        anio: o.anio,
        mes: o.mes,
        saldoFinal: o.saldoFinal,
        motivo: "Reparto histórico del Excel",
      })
      .onConflictDoUpdate({
        target: [fondoOverrides.socioId, fondoOverrides.anio, fondoOverrides.mes],
        set: { saldoFinal: o.saldoFinal, updatedAt: new Date() },
      });
  }
  console.log(`✓ Overrides: ${OVERRIDES.length} (upsert).`);

  // 6) Re-verificación leyendo desde la BD (gate end-to-end).
  const sociosDb = await db
    .select()
    .from(fondoSocios)
    .where(eq(fondoSocios.fondoId, fondoId))
    .orderBy(asc(fondoSocios.fechaAlta), asc(fondoSocios.id));
  const movsDb = await db
    .select()
    .from(fondoMovimientos)
    .where(eq(fondoMovimientos.fondoId, fondoId));
  const rendsDb = await db
    .select()
    .from(fondoRendimientos)
    .where(eq(fondoRendimientos.fondoId, fondoId));
  const ovrsDb = await db
    .select()
    .from(fondoOverrides)
    .where(eq(fondoOverrides.fondoId, fondoId));

  // Para comparar contra ESPERADO usamos el nombre en MAYÚSCULAS como id lógico.
  const refPorId = new Map([...idPorRef.entries()].map(([ref, id]) => [id, ref]));
  const inputDb: PoolInput = {
    fechaInicio: fondo!.fechaInicio,
    socios: sociosDb.map((s) => ({
      id: refPorId.get(s.id) ?? s.id,
      nombre: s.nombre,
      capitalInicial: s.capitalInicial,
      fechaAlta: s.fechaAlta,
      estado: s.estado,
    })),
    movimientos: movsDb.map((m) => ({
      socioId: refPorId.get(m.socioId) ?? m.socioId,
      tipo: m.tipo,
      monto: m.monto,
      fecha: m.fecha,
      transferenciaId: m.transferenciaId,
      descripcion: m.descripcion,
    })),
    rendimientos: rendsDb.map((r) => ({
      anio: r.anio,
      mes: r.mes,
      modo: r.modo,
      valor: r.valor,
      enCurso: r.enCurso,
      tasaTwr: r.tasaTwr,
      descripcion: r.descripcion,
    })),
    overrides: ovrsDb.map((o) => ({
      socioId: refPorId.get(o.socioId) ?? o.socioId,
      anio: o.anio,
      mes: o.mes,
      saldoFinal: o.saldoFinal,
    })),
    config: { comisionPct: Number(fondo!.comisionPct), baseComision: fondo!.baseComision },
  };

  const okDb = verificar(inputDb, "datos importados (dentro de la transacción)");
  if (!okDb) {
    // Lanza → rollback de TODO el seed: la base queda intacta.
    throw new Error("La verificación post-import falló. Se revirtió toda la importación.");
  }
    });
  } finally {
    await sql.end();
  }
  console.log("\n✓ Importación del fondo completa, verificada al centavo y confirmada (commit).");
}

/* ── Main ────────────────────────────────────────────────────────────────── */
async function main() {
  const okMemoria = verificar(inputDesdeConstantes(), "transcripción (en memoria)");
  if (!okMemoria) {
    console.error("\n✗ La transcripción no cuadra con el cuadro esperado. No se importa nada.");
    process.exit(1);
  }
  if (SOLO_CHECK) {
    console.log("\n✓ Verificación en memoria OK (no se tocó la base de datos).");
    return;
  }
  await seed();
}

main().catch((err) => {
  console.error("✗ Error:", err);
  process.exit(1);
});
