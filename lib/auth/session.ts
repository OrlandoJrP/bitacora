import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "./index";
import type { TenantCtx } from "@/lib/db";

export type SesionApp = Session;

/** Devuelve la sesión actual o null. */
export async function getSession(): Promise<Session | null> {
  return auth();
}

/** Exige sesión válida (cualquier rol). Redirige a /login si no hay. */
export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/** Exige sesión de administrador. */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/cliente");
  return session;
}

/** Exige sesión de cliente con cliente_id asociado. Devuelve el clienteId garantizado. */
export async function requireCliente(): Promise<{ session: Session; clienteId: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "cliente" || !session.user.clienteId) redirect("/admin");
  return { session, clienteId: session.user.clienteId };
}

/** Contexto de tenant para las consultas con RLS (admin = acceso total). */
export function tenantCtx(session: Session): TenantCtx {
  return {
    role: session.user.role,
    clienteId: session.user.role === "admin" ? null : session.user.clienteId,
  };
}
