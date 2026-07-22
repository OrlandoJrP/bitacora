"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, withTenant } from "@/lib/db";
import { clientes, users } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { registrarAuditoria, sanitizar } from "@/lib/audit";
import { hashPassword, generarPasswordTemporal } from "@/lib/auth/password";
import {
  crearClienteSchema,
  editarClienteSchema,
  idSchema,
} from "@/lib/validations";
import { ADMIN_CTX, fail, ok, type ActionResult } from "@/lib/types";

function revalidarTodo() {
  revalidatePath("/admin", "layout");
  revalidatePath("/cliente", "layout");
}

/** Crea un cliente + su usuario con contraseña temporal (mostrada una sola vez). */
export async function crearCliente(
  input: unknown,
): Promise<ActionResult<{ clienteId: string; email: string; passwordTemporal: string }>> {
  const session = await requireAdmin();
  const parsed = crearClienteSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  const email = d.email.toLowerCase().trim();

  const yaExiste = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (yaExiste.length > 0) {
    return fail("Ya existe un usuario con ese correo.", { email: ["Correo en uso."] });
  }

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  const clienteId = await withTenant(ADMIN_CTX, async (tx) => {
    const [cliente] = await tx
      .insert(clientes)
      .values({
        nombre: d.nombre.trim(),
        email,
        fechaIngreso: d.fechaIngreso,
        capitalInicial: d.capitalInicial.toFixed(2),
        comisionPct: d.comisionPct != null ? d.comisionPct.toFixed(3) : null,
        politicaComision: d.politicaComision ?? null,
        notas: d.notas ?? null,
      })
      .returning();

    await tx.insert(users).values({
      email,
      passwordHash,
      role: "cliente",
      clienteId: cliente!.id,
      mustChangePassword: true,
    });

    return cliente!.id;
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: "cliente",
    entidadId: clienteId,
    despues: {
      nombre: d.nombre,
      email,
      fechaIngreso: d.fechaIngreso,
      capitalInicial: d.capitalInicial,
      comisionPct: d.comisionPct != null ? d.comisionPct.toFixed(3) : null,
      politicaComision: d.politicaComision ?? null,
    },
  });

  revalidarTodo();
  return ok({ clienteId, email, passwordTemporal });
}

/** Edita los datos de un cliente. */
export async function editarCliente(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = editarClienteSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;

  const antes = await withTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx.select().from(clientes).where(eq(clientes.id, d.id)).limit(1);
    if (!actual) return null;
    await tx
      .update(clientes)
      .set({
        nombre: d.nombre.trim(),
        email: d.email.toLowerCase().trim(),
        fechaIngreso: d.fechaIngreso,
        capitalInicial: d.capitalInicial.toFixed(2),
        comisionPct: d.comisionPct != null ? d.comisionPct.toFixed(3) : null,
        politicaComision: d.politicaComision ?? null,
        estado: d.estado,
        notas: d.notas ?? null,
        updatedAt: new Date(),
      })
      .where(eq(clientes.id, d.id));
    return actual;
  });
  if (!antes) return fail("Cliente no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "cliente",
    entidadId: d.id,
    antes: sanitizar(antes),
    despues: {
      nombre: d.nombre,
      email: d.email,
      fechaIngreso: d.fechaIngreso,
      capitalInicial: d.capitalInicial,
      estado: d.estado,
      comisionPct: d.comisionPct != null ? d.comisionPct.toFixed(3) : null,
      politicaComision: d.politicaComision ?? null,
    },
  });

  revalidarTodo();
  return ok(undefined, "Cliente actualizado.");
}

/** Elimina un cliente (cascada: usuario, movimientos y rendimientos). */
export async function eliminarCliente(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Identificador inválido.");

  const antes = await withTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx.select().from(clientes).where(eq(clientes.id, parsed.data.id)).limit(1);
    if (!actual) return null;
    await tx.delete(clientes).where(eq(clientes.id, parsed.data.id));
    return actual;
  });
  if (!antes) return fail("Cliente no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "eliminar",
    entidad: "cliente",
    entidadId: parsed.data.id,
    antes: sanitizar(antes),
  });

  revalidarTodo();
  return ok(undefined, "Cliente eliminado.");
}

/** Activa/desactiva un cliente. */
export async function cambiarEstadoCliente(
  input: { id: string; estado: "activo" | "inactivo" },
): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse({ id: input.id });
  if (!parsed.success) return fail("Identificador inválido.");
  const estado = input.estado === "inactivo" ? "inactivo" : "activo";

  await withTenant(ADMIN_CTX, async (tx) => {
    await tx
      .update(clientes)
      .set({ estado, updatedAt: new Date() })
      .where(eq(clientes.id, input.id));
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "cliente",
    entidadId: input.id,
    despues: { estado },
  });

  revalidarTodo();
  return ok(undefined, `Cliente ${estado === "activo" ? "activado" : "desactivado"}.`);
}

/** Resetea la contraseña de un cliente y devuelve la nueva temporal (una vez). */
export async function resetearPassword(
  input: { clienteId: string },
): Promise<ActionResult<{ passwordTemporal: string }>> {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse({ id: input.clienteId });
  if (!parsed.success) return fail("Identificador inválido.");

  const [u] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.clienteId, input.clienteId), eq(users.role, "cliente")))
    .limit(1);
  if (!u) return fail("El cliente no tiene usuario asociado.");

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, u.id));

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "usuario",
    entidadId: u.id,
    despues: { accion: "reset_password", email: u.email },
  });

  revalidarTodo();
  return ok({ passwordTemporal });
}
