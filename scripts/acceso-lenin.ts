/**
 * scripts/acceso-lenin.ts — One-off: fija el correo real de Lenin Rodríguez y
 * le crea su usuario de acceso (contraseña temporal, cambio forzado al entrar).
 * Idempotente: si el usuario ya existe, no toca nada y lo informa.
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { connectForScript } from "./db-connect";
import { clientes, users } from "../drizzle/schema";
import { generarPasswordTemporal, hashPassword } from "../lib/auth/password";

const EMAIL_REAL = "leninrpetit@gmail.com";
const EMAIL_PLACEHOLDER = "lenin.rodriguez@bitacora.local";
const NOMBRE = "Lenin Rodríguez";

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  const db = drizzle(sql);

  try {
    await db.transaction(async (tx) => {
      // 1) Localiza al cliente (por placeholder o por nombre).
      let [cli] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.email, EMAIL_PLACEHOLDER))
        .limit(1);
      if (!cli) {
        [cli] = await tx.select().from(clientes).where(eq(clientes.nombre, NOMBRE)).limit(1);
      }
      if (!cli) throw new Error(`No existe el cliente "${NOMBRE}". Corre antes db:seed-lenin.`);

      // 2) ¿Ya tiene usuario?
      const [userExistente] = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.clienteId, cli.id))
        .limit(1);
      if (userExistente) {
        console.log(
          `• ${NOMBRE} ya tiene acceso con ${userExistente.email}. Usa "Restablecer contraseña" en Admin → Clientes si hace falta.`,
        );
        return;
      }

      // 3) El correo real no puede estar en uso por otro usuario.
      const [correoOcupado] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, EMAIL_REAL))
        .limit(1);
      if (correoOcupado) {
        throw new Error(`El correo ${EMAIL_REAL} ya está en uso por otro usuario.`);
      }

      // 4) Fija el correo real en el cliente y crea el usuario.
      await tx
        .update(clientes)
        .set({ email: EMAIL_REAL, updatedAt: new Date() })
        .where(eq(clientes.id, cli.id));

      const passwordTemporal = generarPasswordTemporal();
      const passwordHash = await hashPassword(passwordTemporal);
      await tx.insert(users).values({
        email: EMAIL_REAL,
        passwordHash,
        role: "cliente",
        clienteId: cli.id,
        mustChangePassword: true,
      });

      console.log("✓ Acceso creado para Lenin Rodríguez:");
      console.log(`    correo:               ${EMAIL_REAL}`);
      console.log(`    contraseña temporal:  ${passwordTemporal}`);
      console.log("    (deberá cambiarla en su primer inicio de sesión)");
    });
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Error:", err.message ?? err);
  process.exit(1);
});
