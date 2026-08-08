import { auth } from "@/lib/auth";
import { tenantCtx } from "@/lib/auth/session";
import { cargarLedgersTodos } from "@/lib/data/ledger";
import {
  csvCliente,
  workbookCliente,
  workbookComisiones,
  workbookConsolidado,
  type ItemLedger,
} from "@/lib/xlsx/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") ?? "xlsx";
  const clienteId = url.searchParams.get("cliente");
  const tipo = url.searchParams.get("tipo");

  const ledgers = await cargarLedgersTodos(tenantCtx(session));
  const items: ItemLedger[] = ledgers.map((l) => ({
    cliente: {
      id: l.cliente.id,
      nombre: l.cliente.nombre,
      email: l.cliente.email,
      estado: l.cliente.estado,
    },
    meses: l.meses,
    porAnio: l.porAnio,
    resumen: {
      saldoActual: l.resumen.saldoActual,
      comisionOperador: l.resumen.comisionOperador,
      gananciaNeta: l.resumen.gananciaNeta,
      roiAcumulado: l.resumen.roiAcumulado,
    },
    tratamientoComision: l.config.tratamientoComision ?? "descontada",
  }));

  const xlsx = (buf: Buffer, name: string) =>
    new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });

  if (tipo === "comisiones") {
    return xlsx(workbookComisiones(items), "reporte_comisiones");
  }

  if (clienteId) {
    const item = items.find((it) => it.cliente.id === clienteId);
    if (!item) return new Response("Cliente no encontrado", { status: 404 });
    const safe = item.cliente.nombre.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    if (formato === "csv") {
      return new Response(csvCliente(item), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reporte_${safe}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return xlsx(workbookCliente(item), `reporte_${safe}`);
  }

  return xlsx(workbookConsolidado(items), "reporte_consolidado");
}
