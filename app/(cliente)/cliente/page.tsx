import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { requireCliente, tenantCtx } from "@/lib/auth/session";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { HeroNumber } from "@/components/hero-number";
import { MoneyText, PctText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPct, formatUSDSigned, nombreMes, etiquetaMesCorta } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ResumenPage() {
  const { session, clienteId } = await requireCliente();
  const ledger = await cargarLedgerCliente(tenantCtx(session), clienteId);
  if (!ledger) notFound();

  const r = ledger.resumen;
  const ultimo = [...ledger.meses].reverse().find((m) => m.tieneRendimiento) ?? r.ultimoMes;
  const positivo = (ultimo?.rendNeto ?? 0) >= 0;

  const chartData = ledger.meses.map((m) => ({
    label: etiquetaMesCorta(m.anio, m.mes),
    saldo: m.saldoFinal,
  }));

  return (
    <div className="space-y-6">
      {/* HÉROE: saldo actual */}
      <Card className="overflow-hidden border-0 bg-brand-navy text-brand-cream shadow-lg">
        <CardContent className="relative p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-gold/15 blur-3xl" />
          <p className="text-sm font-medium uppercase tracking-wide text-brand-cream/70">
            Tu saldo actual
          </p>
          <div className="mt-2 font-serif text-5xl font-semibold sm:text-6xl">
            <HeroNumber value={r.saldoActual} />
          </div>
          {ultimo && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium",
                  positivo ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg",
                )}
              >
                {positivo ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {formatPct(ultimo.roiMes)} · {formatUSDSigned(ultimo.rendNeto)}
              </span>
              <span className="text-brand-cream/60">
                en {nombreMes(ultimo.anio, ultimo.mes)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mes actual / último resultado */}
      {ultimo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado de {nombreMes(ultimo.anio, ultimo.mes)}</CardTitle>
            <CardDescription>Cómo evolucionó tu cuenta ese mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Paso label="Saldo inicial" value={<MoneyText value={ultimo.saldoInicial} />} />
              <Paso
                label="Resultado del mes"
                value={
                  <span className={ultimo.rendNeto >= 0 ? "text-pos" : "text-neg"}>
                    {formatUSDSigned(ultimo.rendNeto)} · {formatPct(ultimo.roiMes)}
                  </span>
                }
              />
              <Paso label="Saldo final" value={<MoneyText value={ultimo.saldoFinal} />} accent />
            </div>
            {(ultimo.depositos > 0 || ultimo.retiros > 0) && (
              <p className="mt-4 text-xs text-muted-foreground">
                {ultimo.depositos > 0 && <>Depósitos del mes: <MoneyText value={ultimo.depositos} />. </>}
                {ultimo.retiros > 0 && <>Retiros del mes: <MoneyText value={ultimo.retiros} />.</>}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráfico de saldo en el tiempo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu saldo en el tiempo</CardTitle>
          <CardDescription>
            Desde tu ingreso ({nombreMes(ledger.meses[0]?.anio ?? 0, ledger.meses[0]?.mes ?? 1)}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaSaldo data={chartData} />
        </CardContent>
      </Card>

      {/* ROI year / accumulated */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RoiCard
          titulo="Rendimiento del año en curso"
          fraction={r.roiAnioActual}
          subtitulo="Acumulado de los meses de este año."
        />
        <RoiCard
          titulo="Rendimiento desde tu ingreso"
          fraction={r.roiAcumulado}
          subtitulo={`Sobre un aporte neto de ${formatUSDSigned(r.aporteNeto).replace("+", "")}.`}
        />
      </div>
    </div>
  );
}

function Paso({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-4", accent && "border-brand-gold/40 bg-brand-gold/5")}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl font-semibold">{value}</p>
    </div>
  );
}

function RoiCard({
  titulo,
  fraction,
  subtitulo,
}: {
  titulo: string;
  fraction: number;
  subtitulo: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
          <p className="mt-2 font-serif text-4xl font-semibold">
            <PctText fraction={fraction} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitulo}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gold/15 text-brand-gold-600">
          <TrendingUp className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}
