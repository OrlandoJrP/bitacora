/**
 * lib/db/rls.ts — Row-Level Security (defensa en profundidad, capa BD).
 *
 * Política: las tablas con datos de cliente (clientes, movimientos,
 * rendimientos_mensuales) quedan bajo RLS + FORCE RLS. El acceso se concede solo
 * si la sesión declaró `app.current_role = 'admin'` (acceso total) o si el
 * `app.current_cliente_id` de la sesión coincide con la fila. La app fija esas
 * variables por request mediante `withTenant` (ver lib/db/index.ts).
 *
 * FORCE RLS aplica incluso al dueño de la tabla ⇒ el sistema "falla cerrado":
 * cualquier consulta sin contexto de sesión devuelve CERO filas en vez de fugar
 * datos. Por eso el seed/migración fija `app.current_role = 'admin'`.
 *
 * Es idempotente: se puede ejecutar en cada deploy sin efectos colaterales.
 */
import type { Sql } from "postgres";

const TENANT_TABLES: Array<{ table: string; col: string }> = [
  { table: "clientes", col: "id" },
  { table: "movimientos", col: "cliente_id" },
  { table: "rendimientos_mensuales", col: "cliente_id" },
];

/* Tablas del FONDO COMPARTIDO. Lectura por membresía (transparencia total
 * dentro del fondo): un socio lee TODAS las filas de SU fondo — jamás otro.
 * La app fija app.current_fondo_id vía withFondoTenant. Escritura solo admin. */
const POOL_TABLES: Array<{ table: string; col: string }> = [
  { table: "fondos", col: "id" },
  { table: "fondo_socios", col: "fondo_id" },
  { table: "fondo_movimientos", col: "fondo_id" },
  { table: "fondo_rendimientos", col: "fondo_id" },
  { table: "fondo_overrides", col: "fondo_id" },
];

export async function applyRLS(sql: Sql): Promise<void> {
  for (const { table, col } of TENANT_TABLES) {
    const policyName = `${table}_tenant_select`;
    const writePolicy = `${table}_tenant_write`;

    await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);

    // Lectura: admin todo; cliente solo lo suyo.
    await sql.unsafe(`DROP POLICY IF EXISTS ${policyName} ON ${table};`);
    await sql.unsafe(`
      CREATE POLICY ${policyName} ON ${table}
        FOR SELECT
        USING (
          current_setting('app.current_role', true) = 'admin'
          OR (
            current_setting('app.current_cliente_id', true) IS NOT NULL
            AND current_setting('app.current_cliente_id', true) <> ''
            AND ${col}::text = current_setting('app.current_cliente_id', true)
          )
        );
    `);

    // Escritura (INSERT/UPDATE/DELETE): exclusiva del admin/operador.
    await sql.unsafe(`DROP POLICY IF EXISTS ${writePolicy} ON ${table};`);
    await sql.unsafe(`
      CREATE POLICY ${writePolicy} ON ${table}
        FOR ALL
        USING (current_setting('app.current_role', true) = 'admin')
        WITH CHECK (current_setting('app.current_role', true) = 'admin');
    `);
  }

  for (const { table, col } of POOL_TABLES) {
    const selectPolicy = `${table}_pool_select`;
    const writePolicy = `${table}_pool_write`;

    await sql.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);

    // Lectura: admin todo; socio, todo SU fondo (transparencia decidida).
    // fondo_socios lleva además la cláusula bootstrap "mi propia fila por
    // cliente_id" — es la que permite a withFondoTenant resolver el fondo
    // ANTES de haber fijado app.current_fondo_id (no recursiva: igualdad
    // plana contra la variable de sesión, sin subconsultas).
    const bootstrap =
      table === "fondo_socios"
        ? `OR (
            cliente_id IS NOT NULL
            AND current_setting('app.current_cliente_id', true) IS NOT NULL
            AND current_setting('app.current_cliente_id', true) <> ''
            AND cliente_id::text = current_setting('app.current_cliente_id', true)
          )`
        : "";

    await sql.unsafe(`DROP POLICY IF EXISTS ${selectPolicy} ON ${table};`);
    await sql.unsafe(`
      CREATE POLICY ${selectPolicy} ON ${table}
        FOR SELECT
        USING (
          current_setting('app.current_role', true) = 'admin'
          OR (
            current_setting('app.current_fondo_id', true) IS NOT NULL
            AND current_setting('app.current_fondo_id', true) <> ''
            AND ${col}::text = current_setting('app.current_fondo_id', true)
          )
          ${bootstrap}
        );
    `);

    await sql.unsafe(`DROP POLICY IF EXISTS ${writePolicy} ON ${table};`);
    await sql.unsafe(`
      CREATE POLICY ${writePolicy} ON ${table}
        FOR ALL
        USING (current_setting('app.current_role', true) = 'admin')
        WITH CHECK (current_setting('app.current_role', true) = 'admin');
    `);
  }
}
