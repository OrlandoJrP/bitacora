import type { TenantCtx } from "@/lib/db";

export type ActionOk<T> = { ok: true; data?: T; mensaje?: string };
export type ActionError = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};
export type ActionResult<T = undefined> = ActionOk<T> | ActionError;

export const ADMIN_CTX: TenantCtx = { role: "admin", clienteId: null };

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionError {
  return { ok: false, error, fieldErrors };
}

export function ok<T>(data?: T, mensaje?: string): ActionOk<T> {
  return { ok: true, data, mensaje };
}
