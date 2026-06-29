"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { withTenant } from "@/lib/db";
import { movimientos } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { registrarAuditoria, sanitizar } from "@/lib/audit";
import {
  crearMovimientoSchema,
  editarMovimientoSchema,
  idSchema,
} from "@/lib/validations";
import { ADMIN_CTX, fail, ok, type ActionResult } from "@/lib/types";

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/cliente", "layout");
}

/** Registra un depósito o retiro de capital. */
export async function crearMovimiento(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = crearMovimientoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const id = await withTenant(ADMIN_CTX, async (tx) => {
    const [m] = await tx
      .insert(movimientos)
      .values({
        clienteId: d.clienteId,
        tipo: d.tipo,
        monto: d.monto.toFixed(2),
        fecha: d.fecha,
        descripcion: d.descripcion ?? null,
      })
      .returning();
    return m!.id;
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: "movimiento",
    entidadId: id,
    despues: { clienteId: d.clienteId, tipo: d.tipo, monto: d.monto, fecha: d.fecha, descripcion: d.descripcion ?? null },
  });

  revalidar();
  return ok(undefined, d.tipo === "deposito" ? "Depósito registrado." : "Retiro registrado.");
}

/** Edita un movimiento existente (recálculo en cadena al releer). */
export async function editarMovimiento(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = editarMovimientoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const antes = await withTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx.select().from(movimientos).where(eq(movimientos.id, d.id)).limit(1);
    if (!actual) return null;
    await tx
      .update(movimientos)
      .set({
        tipo: d.tipo,
        monto: d.monto.toFixed(2),
        fecha: d.fecha,
        descripcion: d.descripcion ?? null,
        updatedAt: new Date(),
      })
      .where(eq(movimientos.id, d.id));
    return actual;
  });
  if (!antes) return fail("Movimiento no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "movimiento",
    entidadId: d.id,
    antes: sanitizar(antes),
    despues: { clienteId: d.clienteId, tipo: d.tipo, monto: d.monto, fecha: d.fecha, descripcion: d.descripcion ?? null },
  });

  revalidar();
  return ok(undefined, "Movimiento actualizado.");
}

/** Elimina un movimiento (recálculo en cadena al releer). */
export async function eliminarMovimiento(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Identificador inválido.");

  const antes = await withTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx.select().from(movimientos).where(eq(movimientos.id, parsed.data.id)).limit(1);
    if (!actual) return null;
    await tx.delete(movimientos).where(eq(movimientos.id, parsed.data.id));
    return actual;
  });
  if (!antes) return fail("Movimiento no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "eliminar",
    entidad: "movimiento",
    entidadId: parsed.data.id,
    antes: sanitizar(antes),
  });

  revalidar();
  return ok(undefined, "Movimiento eliminado.");
}
