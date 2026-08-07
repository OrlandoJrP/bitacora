/**
 * One-off (07-ago-2026): repara el efecto del seed-fondo que, al no encontrar
 * el fondo por su nombre original ("Fondo Compartido" fue renombrado en Admin a
 * "Fondo Compartido Arlet y lenin"), creó un fondo DUPLICADO.
 *
 * 1) Borra el fondo duplicado (cascade limpia socios/movimientos/rendimientos/
 *    overrides). Guarda: solo si sus socios no tienen cliente vinculado.
 * 2) Mueve el retiro de Arlet de 5.000 (Maquina retroexcavadora de china) del
 *    10-jul al 01-ago: el usuario indicó que fue DESPUÉS del cierre negativo de
 *    julio, por lo que pertenece a la base operativa de agosto.
 */
import "./load-env";
import { connectForScript } from "./db-connect";

const FONDO_REAL = "40d5de51-0584-47e2-9f2f-d2359c4a0eba"; // Fondo Compartido Arlet y lenin
const FONDO_DUPLICADO = "33759834-29e6-404a-8199-b00eefefdab9"; // creado por error 07-ago

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  try {
    await sql.begin(async (tx) => {
      // 1) Borrar duplicado (verificando que es el esperado y sin accesos).
      const [dup] = await tx`
        select id, nombre from fondos where id = ${FONDO_DUPLICADO}`;
      if (!dup) {
        console.log("• El fondo duplicado ya no existe (nada que borrar).");
      } else {
        if (dup.nombre !== "Fondo Compartido") {
          throw new Error(`El fondo ${FONDO_DUPLICADO} se llama "${dup.nombre}", no "Fondo Compartido": abortando.`);
        }
        const vinculados = await tx`
          select count(*)::int as n from fondo_socios
          where fondo_id = ${FONDO_DUPLICADO} and cliente_id is not null`;
        if (vinculados[0]!.n > 0) {
          throw new Error("El fondo duplicado tiene socios con cliente vinculado: abortando.");
        }
        await tx`delete from fondos where id = ${FONDO_DUPLICADO}`;
        console.log(`✓ Fondo duplicado "${dup.nombre}" eliminado (cascade).`);
      }

      // 2) Reubicar el retiro de 5.000 al 01-ago (base de agosto) y normalizar
      //    la descripción (tenía espacio final).
      const filas = await tx`
        update fondo_movimientos
        set fecha = '2026-08-01', descripcion = 'Maquina retroexcavadora de china'
        where fondo_id = ${FONDO_REAL} and tipo = 'retiro' and monto = 5000.00
          and fecha between '2026-07-01' and '2026-08-31'
        returning id, fecha, descripcion`;
      if (filas.length !== 1) {
        throw new Error(`Se esperaba exactamente 1 retiro de 5.000 (jul/ago) y hay ${filas.length}: abortando.`);
      }
      console.log(`✓ Retiro 5.000 movido a ${filas[0]!.fecha} ("${filas[0]!.descripcion}").`);
    });
    console.log("\n✓ Corrección aplicada (commit).");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("✗ Error:", e.message ?? e);
  process.exit(1);
});
