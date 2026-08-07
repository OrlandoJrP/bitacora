import type { Metadata } from "next";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { cargarLedgersTodos } from "@/lib/data/ledger";
import { num } from "@/lib/finance/ledger";
import { mesActual } from "@/lib/format";
import { CierreMensual } from "@/components/admin/cierre-mensual";

export const metadata: Metadata = { title: "Cierre mensual" };

export default async function CierrePage() {
  const session = await requireAdmin();
  const ledgers = await cargarLedgersTodos(tenantCtx(session));
  const { anio, mes } = mesActual();
  const activos = ledgers.filter((l) => l.cliente.estado === "activo");

  const clientes = activos.map((l) => ({
    id: l.cliente.id,
    nombre: l.cliente.nombre,
    capitalInicial: num(l.cliente.capitalInicial),
    fechaIngreso: l.cliente.fechaIngreso,
    // Config EFECTIVA del cliente (puede diferir de la global: % o política propios).
    config: l.config,
    rendimientos: l.rendimientos.map((r) => ({
      anio: r.anio,
      mes: r.mes,
      modo: r.modo,
      valor: num(r.valor),
      resultadoComisionable: r.resultadoComisionable != null ? num(r.resultadoComisionable) : null,
      descripcion: r.descripcion,
    })),
    movimientos: l.movimientos.map((m) => ({
      tipo: m.tipo,
      monto: num(m.monto),
      fecha: m.fecha,
      descripcion: m.descripcion,
    })),
  }));

  const anioMin = Math.min(2024, ...activos.map((l) => Number(l.cliente.fechaIngreso.slice(0, 4))));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Cierre mensual</h1>
        <p className="text-sm text-muted-foreground">
          Carga el resultado del mes por cliente. La vista previa muestra comisión, neto y nuevo
          saldo antes de guardar.
        </p>
      </div>
      <CierreMensual
        clientes={clientes}
        anioInicial={anio}
        mesInicial={mes}
        anioMin={anioMin}
      />
    </div>
  );
}
