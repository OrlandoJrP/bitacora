/** Diagnóstico one-off: lista fondos con sus socios y conteos (detecta duplicados). */
import "./load-env";
import { connectForScript } from "./db-connect";

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  try {
    const fondos = await sql`
      select id, nombre, fecha_inicio, capital_inicial, created_at
      from fondos order by created_at`;
    console.log(`Fondos: ${fondos.length}`);
    for (const f of fondos) {
      const socios = await sql`
        select id, nombre, estado, cliente_id from fondo_socios
        where fondo_id = ${f.id} order by fecha_alta, id`;
      const [movs] = await sql`
        select count(*)::int as n from fondo_movimientos where fondo_id = ${f.id}`;
      const [rends] = await sql`
        select count(*)::int as n from fondo_rendimientos where fondo_id = ${f.id}`;
      const [ovrs] = await sql`
        select count(*)::int as n from fondo_overrides where fondo_id = ${f.id}`;
      console.log(
        `\n— ${f.nombre} (id ${f.id})\n  creado: ${f.created_at?.toISOString?.() ?? f.created_at}\n  movimientos: ${movs!.n} · rendimientos: ${rends!.n} · overrides: ${ovrs!.n}`,
      );
      for (const s of socios) {
        console.log(`  socio: ${s.nombre} (${s.estado}) cliente_id=${s.cliente_id ?? "—"} id=${s.id}`);
      }
    }
    const clientes = await sql`
      select nombre, email, es_acceso_fondo, estado from clientes order by created_at`;
    console.log(`\nClientes: ${clientes.length}`);
    for (const c of clientes) {
      console.log(`  ${c.nombre} <${c.email}> es_acceso_fondo=${c.es_acceso_fondo} estado=${c.estado}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
