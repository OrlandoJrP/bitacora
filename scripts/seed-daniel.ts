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
import { construirCadena, num, round2, type LedgerInput } from "../lib/finance/ledger";
import {
  APORTADO_ESPERADO,
  CAPITAL_BASE,
  CLIENTE,
  COMISION_DEVENGADA_ESPERADA,
  ESPERADO,
  FALTA_PARA_BASE_ESPERADO,
  GANANCIA_LIQUIDADA_ESPERADA,
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
      tratamientoComision: CLIENTE.tratamientoComision,
      capitalBase: Number(CLIENTE.capitalBase),
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

  // OJO: se suma desde `input`, NO desde las constantes del módulo. Si leyera
  // RENDIMIENTOS, la pasada post-import compararía el archivo contra sí mismo
  // y no detectaría que la BD quedó con otros valores.
  const gananciaLiquidada = round2(
    input.rendimientos.reduce((s, r) => s + num(r.resultadoComisionable), 0),
  );
  const faltaParaBase = round2(Math.max(0, CAPITAL_BASE - ultimo.saldoFinal));
  const checks: Array<[string, number, number]> = [
    ["Aportado (capital inicial + depósitos)", aportado, APORTADO_ESPERADO],
    ["Retirado de la cuenta", totalRetiros, RETIRADO_ESPERADO],
    ["Saldo actual", ultimo.saldoFinal, SALDO_ACTUAL_ESPERADO],
    ["Ganancia liquidada (base del 35%)", gananciaLiquidada, GANANCIA_LIQUIDADA_ESPERADA],
    ["Comisión devengada", comisionTotal, COMISION_DEVENGADA_ESPERADA],
    ["Falta para volver a la base", faltaParaBase, FALTA_PARA_BASE_ESPERADO],
    // El 35% tiene que salir exacto de la ganancia liquidada.
    ["Comisión = 35% de la ganancia liquidada", comisionTotal, round2(gananciaLiquidada * 0.35)],
  ];
  for (const [etq, real, esperado] of checks) {
    if (real !== esperado) {
      console.error(`  ✗ ${etq}: ${real} ≠ ${esperado}`);
      fallos++;
    }
  }

  // Ancla contra el reporte de Exness. Ojo con dos trampas que ya estuvieron
  // aquí: (a) comparar "aportado − retirado + Σ rendNeto" contra el saldo NO
  // verifica nada, porque en modo saldo_final esa suma telescopa al último
  // saldo por construcción; (b) derivar una constante de otras dos y luego
  // compararla contra ellas tampoco, porque es una identidad.
  //
  // Lo que SÍ detecta un error de captura es esto: el resultado total sale de
  // la cadena (capital inicial, 40 movimientos y 12 saldos de cierre) y se
  // compara contra una cifra fija tomada del reporte. Si alguien toca un saldo
  // o un movimiento, deja de cuadrar.
  const resultadoTotal = round2(meses.reduce((s, m) => s + m.rendNeto, 0));
  if (resultadoTotal !== RESULTADO_TOTAL_ESPERADO) {
    console.error(`  ✗ Resultado total de la cuenta: ${resultadoTotal} ≠ ${RESULTADO_TOTAL_ESPERADO}`);
    fallos++;
  }
  // RESULTADO_TRADING_ESPERADO es el "Total Net Profit" que declara Exness. No
  // se puede recalcular desde la cadena mensual (el desglose trading vs
  // recompensas no vive en la base), así que aquí solo se documenta la
  // relación; no la tomes por una verificación.
  if (round2(RESULTADO_TOTAL_ESPERADO - RESULTADO_TRADING_ESPERADO) !== 2934.31) {
    console.error(`  ✗ Las constantes del reporte no cuadran entre sí: total − trading ≠ 2934.31`);
    fallos++;
  }

  if (fallos === 0) {
    console.log(
      `  ✓ ${ESPERADO.length} meses al centavo · saldo ${ultimo.saldoFinal.toFixed(2)} · aportado ${aportado.toFixed(2)} · ` +
        `retirado ${totalRetiros.toFixed(2)} · resultado ${resultadoTotal.toFixed(2)} · ganancia liquidada ${gananciaLiquidada.toFixed(2)} · ` +
        `comisión ${comisionTotal.toFixed(2)} · falta para la base ${faltaParaBase.toFixed(2)}`,
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
            tratamientoComision: CLIENTE.tratamientoComision,
            capitalBase: CLIENTE.capitalBase,
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
            tratamientoComision: CLIENTE.tratamientoComision,
            capitalBase: CLIENTE.capitalBase,
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
        if (!p) continue;
        const cambios: string[] = [];
        if (Number(p.valor) !== Number(r.valor)) {
          cambios.push(`saldo ${Number(p.valor).toFixed(2)} → ${Number(r.valor).toFixed(2)}`);
        }
        if (num(p.resultadoComisionable) !== Number(r.resultadoComisionable)) {
          cambios.push(
            `ganancia liquidada ${num(p.resultadoComisionable).toFixed(2)} → ${Number(r.resultadoComisionable).toFixed(2)}`,
          );
        }
        if (cambios.length) {
          pisados.push(`${String(r.mes).padStart(2, "0")}/${r.anio}: ${cambios.join(" · ")}`);
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
          tratamientoComision: cliDb!.tratamientoComision,
          capitalBase: cliDb!.capitalBase != null ? Number(cliDb!.capitalBase) : undefined,
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
