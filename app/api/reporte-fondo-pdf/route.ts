import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { tenantCtx } from "@/lib/auth/session";
import { withFondoTenant } from "@/lib/db";
import { cargarPool } from "@/lib/data/pool";
import { getConfig } from "@/lib/data/config";
import { EstadoFondo } from "@/lib/pdf/EstadoFondo";
import { formatFechaHora, formatPct, nombreMes } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });

  const ctx = tenantCtx(session);

  // Aislamiento: un socio SOLO su fondo (se ignora cualquier parámetro);
  // el admin elige con ?fondo=.
  let fondoId: string | null;
  if (session.user.role === "cliente") {
    fondoId = await withFondoTenant(ctx, async (_tx, id) => id);
    if (!fondoId) return new Response("No eres socio de un fondo.", { status: 403 });
  } else {
    fondoId = new URL(req.url).searchParams.get("fondo");
    if (!fondoId) return new Response("Falta el parámetro 'fondo'.", { status: 400 });
  }

  const [pool, config] = await Promise.all([cargarPool(ctx, fondoId), getConfig()]);
  if (!pool) return new Response("Fondo no encontrado", { status: 404 });

  const r = pool.resumen;
  const elemento = createElement(EstadoFondo, {
    fondoNombre: pool.fondo.nombre,
    marca: config.nombreFondo,
    periodoLabel: `Corte: ${formatFechaHora(new Date()).split(",")[0]}`,
    generadoEl: formatFechaHora(new Date()),
    resumen: {
      capitalActual: r.capitalActual,
      gananciaAcumulada: r.gananciaAcumulada,
      twrAnual: r.twrAnual,
      twrDesdeInicio: r.twrDesdeInicio,
      flotanteLabel: r.flotante
        ? `${nombreMes(r.flotante.anio, r.flotante.mes)} (${formatPct(r.flotante.roiMes)})`
        : null,
    },
    socios: r.socios.map((s) => ({
      nombre: s.nombre,
      inactivo: s.estado === "inactivo",
      capitalActual: s.capitalActual,
      participacion: s.participacion,
      totalAportado: s.totalAportado,
      totalRetirado: s.totalRetirado,
      gananciaNeta: s.gananciaNeta,
      rentabilidad: s.rentabilidad,
    })),
    meses: pool.meses.map((m) => ({
      mesLabel: nombreMes(m.anio, m.mes),
      saldoInicial: m.saldoInicial,
      aportes: m.aportes,
      retiros: m.retiros,
      resultado: m.resultado,
      tasa: m.tasaTwr,
      saldoFinal: m.saldoFinal,
      tieneRendimiento: m.tieneRendimiento,
      enCurso: m.enCurso,
    })),
  }) as unknown as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(elemento);
  const safe = pool.fondo.nombre.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reporte_fondo_${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
