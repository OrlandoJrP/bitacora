/**
 * scripts/recuperar-comision-informativa.ts — RECUPERACIÓN (08-ago-2026).
 *
 * QUÉ PASÓ: la migración 0007 borra `clientes.comision_informativa`, sustituida
 * por `tratamiento_comision`. Se aplicó a producción ANTES de que el deploy con
 * el código nuevo estuviera arriba, así que la app —que todavía seleccionaba esa
 * columna— empezó a devolver 500 en toda página que lee clientes.
 *
 * LECCIÓN: un DROP COLUMN se aplica DESPUÉS de desplegar el código que ya no usa
 * la columna, nunca antes. Con un ADD el orden da igual; con un DROP no.
 *
 *   npx tsx scripts/recuperar-comision-informativa.ts          → la restaura
 *   npx tsx scripts/recuperar-comision-informativa.ts --drop   → la vuelve a
 *                                                                borrar (solo
 *                                                                cuando el
 *                                                                deploy nuevo
 *                                                                esté verificado)
 *
 * La columna restaurada es COMPATIBLE con las dos versiones del código: la vieja
 * la lee, la nueva la ignora. Se rellena desde `tratamiento_comision`.
 */
import "./load-env";
import { connectForScript } from "./db-connect";

const DROP = process.argv.includes("--drop");

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  try {
    const [existe] = await sql`
      select 1 as x from information_schema.columns
      where table_name = 'clientes' and column_name = 'comision_informativa'`;

    if (DROP) {
      if (!existe) {
        console.log("• La columna ya no existe: nada que borrar.");
        return;
      }
      await sql`ALTER TABLE clientes DROP COLUMN comision_informativa`;
      console.log("✓ comision_informativa eliminada (estado final esperado por la migración 0007).");
      return;
    }

    if (existe) {
      console.log("• La columna ya existe; solo se re-sincroniza desde tratamiento_comision.");
    } else {
      await sql`
        ALTER TABLE clientes
        ADD COLUMN comision_informativa boolean NOT NULL DEFAULT false`;
      console.log("✓ comision_informativa restaurada.");
    }

    // "pagada_aparte" es lo que el booleano significaba: saldo bruto, el cliente
    // pagó por fuera. "ya_retirada" NO lo era (el saldo ya viene neto).
    const filas = await sql`
      UPDATE clientes
      SET comision_informativa = (tratamiento_comision = 'pagada_aparte')
      RETURNING nombre, tratamiento_comision, comision_informativa`;
    for (const f of filas) {
      console.log(`    ${String(f.nombre).padEnd(18)} ${String(f.tratamiento_comision).padEnd(14)} → ${f.comision_informativa}`);
    }
    console.log("\n✓ Servicio restablecido: el código viejo vuelve a leer la columna y el nuevo la ignora.");
    console.log("  Cuando el deploy nuevo esté verificado, corre este script con --drop.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✗ Error:", e.message ?? e);
  process.exit(1);
});
