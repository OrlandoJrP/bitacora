/**
 * scripts/seed.ts — Inicializa la configuración y la cuenta maestra (admin).
 *
 *   pnpm db:seed           → configuración + usuario admin
 *   pnpm db:seed -- --demo → además crea 1 cliente de ejemplo (caso §5.4)
 *
 * Es idempotente: no duplica si ya existe. NUNCA crea datos demo sin el flag.
 */
import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { connectForScript } from "./db-connect";
import {
  clientes,
  configuracion,
  movimientos,
  rendimientosMensuales,
  users,
} from "../drizzle/schema";

const DEMO = process.argv.includes("--demo");

async function main() {
  const sql = connectForScript();
  // Habilita la escritura bajo RLS (FORCE) para esta conexión de seed.
  await sql`select set_config('app.current_role', 'admin', false)`;
  const db = drizzle(sql);

  // 1) Configuración singleton (id = 1).
  await db
    .insert(configuracion)
    .values({
      id: 1,
      comisionPct: "35.000",
      usaHighWaterMark: false,
      pierdeSoloCliente: true,
      nombreFondo: "Brújula Markets",
      moneda: "USD",
    })
    .onConflictDoNothing({ target: configuracion.id });
  console.log("✓ Configuración asegurada (comisión 35%, HWM off, pierde_solo_cliente true).");

  // 2) Usuario admin desde variables de entorno.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Define ADMIN_EMAIL y ADMIN_INITIAL_PASSWORD para crear la cuenta maestra.");
  }
  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail.toLowerCase()))
    .limit(1);

  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await db.insert(users).values({
      email: adminEmail.toLowerCase(),
      passwordHash: hash,
      role: "admin",
      mustChangePassword: true,
    });
    console.log(`✓ Usuario admin creado: ${adminEmail} (debe cambiar la contraseña al ingresar).`);
  } else {
    console.log(`• Usuario admin ya existe: ${adminEmail} (sin cambios).`);
  }

  // 3) Datos demo opcionales (caso verificable de §5.4).
  if (DEMO) {
    const demoEmail = "demo@brujulamarkets.com";
    const existingDemo = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.email, demoEmail))
      .limit(1);

    if (existingDemo.length > 0) {
      console.log("• Cliente demo ya existe (sin cambios).");
    } else {
      const [cliente] = await db
        .insert(clientes)
        .values({
          nombre: "Cliente Demo",
          email: demoEmail,
          fechaIngreso: "2024-09-01",
          capitalInicial: "10000.00",
          estado: "activo",
          notas: "DEMO — eliminar en producción. Reproduce el caso verificable §5.4.",
        })
        .returning();

      const hash = await bcrypt.hash("Demo1234!", 10);
      await db.insert(users).values({
        email: demoEmail,
        passwordHash: hash,
        role: "cliente",
        clienteId: cliente!.id,
        mustChangePassword: true,
      });

      await db.insert(rendimientosMensuales).values([
        { clienteId: cliente!.id, anio: 2024, mes: 9, modo: "porcentaje", valor: "8.0000" },
        { clienteId: cliente!.id, anio: 2024, mes: 10, modo: "porcentaje", valor: "-3.0000" },
        { clienteId: cliente!.id, anio: 2024, mes: 11, modo: "porcentaje", valor: "4.0000" },
      ]);

      await db.insert(movimientos).values({
        clienteId: cliente!.id,
        tipo: "deposito",
        monto: "5000.00",
        fecha: "2024-11-15",
        descripcion: "Aporte adicional (demo)",
      });

      console.log("✓ Cliente demo creado:");
      console.log("    email: demo@brujulamarkets.com");
      console.log("    contraseña temporal: Demo1234!");
      console.log("    Saldo esperado a nov-2024: $15,599.72");
    }
  }

  await sql.end();
  console.log("✓ Seed completo.");
}

main().catch((err) => {
  console.error("✗ Error en el seed:", err);
  process.exit(1);
});
