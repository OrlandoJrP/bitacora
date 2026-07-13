import { auth } from "@/lib/auth";
import { tenantCtx } from "@/lib/auth/session";
import { cargarPool } from "@/lib/data/pool";
import { workbookFondo } from "@/lib/xlsx/export-fondo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const fondoId = new URL(req.url).searchParams.get("fondo");
  if (!fondoId) return new Response("Falta el parámetro 'fondo'.", { status: 400 });

  const pool = await cargarPool(tenantCtx(session), fondoId);
  if (!pool) return new Response("Fondo no encontrado", { status: 404 });

  const buf = workbookFondo(pool);
  const safe = pool.fondo.nombre.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte_fondo_${safe}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
