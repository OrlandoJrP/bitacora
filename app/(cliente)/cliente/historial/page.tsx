import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireCliente, tenantCtx } from "@/lib/auth/session";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { MoneyText } from "@/components/money-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPct, formatUSDSigned, nombreMes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MesLedger } from "@/lib/finance/ledger";

export const metadata: Metadata = { title: "Historial" };

export default async function HistorialPage() {
  const { session, clienteId } = await requireCliente();
  const ledger = await cargarLedgerCliente(tenantCtx(session), clienteId);
  if (!ledger) notFound();

  const meses = [...ledger.meses].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Historial mensual</h1>
        <p className="text-sm text-muted-foreground">
          Cada mes desde tu ingreso. Los montos son tu resultado neto.
        </p>
      </div>

      {/* Escritorio: tabla */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
                <TableHead className="text-right">Depósitos</TableHead>
                <TableHead className="text-right">Retiros</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => (
                <FilaMes key={m.key} m={m} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Móvil: tarjetas */}
      <div className="space-y-3 md:hidden">
        {meses.map((m) => (
          <Card key={m.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{nombreMes(m.anio, m.mes)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Linea label="Saldo inicial" value={<MoneyText value={m.saldoInicial} />} />
              {m.depositos > 0 && <Linea label="Depósitos" value={<MoneyText value={m.depositos} />} />}
              {m.retiros > 0 && <Linea label="Retiros" value={<MoneyText value={m.retiros} />} />}
              <Linea
                label="Resultado"
                value={
                  <span className={resultadoColor(m)}>
                    {formatUSDSigned(m.rendNeto)} · {formatPct(m.roiMes)}
                  </span>
                }
              />
              <div className="flex items-center justify-between border-t pt-1.5 font-medium">
                <span>Saldo final</span>
                <MoneyText value={m.saldoFinal} />
              </div>
              <MovDescripciones m={m} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function resultadoColor(m: MesLedger) {
  if (!m.tieneRendimiento) return "text-muted-foreground";
  return m.rendNeto > 0 ? "text-pos" : m.rendNeto < 0 ? "text-neg" : "text-muted-foreground";
}

function FilaMes({ m }: { m: MesLedger }) {
  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{nombreMes(m.anio, m.mes)}</TableCell>
        <TableCell className="text-right">
          <MoneyText value={m.saldoInicial} />
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {m.depositos > 0 ? <MoneyText value={m.depositos} /> : "—"}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {m.retiros > 0 ? <MoneyText value={m.retiros} /> : "—"}
        </TableCell>
        <TableCell className={cn("text-right font-medium", resultadoColor(m))}>
          {m.tieneRendimiento ? (
            <>
              {formatUSDSigned(m.rendNeto)}{" "}
              <span className="text-xs opacity-80">({formatPct(m.roiMes)})</span>
            </>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="text-right font-semibold">
          <MoneyText value={m.saldoFinal} />
        </TableCell>
      </TableRow>
      {m.movimientos.length > 0 && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="pt-0 text-xs text-muted-foreground">
            <MovDescripciones m={m} inline />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MovDescripciones({ m, inline }: { m: MesLedger; inline?: boolean }) {
  const conDesc = m.movimientos.filter((x) => x.descripcion);
  if (conDesc.length === 0) return null;
  return (
    <ul className={cn("text-xs text-muted-foreground", !inline && "mt-2 border-t pt-2")}>
      {conDesc.map((x, i) => (
        <li key={i}>
          • {x.tipo === "deposito" ? "Depósito" : "Retiro"}: {x.descripcion}
        </li>
      ))}
    </ul>
  );
}

function Linea({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right">{value}</span>
    </div>
  );
}
