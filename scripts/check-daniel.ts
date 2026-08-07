/** Diagnóstico one-off: estado en producción de la cuenta de Daniel Flores. */
import "./load-env";
import { connectForScript } from "./db-connect";

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  try {
    const [c] = await sql`
      select id, nombre, email, fecha_ingreso, capital_inicial, estado,
             comision_pct, politica_comision, comision_informativa, capital_base
      from clientes where nombre = 'Daniel Flores'`;
    if (!c) throw new Error("No existe el cliente Daniel Flores.");
    console.log("Cliente:", {
      nombre: c.nombre,
      capitalInicial: c.capital_inicial,
      comisionPct: c.comision_pct,
      politica: c.politica_comision,
      comisionInformativa: c.comision_informativa,
      capitalBase: c.capital_base,
      estado: c.estado,
    });
    const r = await sql`
      select anio, mes, modo, valor, resultado_comisionable
      from rendimientos_mensuales where cliente_id = ${c.id} order by anio, mes`;
    console.log(`\nRendimientos (${r.length}):`);
    let gan = 0;
    for (const x of r) {
      gan += Number(x.resultado_comisionable ?? 0);
      console.log(
        `  ${x.anio}-${String(x.mes).padStart(2, "0")}  ${x.modo.padEnd(12)} saldo ${Number(x.valor).toFixed(2).padStart(11)}` +
          `  ganancia liquidada ${Number(x.resultado_comisionable ?? 0).toFixed(2).padStart(11)}`,
      );
    }
    const [m] = await sql`
      select count(*)::int as n from movimientos where cliente_id = ${c.id}`;
    console.log(`\nMovimientos: ${m!.n}`);
    console.log(`Ganancia liquidada total: ${gan.toFixed(2)} → 35% = ${(gan * 0.35).toFixed(2)}`);
    const saldo = Number(r[r.length - 1]!.valor);
    console.log(`Saldo actual: ${saldo.toFixed(2)} · base ${Number(c.capital_base).toFixed(2)} · falta ${(Number(c.capital_base) - saldo).toFixed(2)}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
