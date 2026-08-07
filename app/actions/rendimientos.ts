"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withTenant } from "@/lib/db";
import { clientes, rendimientosMensuales } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { registrarAuditoria, sanitizar } from "@/lib/audit";
import {
  guardarRendimientoSchema,
  eliminarRendimientoSchema,
} from "@/lib/validations";
import { ADMIN_CTX, fail, ok, type ActionResult } from "@/lib/types";

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/cliente", "layout");
}

/**
 * Guarda (crea o reabre/edita) el resultado mensual de un cliente.
 * Idempotente por (cliente, año, mes): vuelve a abrir el mismo registro.
 */
export async function guardarRendimiento(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = guardarRendimientoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const resultado = await withTenant(ADMIN_CTX, async (tx) => {
    // El período no puede ser anterior al mes de ingreso del cliente: quedaría
    // fuera de la cadena derive-on-read (dato huérfano invisible en reportes).
    const [cli] = await tx
      .select({ fechaIngreso: clientes.fechaIngreso, esAccesoFondo: clientes.esAccesoFondo })
      .from(clientes)
      .where(eq(clientes.id, d.clienteId))
      .limit(1);
    if (!cli) return { error: "Cliente no encontrado." };
    if (cli.esAccesoFondo) {
      return {
        error:
          "Este cliente es un acceso de socio del fondo compartido: su resultado se registra en el fondo, no en el cierre individual.",
      };
    }
    const periodo = `${d.anio}-${String(d.mes).padStart(2, "0")}`;
    if (periodo < cli.fechaIngreso.slice(0, 7)) {
      return { error: "El período es anterior a la fecha de ingreso del cliente." };
    }

    const [actual] = await tx
      .select()
      .from(rendimientosMensuales)
      .where(
        and(
          eq(rendimientosMensuales.clienteId, d.clienteId),
          eq(rendimientosMensuales.anio, d.anio),
          eq(rendimientosMensuales.mes, d.mes),
        ),
      )
      .limit(1);

    await tx
      .insert(rendimientosMensuales)
      .values({
        clienteId: d.clienteId,
        anio: d.anio,
        mes: d.mes,
        modo: d.modo,
        valor: d.valor.toFixed(4),
        resultadoComisionable:
          d.resultadoComisionable != null ? d.resultadoComisionable.toFixed(2) : null,
        descripcion: d.descripcion ?? null,
      })
      .onConflictDoUpdate({
        target: [
          rendimientosMensuales.clienteId,
          rendimientosMensuales.anio,
          rendimientosMensuales.mes,
        ],
        set: {
          modo: d.modo,
          valor: d.valor.toFixed(4),
          // Se reescribe SIEMPRE (incluido a NULL): si no, al reeditar un mes
          // quedaría una base de comisión vieja que ya no corresponde al valor.
          resultadoComisionable:
            d.resultadoComisionable != null ? d.resultadoComisionable.toFixed(2) : null,
          descripcion: d.descripcion ?? null,
          updatedAt: new Date(),
        },
      });
    return { antes: actual ?? null };
  });

  if (resultado.error) return fail(resultado.error);
  const antes = resultado.antes ?? null;

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: antes ? "editar" : "crear",
    entidad: "rendimiento",
    entidadId: antes?.id ?? null,
    antes: sanitizar(antes),
    despues: { clienteId: d.clienteId, anio: d.anio, mes: d.mes, modo: d.modo, valor: d.valor },
  });

  revalidar();
  return ok(undefined, "Resultado mensual guardado.");
}

/** Guarda varios cierres mensuales en lote (un cliente o varios). */
export async function guardarRendimientosLote(
  inputs: unknown[],
): Promise<ActionResult<{ guardados: number; errores: { index: number; error: string }[] }>> {
  await requireAdmin();
  const errores: { index: number; error: string }[] = [];
  let guardados = 0;

  for (let i = 0; i < inputs.length; i++) {
    const res = await guardarRendimiento(inputs[i]);
    if (res.ok) guardados += 1;
    else errores.push({ index: i, error: res.error });
  }

  return ok({ guardados, errores }, `${guardados} resultado(s) guardado(s).`);
}

/** Elimina el resultado mensual de un cliente (recálculo en cadena al releer). */
export async function eliminarRendimiento(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = eliminarRendimientoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const d = parsed.data;

  const antes = await withTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx
      .select()
      .from(rendimientosMensuales)
      .where(
        and(
          eq(rendimientosMensuales.clienteId, d.clienteId),
          eq(rendimientosMensuales.anio, d.anio),
          eq(rendimientosMensuales.mes, d.mes),
        ),
      )
      .limit(1);
    if (!actual) return null;
    await tx.delete(rendimientosMensuales).where(eq(rendimientosMensuales.id, actual.id));
    return actual;
  });
  if (!antes) return fail("No hay resultado registrado para ese mes.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "eliminar",
    entidad: "rendimiento",
    entidadId: antes.id,
    antes: sanitizar(antes),
  });

  revalidar();
  return ok(undefined, "Resultado mensual eliminado.");
}
