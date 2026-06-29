import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

// No lanzamos al importar (rompería `next build`): la conexión de postgres.js es
// perezosa, así que el error real aparece solo si se ejecuta una query sin URL.
const connectionString =
  process.env.DATABASE_URL ??
  "postgres://invalid:invalid@127.0.0.1:5432/bitacora?sslmode=disable";
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn(
    "[bitacora] DATABASE_URL no está definida. Configúrala en .env.local; las consultas fallarán hasta entonces.",
  );
}

// DO Managed Postgres exige SSL (sslmode=require). En local con sslmode=disable
// no se usa SSL. Para verificación estricta de CA, define DATABASE_CA_CERT.
const sslRequired =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("sslmode=verify");

function buildSSL(): postgres.Options<{}>["ssl"] {
  if (!sslRequired) return false;
  if (process.env.DATABASE_CA_CERT) {
    return { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true };
  }
  // Cifrado en tránsito sin verificar la cadena de CA (suficiente para DO; para
  // verificación completa, provee DATABASE_CA_CERT con el certificado de la base).
  return { rejectUnauthorized: false };
}

// Singleton para no agotar conexiones durante el hot-reload de Next en dev.
const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb._pgClient ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: buildSSL(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema });
export { client as pgClient, schema };

/* ──────────────────────────────────────────────────────────────────────────
 * withTenant — DEFENSA EN PROFUNDIDAD.
 * Ejecuta el callback dentro de una transacción que fija las variables de sesión
 * que consumen las políticas RLS de Postgres (ver lib/db/rls.ts). Aun si una
 * query olvidara filtrar por cliente_id, la base la bloquearía.
 * El scoping explícito en cada Server Action sigue siendo la primera línea.
 * ────────────────────────────────────────────────────────────────────────── */
export type TenantCtx = {
  role: "admin" | "cliente";
  clienteId: string | null;
};

export async function withTenant<T>(
  ctx: TenantCtx,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      drizzleSql`select set_config('app.current_role', ${ctx.role}, true)`,
    );
    await tx.execute(
      drizzleSql`select set_config('app.current_cliente_id', ${ctx.clienteId ?? ""}, true)`,
    );
    return fn(tx);
  });
}
