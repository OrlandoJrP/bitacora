/**
 * scripts/seed-lenin.ts — Importa la cuenta individual de Lenin Rodríguez
 * (Reporte Ejecutivo) y la VERIFICA al centavo contra el cuadro del Excel.
 *
 *   pnpm db:seed-lenin -- --check  → solo verifica la transcripción en memoria
 *   pnpm db:seed-lenin             → verifica, importa (idempotente, en UNA
 *                                    transacción) y re-verifica desde la BD;
 *                                    si algo no cuadra, ROLLBACK y exit ≠ 0.
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { connectForScript } from "./db-connect";
import { clientes, movimientos, rendimientosMensuales } from "../drizzle/schema";
import { construirCadena, round2, type LedgerInput } from "../lib/finance/ledger";
import {
  CLIENTE,
  COMISION_OPERADOR_ESPERADA,
  DEFICIT_PENDIENTE_ESPERADO,
  ESPERADO,
  MOVIMIENTOS,
  RENDIMIENTOS,
  SALDO_ACTUAL_ESPERADO,
  TOTAL_RETIRADO_ESPERADO,
} from "./data/lenin-historico";

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
    if (m.saldoFinal !== e.saldoFinal) {
      problemas.push(`saldo ${m.saldoFinal} ≠ ${e.saldoFinal}`);
    }
    if (e.deficit !== undefined && m.deficitAcum !== e.deficit) {
      problemas.push(`déficit ${m.deficitAcum} ≠ ${e.deficit}`);
    }
    if (m.comision !== e.comision) {
      problemas.push(`comisión ${m.comision} ≠ ${e.comision}`);
    }
    if (problemas.length) {
      console.error(`  ✗ ${String(e.mes).padStart(2, "0")}/${e.anio}: ${problemas.join(" | ")}`);
      fallos++;
    }
  }

  const ultimo = meses[meses.length - 1]!;
  const totalRetiros = round2(meses.reduce((s, m) => s + m.retiros, 0));
  if (ultimo.saldoFinal !== SALDO_ACTUAL_ESPERADO) {
    console.error(`  ✗ Saldo actual: ${ultimo.saldoFinal} ≠ ${SALDO_ACTUAL_ESPERADO}`);
    fallos++;
  }
  if (totalRetiros !== TOTAL_RETIRADO_ESPERADO) {
    console.error(`  ✗ Total retirado: ${totalRetiros} ≠ ${TOTAL_RETIRADO_ESPERADO}`);
    fallos++;
  }
  if (ultimo.deficitAcum !== DEFICIT_PENDIENTE_ESPERADO) {
    console.error(`  ✗ Déficit pendiente: ${ultimo.deficitAcum} ≠ ${DEFICIT_PENDIENTE_ESPERADO}`);
    fallos++;
  }
  const comisionTotal = round2(meses.reduce((s, m) => s + m.comision, 0));
  if (comisionTotal !== COMISION_OPERADOR_ESPERADA) {
    console.error(`  ✗ Comisión del operador: ${comisionTotal} ≠ ${COMISION_OPERADOR_ESPERADA}`);
    fallos++;
  }
  // El saldo NO puede moverse por activar la comisión informativa: los saldos
  // importados ya vienen netos de lo que el operador retiró.
  if (ultimo.saldoFinal !== SALDO_ACTUAL_ESPERADO) fallos++;

  if (fallos === 0) {
    console.log(
      `  ✓ ${ESPERADO.length} meses al centavo · saldo ${ultimo.saldoFinal.toFixed(2)} · retirado ${totalRetiros.toFixed(2)} · ` +
        `comisión del operador ${comisionTotal.toFixed(2)} · déficit pendiente ${ultimo.deficitAcum.toFixed(2)}`,
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
      // 1) Cliente (por email; idempotente). GUARDIA: si el email placeholder
      // fue cambiado en Admin → Clientes, el cliente igual existe por nombre —
      // abortamos en vez de crear una cuenta fantasma duplicada.
      let [cli] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.email, CLIENTE.email))
        .limit(1);
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
            estado: CLIENTE.estado,
            notas: CLIENTE.notas,
          })
          .returning();
        console.log(`✓ Cliente creado: ${CLIENTE.nombre}`);
      } else {
        // Asegura TODAS las condiciones base aunque el cliente ya exista
        // (el modo saldo_final no detectaría un capital/fecha desviados).
        await tx
          .update(clientes)
          .set({
            capitalInicial: CLIENTE.capitalInicial,
            fechaIngreso: CLIENTE.fechaIngreso,
            comisionPct: CLIENTE.comisionPct,
            politicaComision: CLIENTE.politicaComision,
            tratamientoComision: CLIENTE.tratamientoComision,
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
            descripcion: r.descripcion ?? null,
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
              descripcion: r.descripcion ?? null,
              updatedAt: new Date(),
            },
          });
      }
      console.log(`✓ Rendimientos: ${RENDIMIENTOS.length} meses (upsert).`);

      // 4) Re-verificación desde la BD DENTRO de la transacción.
      const [cliDb] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, clienteId))
        .limit(1);
      const movsDb = await tx
        .select()
        .from(movimientos)
        .where(eq(movimientos.clienteId, clienteId));
      const rendsDb = await tx
        .select()
        .from(rendimientosMensuales)
        .where(
          and(eq(rendimientosMensuales.clienteId, clienteId)),
        );

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
        },
      };

      if (!verificar(inputDb, "datos importados (dentro de la transacción)")) {
        throw new Error("La verificación post-import no cuadra: ROLLBACK.");
      }
    });
  } finally {
    await sql.end();
  }
  console.log("\n✓ Cuenta de Lenin importada, verificada al centavo y confirmada (commit).");
}

async function main() {
  const okMemoria = verificar(inputDesdeConstantes(), "transcripción (en memoria)");
  if (!okMemoria) {
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
