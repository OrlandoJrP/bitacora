import { notFound, redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Coins,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { requireCliente, tenantCtx } from "@/lib/auth/session";
import { contextoPortal } from "@/lib/auth/socio";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { estadisticas, round2 } from "@/lib/finance/ledger";
import { HeroNumber } from "@/components/hero-number";
import { MoneyText, PctText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Bars } from "@/components/charts/bars";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  etiquetaMesCorta,
  formatPct,
  formatUSD,
  formatUSDSigned,
  mesActual,
  nombreMes,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ResumenPage() {
  // Socio sin cuenta individual → su portal es el fondo compartido.
  const portal = await contextoPortal();
  if (portal.esSocio && !portal.tieneIndividual) redirect("/cliente/fondo");

  const { session, clienteId } = await requireCliente();
  const ledger = await cargarLedgerCliente(tenantCtx(session), clienteId);
  if (!ledger) notFound();

  const r = ledger.resumen;
  // Solo cuando el saldo es BRUTO (el cliente pagó la comisión por fuera) lo que
  // se ve es el RESULTADO de la cuenta y no lo que le quedó neto. Si la comisión
  // ya se retiró de la cuenta, el saldo YA es neto y el texto normal es correcto.
  const informativa = (ledger.config.tratamientoComision ?? "descontada") === "pagada_aparte";
  const { anio } = mesActual();
  const stats = estadisticas(ledger.meses);
  const gananciaAnio = round2(
    ledger.meses.filter((m) => m.anio === anio).reduce((s, m) => s + m.rendNeto, 0),
  );

  // Solo meses con resultado REAL registrado; sin fallback para no mostrar
  // un "$0.00" fabricado a clientes que aún no tienen su primer cierre.
  const ultimo = [...ledger.meses].reverse().find((m) => m.tieneRendimiento);
  const positivo = (ultimo?.rendNeto ?? 0) >= 0;

  const chartSaldo = ledger.meses.map((m) => ({
    label: etiquetaMesCorta(m.anio, m.mes),
    saldo: m.saldoFinal,
  }));
  const chartResultados = ledger.meses.map((m) => ({
    label: etiquetaMesCorta(m.anio, m.mes),
    valor: m.rendNeto,
  }));

  return (
    <div className="space-y-6">
      {/* HÉROE: saldo actual */}
      <Card className="overflow-hidden border-0 bg-brand-navy text-brand-cream shadow-lg">
        <CardContent className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-gold/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand-gold/5 blur-3xl" />
          <p className="text-sm font-medium uppercase tracking-wide text-brand-cream/70">
            Tu saldo actual
          </p>
          <div className="mt-2 break-words font-serif text-3xl font-semibold sm:text-5xl md:text-6xl">
            <HeroNumber value={r.saldoActual} />
          </div>
          {ultimo && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium",
                  // Tonos claros para contraste AA sobre el navy del héroe.
                  positivo
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-red-400/15 text-red-300",
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

          {/* Cifras clave dentro del héroe */}
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-3 sm:gap-6">
            <HeroDato
              label={informativa ? "Aportado − retirado" : "Aporte neto"}
              value={formatUSD(r.aporteNeto)}
            />
            <HeroDato
              label={informativa ? "Resultado de la cuenta" : "Ganancia total"}
              value={formatUSDSigned(r.gananciaNeta)}
              tone={r.gananciaNeta > 0 ? "pos" : r.gananciaNeta < 0 ? "neg" : undefined}
            />
            <HeroDato
              label="Rendimiento total"
              value={formatPct(r.roiAcumulado)}
              tone={r.roiAcumulado > 0 ? "pos" : r.roiAcumulado < 0 ? "neg" : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Resultados de tu cuenta */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Tile
          icon={<Coins className="h-4 w-4" />}
          label={informativa ? "Resultado de la cuenta" : "Ganancia total"}
          main={<MoneyText value={r.gananciaNeta} signed colored />}
          sub={
            informativa
              ? "Antes de la comisión, liquidada aparte"
              : `${formatPct(r.roiAcumulado)} desde tu ingreso`
          }
        />
        <Tile
          icon={<CalendarDays className="h-4 w-4" />}
          label={`Resultado ${anio}`}
          main={
            <span className={gananciaAnio > 0 ? "text-pos" : gananciaAnio < 0 ? "text-neg" : ""}>
              {formatUSDSigned(gananciaAnio)}
            </span>
          }
          sub={`${formatPct(r.roiAnioActual)} en el año`}
        />
        <Tile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Promedio mensual"
          main={<PctText fraction={stats.promedioRoiMensual} />}
          sub={`${stats.mesesConRendimiento} mes(es) con resultado`}
        />
        <Tile
          icon={<Trophy className="h-4 w-4" />}
          label="Mejor mes"
          main={
            stats.mejorMes ? (
              <PctText fraction={stats.mejorMes.roiMes} />
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
          sub={
            stats.mejorMes
              ? nombreMes(stats.mejorMes.anio, stats.mejorMes.mes)
              : "Aún sin resultados"
          }
        />
      </div>

      {/* Aportes y consistencia */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <MiniLinea
            icon={<ArrowDownLeft className="h-4 w-4 text-pos" />}
            label="Depósitos totales"
            value={<MoneyText value={r.totalDepositos} />}
          />
          <MiniLinea
            icon={<ArrowUpRight className="h-4 w-4 text-neg" />}
            label="Retiros totales"
            value={<MoneyText value={r.totalRetiros} />}
          />
          <MiniLinea
            icon={<TrendingUp className="h-4 w-4 text-brand-gold-600" />}
            label="Meses en positivo"
            value={
              <span className="tabular">
                {stats.mesesPositivos} de {stats.mesesConRendimiento}
              </span>
            }
          />
        </CardContent>
      </Card>

      {/* Mes actual / último resultado */}
      {ultimo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resultado de {nombreMes(ultimo.anio, ultimo.mes)}
            </CardTitle>
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
                {ultimo.depositos > 0 && (
                  <>Depósitos del mes: <MoneyText value={ultimo.depositos} />. </>
                )}
                {ultimo.retiros > 0 && (
                  <>Retiros del mes: <MoneyText value={ultimo.retiros} />.</>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tu saldo en el tiempo</CardTitle>
            <CardDescription>
              Desde tu ingreso ({nombreMes(ledger.meses[0]?.anio ?? 0, ledger.meses[0]?.mes ?? 1)}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AreaSaldo data={chartSaldo} height={240} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado neto por mes</CardTitle>
            <CardDescription>Ganancia o pérdida de cada mes, en USD.</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars data={chartResultados} height={240} signedColors />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Piezas locales ──────────────────────────────────────────────────────── */

function HeroDato({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <p className="text-xs uppercase tracking-wide text-brand-cream/60">{label}</p>
      <p
        className={cn(
          "tabular font-semibold sm:mt-0.5",
          // Tonos claros: legibles sobre el fondo navy del héroe.
          tone === "pos" && "text-emerald-300",
          tone === "neg" && "text-red-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Tile({
  icon,
  label,
  main,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  main: React.ReactNode;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gold/15 text-brand-gold-600">
            {icon}
          </span>
        </div>
        <p className="mt-2 break-words font-serif text-2xl font-semibold tabular">{main}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MiniLinea({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold">{value}</span>
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
