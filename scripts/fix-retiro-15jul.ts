/**
 * One-off (07-ago-2026): el retiro de Arlet de 5.000 (máquina retroexcavadora)
 * fue el 15-JUL (el usuario corrigió la fecha), no el 01-ago: pertenece a la
 * base operativa de JULIO. Mueve la fila en producción ANTES de re-seedear
 * (la firma de idempotencia incluye la fecha; sin esto el seed duplicaría).
 */
import "./load-env";
import { connectForScript } from "./db-connect";

const FONDO_REAL = "40d5de51-0584-47e2-9f2f-d2359c4a0eba"; // Fondo Compartido Arlet y lenin

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  try {
    await sql.begin(async (tx) => {
      const ya = await tx`
        select id from fondo_movimientos
        where fondo_id = ${FONDO_REAL} and tipo = 'retiro' and monto = 5000.00
          and fecha = '2026-07-15'`;
      if (ya.length === 1) {
        console.log("• El retiro ya está en 2026-07-15 (nada que hacer).");
        return;
      }
      const filas = await tx`
        update fondo_movimientos
        set fecha = '2026-07-15'
        where fondo_id = ${FONDO_REAL} and tipo = 'retiro' and monto = 5000.00
          and fecha = '2026-08-01'
        returning id, fecha, descripcion`;
      if (filas.length !== 1) {
        throw new Error(`Se esperaba exactamente 1 retiro de 5.000 con fecha 01-ago y hay ${filas.length}: abortando.`);
      }
      console.log(`✓ Retiro 5.000 movido a 2026-07-15 ("${filas[0]!.descripcion}").`);
    });
    console.log("✓ Corrección aplicada (commit).");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✗ Error:", e.message ?? e);
  process.exit(1);
});
