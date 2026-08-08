import Link from "next/link";
import type { Metadata } from "next";
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
import { NuevoClienteButton } from "@/components/admin/nuevo-cliente-button";
import { ClienteRowActions } from "@/components/admin/cliente-row-actions";
import { formatFechaLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const session = await requireAdmin();
  const ledgers = await cargarLedgersTodos(tenantCtx(session));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {ledgers.length} inversionista(s). Alta, edición y credenciales.
          </p>
        </div>
        <NuevoClienteButton />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead className="text-right">Capital inicial</TableHead>
                <TableHead className="text-right">Saldo actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgers.map((l) => (
                <TableRow key={l.cliente.id}>
                  <TableCell>
                    <Link
                      href={`/admin/reportes?cliente=${l.cliente.id}`}
                      className="font-medium hover:text-brand-gold-600 hover:underline"
                    >
                      {l.cliente.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.cliente.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFechaLarga(l.cliente.fechaIngreso)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText value={l.cliente.capitalInicial} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyText value={l.resumen.saldoActual} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.cliente.estado === "activo" ? "pos" : "muted"}>
                      {l.cliente.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ClienteRowActions
                      cliente={{
                        id: l.cliente.id,
                        nombre: l.cliente.nombre,
                        email: l.cliente.email,
                        fechaIngreso: l.cliente.fechaIngreso,
                        capitalInicial: l.cliente.capitalInicial,
                        estado: l.cliente.estado,
                        comisionPct: l.cliente.comisionPct,
                        politicaComision: l.cliente.politicaComision,
                        tratamientoComision: l.cliente.tratamientoComision,
                        capitalBase: l.cliente.capitalBase,
                        notas: l.cliente.notas,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {ledgers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Aún no hay clientes. Crea el primero con “Nuevo cliente”.
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
