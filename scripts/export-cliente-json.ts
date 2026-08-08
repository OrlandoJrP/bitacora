/**
 * Exporta la cadena mensual de UN cliente individual a JSON, derivada con el
 * motor a partir de lo que hay en la base. Insumo para armar reportes.
 *
 *   npx tsx scripts/export-cliente-json.ts "Nombre del cliente" <destino.json>
 */
import "./load-env";
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { connectForScript } from "./db-connect";
import { clientes, configuracion, movimientos, rendimientosMensuales } from "../drizzle/schema";
import {
  construirCadena,
  estadisticas,
  num,
  resumen,
  resumenPorAnio,
  type LedgerConfig,
  type LedgerInput,
} from "../lib/finance/ledger";

const [nombre, destino] = process.argv.slice(2);
if (!nombre || !destino) {
  throw new Error('Uso: tsx scripts/export-cliente-json.ts "Nombre" <destino.json>');
}

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  const db = drizzle(sql);
  try {
    const [cli] = await db.select().from(clientes).where(eq(clientes.nombre, nombre!)).limit(1);
    if (!cli) throw new Error(`No existe el cliente "${nombre}".`);
    const [cfg] = await db.select().from(configuracion).where(eq(configuracion.id, 1)).limit(1);

    const movs = await db.select().from(movimientos).where(eq(movimientos.clienteId, cli.id));
    const rends = await db
      .select()
      .from(rendimientosMensuales)
      .where(eq(rendimientosMensuales.clienteId, cli.id));

    const config: LedgerConfig = {
      comisionPct: cli.comisionPct != null ? num(cli.comisionPct) : num(cfg!.comisionPct),
      usaHighWaterMark: cfg!.usaHighWaterMark,
      pierdeSoloCliente: cfg!.pierdeSoloCliente,
      politica:
        cli.politicaComision ?? (cfg!.usaHighWaterMark ? "hwm_saldo" : "normal"),
      comisionInformativa: cli.comisionInformativa,
      capitalBase: cli.capitalBase != null ? num(cli.capitalBase) : undefined,
    };

    const input: LedgerInput = {
      capitalInicial: cli.capitalInicial,
      fechaIngreso: cli.fechaIngreso,
      config,
      rendimientos: rends.map((r) => ({
        anio: r.anio,
        mes: r.mes,
        modo: r.modo,
        valor: r.valor,
        resultadoComisionable: r.resultadoComisionable,
        descripcion: r.descripcion,
      })),
      movimientos: movs.map((m) => ({
        tipo: m.tipo,
        monto: m.monto,
        fecha: m.fecha,
        descripcion: m.descripcion,
      })),
    };

    const meses = construirCadena(input);
    const out = {
      cliente: {
        nombre: cli.nombre,
        email: cli.email,
        fechaIngreso: cli.fechaIngreso,
        capitalInicial: cli.capitalInicial,
        estado: cli.estado,
        notas: cli.notas,
      },
      config,
      nombreFondo: cfg!.nombreFondo,
      meses,
      resumen: resumen(meses, cli.capitalInicial, undefined, config.capitalBase ?? null),
      porAnio: resumenPorAnio(meses),
      estadisticas: estadisticas(meses),
      movimientos: movs
        .map((m) => ({ tipo: m.tipo, monto: num(m.monto), fecha: m.fecha, descripcion: m.descripcion }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    };
    writeFileSync(destino!, JSON.stringify(out, null, 1), "utf8");
    console.log(
      `✓ ${cli.nombre}: ${meses.length} meses · saldo ${out.resumen.saldoActual.toFixed(2)} · ` +
        `comisión ${out.resumen.comisionOperador.toFixed(2)} → ${destino}`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
