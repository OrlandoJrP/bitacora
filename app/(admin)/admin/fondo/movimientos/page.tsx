import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Link2 } from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { cargarPoolsTodos } from "@/lib/data/pool";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EliminarMovimientoFondoButton,
  NuevoMovimientoFondoButton,
  TransferenciaButton,
} from "@/components/admin/fondo/movimientos-fondo";
import { formatFechaLarga, formatUSD } from "@/lib/format";

export const metadata: Metadata = { title: "Movimientos del fondo" };

export default async function MovimientosFondoPage() {
  const session = await requireAdmin();
  const pools = await cargarPoolsTodos(tenantCtx(session));
  const pool = pools[0] ?? null;

  if (!pool) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Aún no hay fondo común creado.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/fondo">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
    );
  }

  const nombrePorSocio = new Map(pool.socios.map((s) => [s.id, s.nombre]));
  const sociosActivos = pool.socios
    .filter((s) => s.estado === "activo")
    .map((s) => ({ id: s.id, nombre: s.nombre }));
  const movimientos = [...pool.movimientos].sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0,
  );

  const totalAportes = movimientos
    .filter((m) => m.tipo === "deposito")
    .reduce((s, m) => s + Number(m.monto), 0);
  const totalRetiros = movimientos
    .filter((m) => m.tipo === "retiro")
    .reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Movimientos · {pool.fondo.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {movimientos.length} movimiento(s) · Aportes {formatUSD(totalAportes)} · Retiros{" "}
            {formatUSD(totalRetiros)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/fondo">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </Button>
          <TransferenciaButton fondoId={pool.fondo.id} socios={sociosActivos} />
          <NuevoMovimientoFondoButton socios={sociosActivos} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Concepto</TableHead>
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
                    {nombrePorSocio.get(m.socioId) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {m.tipo === "deposito" ? (
                        <Badge variant="pos" className="gap-1">
                          <ArrowDownLeft className="h-3 w-3" /> Aporte
                        </Badge>
                      ) : (
                        <Badge variant="neg" className="gap-1">
                          <ArrowUpRight className="h-3 w-3" /> Retiro
                        </Badge>
                      )}
                      {m.transferenciaId && (
                        <Badge variant="gold" className="gap-1">
                          <Link2 className="h-3 w-3" /> transferencia
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyText value={m.monto} />
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">
                    {m.descripcion ?? "—"}
                  </TableCell>
                  <TableCell>
                    <EliminarMovimientoFondoButton
                      movimientoId={m.id}
                      esTransferencia={!!m.transferenciaId}
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
