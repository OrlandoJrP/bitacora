import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { tenantCtx } from "@/lib/auth/session";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { getConfig } from "@/lib/data/config";
import { roiCompuesto, round2, type MesLedger } from "@/lib/finance/ledger";
import { EstadoCuenta, type EstadoCuentaMes } from "@/lib/pdf/EstadoCuenta";
import { nombreMes, formatFechaHora, formatFechaLarga } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("No autorizado", { status: 401 });

  const url = new URL(req.url);
  const anioParam = url.searchParams.get("anio");
  const anio = anioParam ? Number(anioParam) : null;

  // Aislamiento: un cliente SOLO puede generar su propio estado.
  let clienteId: string;
  if (session.user.role === "cliente") {
    if (!session.user.clienteId) return new Response("Sin cliente", { status: 403 });
    clienteId = session.user.clienteId;
  } else {
    const q = url.searchParams.get("cliente");
    if (!q) return new Response("Falta el parámetro 'cliente'.", { status: 400 });
    clienteId = q;
  }

  const ctx = tenantCtx(session);
  const [ledger, config] = await Promise.all([
    cargarLedgerCliente(ctx, clienteId),
    getConfig(),
  ]);
  if (!ledger) return new Response("Cliente no encontrado", { status: 404 });

  const todos = ledger.meses;
  const filtrados = anio ? todos.filter((m) => m.anio === anio) : todos;

  const mesesPdf: EstadoCuentaMes[] = filtrados.map((m) => ({
    mesLabel: nombreMes(m.anio, m.mes),
    saldoInicial: m.saldoInicial,
    depositos: m.depositos,
    retiros: m.retiros,
    rendNeto: m.rendNeto,
    roiMes: m.roiMes,
    saldoFinal: m.saldoFinal,
    tieneRendimiento: m.tieneRendimiento,
  }));

  const resumenPdf = anio
    ? resumenPeriodo(filtrados)
    : {
        saldoActual: ledger.resumen.saldoActual,
        gananciaNeta: ledger.resumen.gananciaNeta,
        roiAcumulado: ledger.resumen.roiAcumulado,
        aporteNeto: ledger.resumen.aporteNeto,
      };

  const elemento = createElement(EstadoCuenta, {
    fondoNombre: config.nombreFondo,
    cliente: {
      nombre: ledger.cliente.nombre,
      email: ledger.cliente.email,
      fechaIngreso: formatFechaLarga(ledger.cliente.fechaIngreso),
    },
    periodoLabel: anio ? `Año ${anio}` : "Histórico completo",
    generadoEl: formatFechaHora(new Date()),
    meses: mesesPdf,
    resumen: resumenPdf,
    comisionInformativa: ledger.config.comisionInformativa === true,
  }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(elemento);

  const safeName = ledger.cliente.nombre.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const filename = `estado_cuenta_${safeName}${anio ? `_${anio}` : ""}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function resumenPeriodo(meses: MesLedger[]) {
  const last = meses[meses.length - 1];
  return {
    saldoActual: last?.saldoFinal ?? 0,
    gananciaNeta: round2(meses.reduce((s, m) => s + m.rendNeto, 0)),
    roiAcumulado: roiCompuesto(meses),
    aporteNeto: round2(meses.reduce((s, m) => s + m.depositos - m.retiros, 0)),
  };
}
