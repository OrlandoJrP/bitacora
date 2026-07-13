import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { requireSocio } from "@/lib/auth/socio";
import { tenantCtx } from "@/lib/auth/session";
import { cargarPool } from "@/lib/data/pool";
import { HeroNumber } from "@/components/hero-number";
import { MoneyText, PctText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FondoTabs } from "@/components/cliente/fondo/fondo-tabs";
import { etiquetaMesCorta, formatPct, formatUSDSigned, nombreMes } from "@/lib/format";

export const metadata: Metadata = { title: "Fondo compartido" };

export default async function FondoSocioPage() {
  const ctx = await requireSocio();
  const pool = await cargarPool(tenantCtx(ctx.session), ctx.fondoId);
  if (!pool) notFound();

  const r = pool.resumen;
  const chart = pool.meses.map((m) => ({
    label: etiquetaMesCorta(m.anio, m.mes),
    saldo: m.saldoFinal,
  }));
  const anio = new Date().getUTCFullYear();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{pool.fondo.nombre}</h1>
          <p className="text-sm text-muted-foreground">Cuenta compartida entre socios.</p>
        </div>
        <FondoTabs />
      </div>

      {/* Héroe: capital total del fondo */}
      <Card className="overflow-hidden border-0 bg-brand-navy text-brand-cream shadow-lg">
        <CardContent className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-gold/15 blur-3xl" />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-brand-cream/70">
              Capital del fondo
            </p>
            {r.flotante && (
              <Badge variant="gold" className="gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                {nombreMes(r.flotante.anio, r.flotante.mes)} en curso ·{" "}
                {formatPct(r.flotante.roiMes)}
              </Badge>
            )}
          </div>
          <div className="mt-2 break-words font-serif text-3xl font-semibold sm:text-5xl md:text-6xl">
            <HeroNumber value={r.capitalActual} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-3">
            <HeroDato label="Ganancia acumulada" tone={r.gananciaAcumulada >= 0 ? "pos" : "neg"}>
              {formatUSDSigned(r.gananciaAcumulada)}
            </HeroDato>
            <HeroDato
              label={`Rendimiento ${anio} (TWR)`}
              tone={r.twrAnual >= 0 ? "pos" : "neg"}
            >
              {formatPct(r.twrAnual)}
            </HeroDato>
            <HeroDato
              label="Desde el inicio (TWR)"
              tone={r.twrDesdeInicio >= 0 ? "pos" : "neg"}
            >
              {formatPct(r.twrDesdeInicio)}
            </HeroDato>
          </div>
          {r.flotante && (
            <p className="mt-3 text-xs text-brand-cream/60">
              * El capital incluye el resultado flotante del mes en curso; puede variar
              hasta el cierre.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Posición por socio (transparencia total, como el reporte) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posición por socio</CardTitle>
          <CardDescription>
            Cada socio mantiene su % del fondo según su capital.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">% del fondo</TableHead>
                <TableHead className="text-right">Aportado</TableHead>
                <TableHead className="text-right">Retiros</TableHead>
                <TableHead className="text-right">Ganancia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.socios.map((s) => {
                const esPropio = s.socioId === ctx.socioId;
                return (
                  <TableRow
                    key={s.socioId}
                    className={
                      esPropio
                        ? "bg-brand-gold/10 hover:bg-brand-gold/15"
                        : s.estado === "inactivo"
                          ? "opacity-60"
                          : ""
                    }
                  >
                    <TableCell>
                      <span className="font-medium">{s.nombre}</span>
                      {esPropio && (
                        <Badge variant="gold" className="ml-2">
                          Tú
                        </Badge>
                      )}
                      {s.estado === "inactivo" && (
                        <Badge variant="muted" className="ml-2">
                          salió
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <MoneyText value={s.capitalActual} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPct(s.participacion, false)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <MoneyText value={s.totalAportado} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <MoneyText value={s.totalRetirado} />
                    </TableCell>
                    <TableCell
                      className={`text-right ${s.gananciaNeta >= 0 ? "text-pos" : "text-neg"}`}
                    >
                      {formatUSDSigned(s.gananciaNeta)}{" "}
                      <span className="text-xs opacity-75">({formatPct(s.rentabilidad)})</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Evolución */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-brand-gold-600" />
            Evolución del capital del fondo
          </CardTitle>
          <CardDescription>
            Desde {nombreMes(pool.meses[0]?.anio ?? anio, pool.meses[0]?.mes ?? 1)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaSaldo data={chart} />
        </CardContent>
      </Card>
    </div>
  );
}

function HeroDato({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "pos" | "neg";
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-brand-cream/60">{label}</p>
      <p
        className={`tabular mt-0.5 font-semibold ${
          tone === "pos" ? "text-emerald-300" : "text-red-300"
        }`}
      >
        {children}
      </p>
    </div>
  );
}
