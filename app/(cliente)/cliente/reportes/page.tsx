import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireCliente, tenantCtx } from "@/lib/auth/session";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { MoneyText, PctText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUSDSigned } from "@/lib/format";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportesPage() {
  const { session, clienteId } = await requireCliente();
  const ledger = await cargarLedgerCliente(tenantCtx(session), clienteId);
  if (!ledger) notFound();

  const anios = ledger.porAnio;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Resumen anual de tu cuenta y descarga de tu estado de cuenta.
        </p>
      </div>

      {/* Descargar estado de cuenta (PDF) */}
      <Card className="border-brand-gold/40 bg-brand-gold/5">
        <CardHeader>
          <CardTitle className="text-base">Estado de cuenta (PDF)</CardTitle>
          <CardDescription>Elige el periodo y descarga tu estado con la marca Brújula.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action="/api/reporte-pdf"
            method="GET"
            target="_blank"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-1.5">
              <label htmlFor="anio" className="text-sm font-medium">
                Periodo
              </label>
              <select
                id="anio"
                name="anio"
                defaultValue=""
                className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todo el historial</option>
                {anios.map((a) => (
                  <option key={a.anio} value={a.anio}>
                    Año {a.anio}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="gold">
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Resumen anual */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {anios.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay resultados registrados.</p>
        )}
        {[...anios].reverse().map((a) => (
          <Card key={a.anio}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Año {a.anio}</span>
                <PctText fraction={a.roiAnual} className="text-base" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Linea label="Saldo al cierre" value={<MoneyText value={a.saldoFinal} />} bold />
              <Linea
                label="Resultado neto"
                value={
                  <span className={a.rendNeto >= 0 ? "text-pos" : "text-neg"}>
                    {formatUSDSigned(a.rendNeto)}
                  </span>
                }
              />
              <Linea
                label="Aporte neto del año"
                value={<MoneyText value={a.depositos - a.retiros} signed />}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Linea({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
