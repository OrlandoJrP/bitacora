/**
 * scripts/acceso-daniel.ts — One-off: crea el usuario de acceso de Daniel Flores
 * con una contraseña temporal que debe cambiar en su primer inicio de sesión.
 *
 * Idempotente: si ya tiene usuario no toca nada y lo informa. La contraseña se
 * imprime UNA sola vez y no queda registrada en ningún otro lado.
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { connectForScript } from "./db-connect";
import { clientes, users } from "../drizzle/schema";
import { generarPasswordTemporal, hashPassword } from "../lib/auth/password";

const EMAIL = "danielflores@gmail.com";
const NOMBRE = "Daniel Flores";

async function main() {
  const sql = connectForScript();
  await sql`select set_config('app.current_role', 'admin', false)`;
  const db = drizzle(sql);

  try {
    await db.transaction(async (tx) => {
      const [cli] = await tx.select().from(clientes).where(eq(clientes.nombre, NOMBRE)).limit(1);
      if (!cli) throw new Error(`No existe el cliente "${NOMBRE}". Corre antes pnpm db:seed-daniel.`);
      if (cli.email !== EMAIL) {
        throw new Error(
          `El cliente tiene el correo ${cli.email}, no ${EMAIL}. Revisa Admin → Clientes antes de crear el acceso.`,
        );
      }

      const [userExistente] = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.clienteId, cli.id))
        .limit(1);
      if (userExistente) {
        console.log(
          `• ${NOMBRE} ya tiene acceso con ${userExistente.email}. Si necesita entrar, usa "Restablecer contraseña" en Admin → Clientes.`,
        );
        return;
      }

      const [correoOcupado] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, EMAIL))
        .limit(1);
      if (correoOcupado) throw new Error(`El correo ${EMAIL} ya está en uso por otro usuario.`);

      const passwordTemporal = generarPasswordTemporal();
      const passwordHash = await hashPassword(passwordTemporal);
      await tx.insert(users).values({
        email: EMAIL,
        passwordHash,
        role: "cliente",
        clienteId: cli.id,
        mustChangePassword: true,
      });

      console.log(`✓ Acceso creado para ${NOMBRE}:`);
      console.log(`    correo:               ${EMAIL}`);
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
