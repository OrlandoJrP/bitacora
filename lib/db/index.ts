import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

// No lanzamos al importar (rompería `next build`). Además, durante el build de
// DigitalOcean el binding ${db.DATABASE_URL} todavía NO está resuelto (llega como
// literal "${db.DATABASE_URL}"), lo que rompería el parseo de la URL. En ese caso
// (o si falta) usamos una URL ficticia VÁLIDA: las páginas son dinámicas y no
// consultan la BD en build; en runtime llega la URL real ya resuelta.
const PLACEHOLDER_DB_URL =
  "postgres://invalid:invalid@127.0.0.1:5432/bitacora?sslmode=disable";
const rawUrl = process.env.DATABASE_URL;
const urlNoResuelta = !rawUrl || rawUrl.includes("${");
const connectionString = urlNoResuelta ? PLACEHOLDER_DB_URL : rawUrl;
if (urlNoResuelta && process.env.NODE_ENV !== "production") {
  console.warn(
    "[bitacora] DATABASE_URL no resuelta; usando marcador (válido solo en build). En runtime debe llegar la URL real.",
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

/* ──────────────────────────────────────────────────────────────────────────
 * withFondoTenant — igual que withTenant pero además resuelve y fija
 * `app.current_fondo_id` para las políticas RLS del FONDO COMPARTIDO.
 * - admin: fondo_id vacío (las políticas de admin no lo necesitan).
 * - cliente: busca su membresía en fondo_socios (visible gracias a la
 *   cláusula bootstrap de la política, que permite leer la propia fila por
 *   cliente_id ANTES de fijar el fondo). Cliente no-socio → var '' → todas
 *   las tablas del fondo devuelven 0 filas (fail-closed).
 * `withTenant` queda intacto para la modalidad individual.
 * ────────────────────────────────────────────────────────────────────────── */
export async function withFondoTenant<T>(
  ctx: TenantCtx,
  fn: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    fondoId: string | null,
  ) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      drizzleSql`select set_config('app.current_role', ${ctx.role}, true)`,
    );
    await tx.execute(
      drizzleSql`select set_config('app.current_cliente_id', ${ctx.clienteId ?? ""}, true)`,
    );

    let fondoId: string | null = null;
    if (ctx.role === "cliente" && ctx.clienteId) {
      const filas = (await tx.execute(
        drizzleSql`select fondo_id from fondo_socios where cliente_id = ${ctx.clienteId} limit 1`,
      )) as unknown as Array<{ fondo_id: string }>;
      fondoId = filas[0]?.fondo_id ?? null;
    }
    await tx.execute(
      drizzleSql`select set_config('app.current_fondo_id', ${fondoId ?? ""}, true)`,
    );
    return fn(tx, fondoId);
  });
}
