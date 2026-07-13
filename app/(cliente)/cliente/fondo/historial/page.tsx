import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSocio } from "@/lib/auth/socio";
import { tenantCtx } from "@/lib/auth/session";
import { cargarPool } from "@/lib/data/pool";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FondoTabs } from "@/components/cliente/fondo/fondo-tabs";
import { formatPct, formatUSDSigned, nombreMes } from "@/lib/format";

export const metadata: Metadata = { title: "Historial del fondo" };

export default async function HistorialFondoPage() {
  const ctx = await requireSocio();
  const pool = await cargarPool(tenantCtx(ctx.session), ctx.fondoId);
  if (!pool) notFound();

  const meses = [...pool.meses].reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Historial del fondo</h1>
          <p className="text-sm text-muted-foreground">
            Cuadro mensual: capital, movimientos y resultado del fondo.
          </p>
        </div>
        <FondoTabs />
      </div>

      {/* Escritorio: tabla */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Capital inicial</TableHead>
                <TableHead className="text-right">Aportes</TableHead>
                <TableHead className="text-right">Retiros</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Capital final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => (
                <TableRow key={m.key} className={m.enCurso ? "bg-brand-gold/5" : ""}>
                  <TableCell className="font-medium">
                    {nombreMes(m.anio, m.mes)}
                    {m.enCurso && (
                      <Badge variant="gold" className="ml-2 gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                        en curso
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText value={m.saldoInicial} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.aportes > 0 ? <MoneyText value={m.aportes} /> : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {m.retiros > 0 ? <MoneyText value={m.retiros} /> : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      !m.tieneRendimiento
                        ? "text-muted-foreground"
                        : m.resultado >= 0
                          ? "text-pos"
                          : "text-neg"
                    }`}
                  >
                    {m.tieneRendimiento ? (
                      <>
                        {formatUSDSigned(m.resultado)}{" "}
                        <span className="text-xs opacity-80">({formatPct(m.tasaTwr)})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <MoneyText value={m.saldoFinal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Móvil: tarjetas */}
      <div className="space-y-3 md:hidden">
        {meses.map((m) => (
          <Card key={m.key} className={m.enCurso ? "border-brand-gold/40 bg-brand-gold/5" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{nombreMes(m.anio, m.mes)}</span>
                {m.enCurso ? (
                  <Badge variant="gold" className="gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    en curso
                  </Badge>
                ) : m.tieneRendimiento ? (
                  <span className={m.resultado >= 0 ? "text-pos" : "text-neg"}>
                    {formatPct(m.tasaTwr)}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Linea label="Capital inicial" value={<MoneyText value={m.saldoInicial} />} />
              {m.aportes > 0 && <Linea label="Aportes" value={<MoneyText value={m.aportes} />} />}
              {m.retiros > 0 && <Linea label="Retiros" value={<MoneyText value={m.retiros} />} />}
              <Linea
                label="Resultado"
                value={
                  m.tieneRendimiento ? (
                    <span className={m.resultado >= 0 ? "text-pos" : "text-neg"}>
                      {formatUSDSigned(m.resultado)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <div className="flex items-center justify-between gap-2 border-t pt-1.5 font-medium">
                <span>Capital final</span>
                <MoneyText value={m.saldoFinal} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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
