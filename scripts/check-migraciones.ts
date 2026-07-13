/** Comprueba si las migraciones del fondo ya están aplicadas en la BD.
 *  Sale 0 si 0001 y 0002 están aplicadas; 2 si faltan; 1 en error. */
import "./load-env";
import { connectForScript } from "./db-connect";

async function main() {
  const sql = connectForScript();
  try {
    const filas = await sql<{ name: string }[]>`
      select name from public."__bitacora_migrations" order by name
    `;
    const nombres = filas.map((f) => f.name);
    console.log("Aplicadas:", nombres.join(", ") || "(ninguna)");
    const ok =
      nombres.some((n) => n.startsWith("0001_")) && nombres.some((n) => n.startsWith("0002_"));
    process.exit(ok ? 0 : 2);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Error consultando migraciones:", err.message ?? err);
  process.exit(1);
});
