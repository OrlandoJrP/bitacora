/**
 * scripts/seed-daniel.ts — Importa la cuenta MT5 de Daniel Flores y la VERIFICA
 * al centavo contra el balance del propio reporte de Exness.
 *
 *   pnpm db:seed-daniel -- --check  → solo verifica la transcripción en memoria
 *   pnpm db:seed-daniel             → verifica, importa (idempotente, en UNA
 *                                     transacción) y re-verifica desde la BD;
 *                                     si algo no cuadra, ROLLBACK y exit ≠ 0.
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { connectForScript } from "./db-connect";
import { clientes, movimientos, rendimientosMensuales } from "../drizzle/schema";
import { construirCadena, round2, type LedgerInput } from "../lib/finance/ledger";
import {
  APORTADO_ESPERADO,
  CLIENTE,
  COMISION_DEVENGADA_ESPERADA,
  DEFICIT_PENDIENTE_ESPERADO,
  ESPERADO,
  MOVIMIENTOS,
  RENDIMIENTOS,
  RESULTADO_TOTAL_ESPERADO,
  RESULTADO_TRADING_ESPERADO,
  RETIRADO_ESPERADO,
  SALDO_ACTUAL_ESPERADO,
} from "./data/daniel-historico";

const SOLO_CHECK = process.argv.includes("--check");

function inputDesdeConstantes(): LedgerInput {
  return {
    capitalInicial: CLIENTE.capitalInicial,
    fechaIngreso: CLIENTE.fechaIngreso,
    rendimientos: RENDIMIENTOS.map((r) => ({
      anio: r.anio,
      mes: r.mes,
      modo: "saldo_final" as const,
      valor: r.valor,
      resultadoComisionable: r.resultadoComisionable,
      descripcion: r.descripcion,
    })),
    movimientos: MOVIMIENTOS.map((m) => ({
      tipo: m.tipo,
      monto: m.monto,
      fecha: m.fecha,
      descripcion: m.descripcion,
    })),
    config: {
      comisionPct: Number(CLIENTE.comisionPct),
      usaHighWaterMark: false,
      pierdeSoloCliente: true,
      politica: CLIENTE.politicaComision,
      comisionInformativa: CLIENTE.comisionInformativa,
    },
  };
}

function verificar(input: LedgerInput, etiqueta: string): boolean {
  const meses = construirCadena(input);
  const porKey = new Map(meses.map((m) => [`${m.anio}-${m.mes}`, m]));
  let fallos = 0;

  console.log(`\n→ Verificando ${etiqueta} (${ESPERADO.length} meses)…`);
  for (const e of ESPERADO) {
    const m = porKey.get(`${e.anio}-${e.mes}`);
    if (!m) {
      console.error(`  ✗ ${e.mes}/${e.anio}: mes ausente`);
      fallos++;
      continue;
    }
    const problemas: string[] = [];
    if (m.saldoFinal !== e.saldoFinal) problemas.push(`saldo ${m.saldoFinal} ≠ ${e.saldoFinal}`);
    if (m.comision !== e.comision) problemas.push(`comisión ${m.comision} ≠ ${e.comision}`);
    if (m.deficitAcum !== e.deficit) problemas.push(`déficit ${m.deficitAcum} ≠ ${e.deficit}`);
    if (problemas.length) {
      console.error(`  ✗ ${String(e.mes).padStart(2, "0")}/${e.anio}: ${problemas.join(" | ")}`);
      fallos++;
    }
  }

  const ultimo = meses[meses.length - 1]!;
  const totalDepositos = round2(meses.reduce((s, m) => s + m.depositos, 0));
  const totalRetiros = round2(meses.reduce((s, m) => s + m.retiros, 0));
  const comisionTotal = round2(meses.reduce((s, m) => s + m.comision, 0));
  const aportado = round2(Number(CLIENTE.capitalInicial) + totalDepositos);

  const checks: Array<[string, number, number]> = [
    ["Aportado (capital inicial + depósitos)", aportado, APORTADO_ESPERADO],
    ["Retirado de la cuenta", totalRetiros, RETIRADO_ESPERADO],
    ["Saldo actual", ultimo.saldoFinal, SALDO_ACTUAL_ESPERADO],
    ["Comisión devengada", comisionTotal, COMISION_DEVENGADA_ESPERADA],
    ["Déficit pendiente", ultimo.deficitAcum, DEFICIT_PENDIENTE_ESPERADO],
  ];
  for (const [etq, real, esperado] of checks) {
    if (real !== esperado) {
      console.error(`  ✗ ${etq}: ${real} ≠ ${esperado}`);
      fallos++;
    }
  }

  // Anclas INDEPENDIENTES contra el reporte de Exness. Ojo: comparar
  // "aportado − retirado + Σ rendNeto" contra el saldo NO sirve como
  // verificación: en modo saldo_final esa suma telescopa al último saldo por
  // construcción y no puede fallar nunca. Lo que sí detecta un error de
  // captura es contrastar los totales contra las cifras del propio bróker.
  const resultadoTotal = round2(meses.reduce((s, m) => s + m.rendNeto, 0));
  const totalTrading = round2(
    RENDIMIENTOS.reduce((s, r) => s + Number(r.resultadoComisionable), 0),
  );
  if (resultadoTotal !== RESULTADO_TOTAL_ESPERADO) {
    console.error(`  ✗ Resultado total: ${resultadoTotal} ≠ ${RESULTADO_TOTAL_ESPERADO}`);
    fallos++;
  }
  if (totalTrading !== RESULTADO_TRADING_ESPERADO) {
    console.error(
      `  ✗ Resultado de trading (Total Net Profit del reporte): ${totalTrading} ≠ ${RESULTADO_TRADING_ESPERADO}`,
    );
    fallos++;
  }
  // La diferencia entre ambos son las recompensas del bróker y los dividendos,
  // que son 100% del cliente y no entran en el reparto.
  const otros = round2(resultadoTotal - totalTrading);
  if (otros !== round2(RESULTADO_TOTAL_ESPERADO - RESULTADO_TRADING_ESPERADO)) {
    console.error(`  ✗ Recompensas + dividendos: ${otros} no cuadra`);
    fallos++;
  }

  if (fallos === 0) {
    console.log(
      `  ✓ ${ESPERADO.length} meses al centavo · saldo ${ultimo.saldoFinal.toFixed(2)} · aportado ${aportado.toFixed(2)} · ` +
        `retirado ${totalRetiros.toFixed(2)} · resultado ${resultadoTotal.toFixed(2)} · comisión devengada ${comisionTotal.toFixed(2)} · ` +
        `déficit ${ultimo.deficitAcum.toFixed(2)}`,
    );
  }
  return fallos === 0;
}

async function seed(): Promise<void> {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  const db = drizzle(sql);

  try {
    await db.transaction(async (tx) => {
      // 1) Cliente por email (idempotente). GUARDIA anti-duplicados: si el
      // correo cambió en Admin pero el nombre ya existe, abortamos.
      let [cli] = await tx.select().from(clientes).where(eq(clientes.email, CLIENTE.email)).limit(1);
      if (!cli) {
        const [porNombre] = await tx
          .select({ id: clientes.id, email: clientes.email })
          .from(clientes)
          .where(eq(clientes.nombre, CLIENTE.nombre))
          .limit(1);
        if (porNombre) {
          throw new Error(
            `Ya existe un cliente "${CLIENTE.nombre}" con otro correo (${porNombre.email}). ` +
              `El seed no se re-aplica para no duplicar la cuenta; revisa Admin → Clientes.`,
          );
        }
        [cli] = await tx
          .insert(clientes)
          .values({
            nombre: CLIENTE.nombre,
            email: CLIENTE.email,
            fechaIngreso: CLIENTE.fechaIngreso,
            capitalInicial: CLIENTE.capitalInicial,
            comisionPct: CLIENTE.comisionPct,
            politicaComision: CLIENTE.politicaComision,
            comisionInformativa: CLIENTE.comisionInformativa,
            estado: CLIENTE.estado,
            notas: CLIENTE.notas,
          })
          .returning();
        console.log(`✓ Cliente creado: ${CLIENTE.nombre}`);
      } else {
        await tx
          .update(clientes)
          .set({
            capitalInicial: CLIENTE.capitalInicial,
            fechaIngreso: CLIENTE.fechaIngreso,
            comisionPct: CLIENTE.comisionPct,
            politicaComision: CLIENTE.politicaComision,
            comisionInformativa: CLIENTE.comisionInformativa,
            estado: CLIENTE.estado,
            notas: CLIENTE.notas,
            updatedAt: new Date(),
          })
          .where(eq(clientes.id, cli.id));
        console.log(`• Cliente ya existe: ${CLIENTE.nombre} (condiciones aseguradas).`);
      }
      const clienteId = cli!.id;

      // 2) Movimientos (idempotencia por firma).
      const existentes = await tx
        .select()
        .from(movimientos)
        .where(eq(movimientos.clienteId, clienteId));
      const firmas = new Set(
        existentes.map((m) => `${m.tipo}|${m.fecha}|${Number(m.monto)}|${m.descripcion ?? ""}`),
      );
      let nuevos = 0;
      for (const m of MOVIMIENTOS) {
        const firma = `${m.tipo}|${m.fecha}|${Number(m.monto)}|${m.descripcion}`;
        if (firmas.has(firma)) continue;
        await tx.insert(movimientos).values({
          clienteId,
          tipo: m.tipo,
          monto: m.monto,
          fecha: m.fecha,
          descripcion: m.descripcion,
        });
        nuevos++;
      }
      console.log(`✓ Movimientos: ${nuevos} nuevos (${MOVIMIENTOS.length} totales).`);

      // 3) Rendimientos saldo_final (upsert por cliente+anio+mes).
      // AVISO: el seed reescribe los 12 meses. Si el operador corrigió alguno
      // desde el panel, se pierde esa corrección — y como el ESPERADO es el del
      // Excel original, la verificación no lo detectaría. Lo hacemos visible.
      const previos = await tx
        .select()
        .from(rendimientosMensuales)
        .where(eq(rendimientosMensuales.clienteId, clienteId));
      const previoPorMes = new Map(previos.map((r) => [`${r.anio}-${r.mes}`, r]));
      const pisados: string[] = [];
      for (const r of RENDIMIENTOS) {
        const p = previoPorMes.get(`${r.anio}-${r.mes}`);
        if (p && Number(p.valor) !== Number(r.valor)) {
          pisados.push(
            `${String(r.mes).padStart(2, "0")}/${r.anio}: ${Number(p.valor).toFixed(2)} → ${Number(r.valor).toFixed(2)}`,
          );
        }
      }
      if (pisados.length) {
        console.warn(
          `⚠ El seed va a SOBRESCRIBIR ${pisados.length} mes(es) que ya tenían otro saldo en la base:\n    ` +
            pisados.join("\n    ") +
            `\n  Si esos cambios eran correcciones hechas en el panel, cancela y actualiza scripts/data/daniel-historico.ts.`,
        );
      }

      for (const r of RENDIMIENTOS) {
        await tx
          .insert(rendimientosMensuales)
          .values({
            clienteId,
            anio: r.anio,
            mes: r.mes,
            modo: "saldo_final",
            valor: Number(r.valor).toFixed(4),
            resultadoComisionable: Number(r.resultadoComisionable).toFixed(2),
            descripcion: r.descripcion,
          })
          .onConflictDoUpdate({
            target: [
              rendimientosMensuales.clienteId,
              rendimientosMensuales.anio,
              rendimientosMensuales.mes,
            ],
            set: {
              modo: "saldo_final",
              valor: Number(r.valor).toFixed(4),
              resultadoComisionable: Number(r.resultadoComisionable).toFixed(2),
              descripcion: r.descripcion,
              updatedAt: new Date(),
            },
          });
      }
      console.log(`✓ Rendimientos: ${RENDIMIENTOS.length} meses (upsert).`);

      // 4) Re-verificación desde la BD DENTRO de la transacción.
      const [cliDb] = await tx.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1);
      const movsDb = await tx
        .select()
        .from(movimientos)
        .where(eq(movimientos.clienteId, clienteId));
      const rendsDb = await tx
        .select()
        .from(rendimientosMensuales)
        .where(eq(rendimientosMensuales.clienteId, clienteId));

      const inputDb: LedgerInput = {
        capitalInicial: cliDb!.capitalInicial,
        fechaIngreso: cliDb!.fechaIngreso,
        rendimientos: rendsDb.map((r) => ({
          anio: r.anio,
          mes: r.mes,
          modo: r.modo,
          valor: r.valor,
          resultadoComisionable: r.resultadoComisionable,
          descripcion: r.descripcion,
        })),
        movimientos: movsDb.map((m) => ({
          tipo: m.tipo,
          monto: m.monto,
          fecha: m.fecha,
          descripcion: m.descripcion,
        })),
        config: {
          comisionPct: Number(cliDb!.comisionPct ?? CLIENTE.comisionPct),
          usaHighWaterMark: false,
          pierdeSoloCliente: true,
          politica: cliDb!.politicaComision ?? CLIENTE.politicaComision,
          comisionInformativa: cliDb!.comisionInformativa,
        },
      };

      if (!verificar(inputDb, "datos importados (dentro de la transacción)")) {
        throw new Error("La verificación post-import no cuadra: ROLLBACK.");
      }
    });
  } finally {
    await sql.end();
  }
  console.log("\n✓ Cuenta de Daniel Flores importada, verificada al centavo y confirmada (commit).");
}

async function main() {
  if (!verificar(inputDesdeConstantes(), "transcripción (en memoria)")) {
    console.error("\n✗ La transcripción no cuadra. No se importa nada.");
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
