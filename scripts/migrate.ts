/**
 * scripts/migrate.ts — Aplica las migraciones de Drizzle y luego las políticas RLS.
 * Ejecutar con: pnpm db:migrate  (o como job de predeploy en DigitalOcean).
 */
import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connectForScript } from "./db-connect";
import { applyRLS } from "../lib/db/rls";

async function main() {
  const sql = connectForScript();
  const db = drizzle(sql);

  console.log("→ Ejecutando migraciones de Drizzle…");
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("✓ Migraciones aplicadas.");

  console.log("→ Aplicando políticas Row-Level Security…");
  await applyRLS(sql);
  console.log("✓ RLS aplicado (clientes, movimientos, rendimientos_mensuales).");

  await sql.end();
  console.log("✓ Migración completa.");
}

main().catch((err) => {
  console.error("✗ Error en la migración:", err);
  process.exit(1);
});
