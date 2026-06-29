import "server-only";
import { db } from "@/lib/db";
import { auditoria } from "@/drizzle/schema";

export type AccionAuditoria = "crear" | "editar" | "eliminar";
export type EntidadAuditoria =
  | "cliente"
  | "movimiento"
  | "rendimiento"
  | "configuracion"
  | "usuario";

export interface AuditoriaParams {
  actorUserId?: string | null;
  actorEmail?: string | null;
  accion: AccionAuditoria;
  entidad: EntidadAuditoria;
  entidadId?: string | null;
  antes?: unknown;
  despues?: unknown;
}

/**
 * Escribe un registro en la bitácora de auditoría. Toda mutación del sistema
 * (crear/editar/eliminar) debe llamar a esta función tras completarse.
 * Nunca registra contraseñas ni hashes (los datos se sanitizan en el llamador).
 */
export async function registrarAuditoria(params: AuditoriaParams): Promise<void> {
  await db.insert(auditoria).values({
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    accion: params.accion,
    entidad: params.entidad,
    entidadId: params.entidadId != null ? String(params.entidadId) : null,
    datosAntes: (params.antes ?? null) as object | null,
    datosDespues: (params.despues ?? null) as object | null,
  });
}

/** Elimina campos sensibles antes de auditar (passwordHash, etc.). */
export function sanitizar<T extends Record<string, unknown>>(obj: T | null | undefined): Partial<T> | null {
  if (!obj) return null;
  const { passwordHash, ...rest } = obj as Record<string, unknown>;
  return rest as Partial<T>;
}
