import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientes } from "@/drizzle/schema";
import { asc } from "drizzle-orm";
import { plantillaMovimientos, plantillaRendimientos } from "@/lib/xlsx/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const tipo = new URL(req.url).searchParams.get("tipo") ?? "rendimientos";
  const refs = await db
    .select({ nombre: clientes.nombre, email: clientes.email })
    .from(clientes)
    .orderBy(asc(clientes.nombre));

  const buf =
    tipo === "movimientos" ? plantillaMovimientos(refs) : plantillaRendimientos(refs);
  const name = tipo === "movimientos" ? "plantilla_movimientos" : "plantilla_rendimientos";

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
