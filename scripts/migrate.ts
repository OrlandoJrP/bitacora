/**
 * scripts/migrate.ts — Migrador idempotente propio + políticas RLS.
 *
 * No usa el migrador de Drizzle porque éste ejecuta `CREATE SCHEMA`, que requiere
 * privilegio CREATE a nivel de base de datos — algo que el usuario de la base
 * "dev" de DigitalOcean NO tiene (error 42501 "permission denied for database").
 * En su lugar llevamos el control en una tabla del esquema `public` (solo precisa
 * CREATE TABLE) y aplicamos cada archivo .sql una sola vez.
 *
 * Ejecutar con: pnpm db:migrate  (o como job PRE_DEPLOY en DigitalOcean).
 */
import "./load-env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connectForScript } from "./db-connect";
import { applyRLS } from "../lib/db/rls";

const MIGRATIONS_DIR = "./drizzle/migrations";

async function main() {
  const sql = connectForScript();
  // Las tablas tenant tienen FORCE RLS: cualquier migración de DATOS (updates
  // de backfill) necesita el contexto admin o afectaría 0 filas en silencio.
  await sql`select set_config('app.current_role', 'admin', false)`;

  // Tabla de control en public (no requiere CREATE SCHEMA).
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public."__bitacora_migrations" (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const aplicadas = new Set(
    (
      await sql<{ name: string }[]>`select name from public."__bitacora_migrations"`
    ).map((r) => r.name),
  );

  const archivos = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) {
      console.log(`• ${archivo} ya aplicada, omitida.`);
      continue;
    }
    console.log(`→ Aplicando ${archivo}…`);
    const contenido = readFileSync(join(MIGRATIONS_DIR, archivo), "utf8");
    const statements = contenido
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
      await tx`insert into public."__bitacora_migrations" (name) values (${archivo})`;
    });
    console.log(`✓ ${archivo} aplicada (${statements.length} sentencias).`);
  }

  console.log("→ Aplicando políticas Row-Level Security…");
  await applyRLS(sql);
  console.log(
    "✓ RLS aplicado (individual: clientes, movimientos, rendimientos_mensuales · fondo: fondos, fondo_socios, fondo_movimientos, fondo_rendimientos, fondo_overrides).",
  );

  await sql.end();
  console.log("✓ Migración completa.");
}

main().catch((err) => {
  console.error("✗ Error en la migración:", err);
  process.exit(1);
});
