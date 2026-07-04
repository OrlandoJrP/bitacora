import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { cargarLedgersTodos } from "@/lib/data/ledger";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NuevoMovimientoButton } from "@/components/admin/nuevo-movimiento-button";
import { MovimientoRowActions } from "@/components/admin/movimiento-row-actions";
import { MovimientosFiltro } from "@/components/admin/movimientos-filtro";
import { formatFechaLarga, formatUSD } from "@/lib/format";

export const metadata: Metadata = { title: "Movimientos" };

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const session = await requireAdmin();
  const { cliente: clienteParam } = await searchParams;
  const ledgers = await cargarLedgersTodos(tenantCtx(session));

  const clientes = ledgers.map((l) => ({ id: l.cliente.id, nombre: l.cliente.nombre }));
  const nombrePorId = new Map(clientes.map((c) => [c.id, c.nombre]));
  const current =
    clienteParam && clientes.some((c) => c.id === clienteParam) ? clienteParam : "todos";

  const movimientos = ledgers
    .flatMap((l) => l.movimientos)
    .filter((m) => current === "todos" || m.clienteId === current)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const totalDep = movimientos
    .filter((m) => m.tipo === "deposito")
    .reduce((s, m) => s + Number(m.monto), 0);
  const totalRet = movimientos
    .filter((m) => m.tipo === "retiro")
    .reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Movimientos de capital</h1>
          <p className="text-sm text-muted-foreground">
            {movimientos.length} movimiento(s) · Depósitos {formatUSD(totalDep)} · Retiros{" "}
            {formatUSD(totalRet)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MovimientosFiltro clientes={clientes} current={current} />
          <NuevoMovimientoButton clientes={clientes} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatFechaLarga(m.fecha)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {nombrePorId.get(m.clienteId) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {m.tipo === "deposito" ? (
                      <Badge variant="pos" className="gap-1">
                        <ArrowDownLeft className="h-3 w-3" /> Depósito
                      </Badge>
                    ) : (
                      <Badge variant="neg" className="gap-1">
                        <ArrowUpRight className="h-3 w-3" /> Retiro
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyText value={m.monto} />
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">
                    {m.descripcion ?? "—"}
                  </TableCell>
                  <TableCell>
                    <MovimientoRowActions
                      clientes={clientes}
                      movimiento={{
                        id: m.id,
                        clienteId: m.clienteId,
                        tipo: m.tipo,
                        monto: m.monto,
                        fecha: m.fecha,
                        descripcion: m.descripcion,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {movimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Sin movimientos registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
