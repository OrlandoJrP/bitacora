"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { auth, signIn, signOut } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/audit";
import { hashPassword, verifyPassword, validarFortalezaPassword } from "@/lib/auth/password";
import { cambiarPasswordSchema } from "@/lib/validations";
import { fail, ok, type ActionResult } from "@/lib/types";

/** Login con credenciales (sin registro público). Usado con useActionState. */
export async function iniciarSesion(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Correo o contraseña incorrectos.";
    }
    throw error;
  }
  // El middleware enruta a /admin o /cliente según el rol.
  redirect("/");
}

/** Cierra sesión. */
export async function cerrarSesion(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

/**
 * Cambia la contraseña del usuario en sesión. Verifica la actual, aplica reglas
 * de fortaleza, limpia must_change_password y fuerza re-login con la nueva.
 */
export async function cambiarPassword(input: unknown): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = cambiarPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const [u] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!u) return fail("Usuario no encontrado.");

  if (!d.actual) {
    return fail("Ingresa tu contraseña actual.", { actual: ["Requerida."] });
  }
  const correcta = await verifyPassword(d.actual, u.passwordHash);
  if (!correcta) {
    return fail("La contraseña actual no es correcta.", { actual: ["Incorrecta."] });
  }

  const debil = validarFortalezaPassword(d.nueva);
  if (debil) return fail(debil, { nueva: [debil] });

  if (await verifyPassword(d.nueva, u.passwordHash)) {
    return fail("La nueva contraseña debe ser distinta a la actual.", {
      nueva: ["Debe ser distinta."],
    });
  }

  const passwordHash = await hashPassword(d.nueva);
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, u.id));

  await registrarAuditoria({
    actorUserId: u.id,
    actorEmail: u.email,
    accion: "editar",
    entidad: "usuario",
    entidadId: u.id,
    despues: { accion: "cambio_password" },
  });

  // Fuerza re-login para emitir un JWT fresco sin must_change_password.
  await signOut({ redirectTo: "/login?cambiada=1" });
  return ok();
}

/** Devuelve la sesión actual (helper para componentes cliente vía RSC). */
export async function sesionActual() {
  return auth();
}
