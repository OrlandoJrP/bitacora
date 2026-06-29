"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { configuracion } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/audit";
import { configSchema } from "@/lib/validations";
import { fail, ok, type ActionResult } from "@/lib/types";

/** Actualiza las 3 decisiones configurables del fondo + nombre. */
export async function actualizarConfig(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const [antes] = await db.select().from(configuracion).where(eq(configuracion.id, 1)).limit(1);

  await db
    .insert(configuracion)
    .values({
      id: 1,
      comisionPct: d.comisionPct.toFixed(3),
      usaHighWaterMark: d.usaHighWaterMark,
      pierdeSoloCliente: d.pierdeSoloCliente,
      nombreFondo: d.nombreFondo.trim(),
    })
    .onConflictDoUpdate({
      target: configuracion.id,
      set: {
        comisionPct: d.comisionPct.toFixed(3),
        usaHighWaterMark: d.usaHighWaterMark,
        pierdeSoloCliente: d.pierdeSoloCliente,
        nombreFondo: d.nombreFondo.trim(),
        updatedAt: new Date(),
      },
    });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "configuracion",
    entidadId: "1",
    antes: antes ?? null,
    despues: d,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/cliente", "layout");
  return ok(undefined, "Configuración guardada. Los cálculos se actualizaron.");
}
