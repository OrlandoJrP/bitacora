import Link from "next/link";
import { Banknote, Coins, TrendingUp, Users, Wallet } from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { metricasFondo } from "@/lib/data/ledger";
import { getConfig } from "@/lib/data/config";
import { StatCard } from "@/components/stat-card";
import { MoneyText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Bars } from "@/components/charts/bars";
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
import { formatPct, formatUSDSigned, nombreMes, etiquetaMesCorta, mesActual } from "@/lib/format";

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const ctx = tenantCtx(session);
  const [m, config] = await Promise.all([metricasFondo(ctx), getConfig()]);
  const { anio, mes } = mesActual();

  // Series temporales agregadas (AUM y comisión por mes).
  const agg = new Map<string, { anio: number; mes: number; saldo: number; comision: number }>();
  for (const l of m.ledgers) {
    for (const mm of l.meses) {
      const cur = agg.get(mm.key) ?? { anio: mm.anio, mes: mm.mes, saldo: 0, comision: 0 };
      cur.saldo += mm.saldoFinal;
      cur.comision += mm.comision;
      agg.set(mm.key, cur);
    }
  }
  const serie = [...agg.values()].sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes,
  );
  const aumSerie = serie.map((s) => ({ label: etiquetaMesCorta(s.anio, s.mes), saldo: s.saldo }));
  const comisionSerie = serie.map((s) => ({
    label: etiquetaMesCorta(s.anio, s.mes),
    valor: s.comision,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visión global del fondo · {nombreMes(anio, mes)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="AUM (capital administrado)"
          value={<MoneyText value={m.aum} />}
          hint={`${m.clientesActivos} cliente(s) activo(s)`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Resultado neto del mes"
          value={
            <span className={m.resultadoNetoMesActual >= 0 ? "text-pos" : "text-neg"}>
              {formatUSDSigned(m.resultadoNetoMesActual)}
            </span>
          }
          hint={nombreMes(anio, mes)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Tu comisión del mes"
          value={<MoneyText value={m.comisionMesActual} />}
          hint={`${formatPct(Number(config.comisionPct) / 100, false)} sobre meses positivos`}
          icon={<Coins className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Tu comisión acumulada"
          value={<MoneyText value={m.comisionAcumulada} />}
          hint="Ingreso total del operador"
          icon={<Banknote className="h-4 w-4" />}
          accent
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del AUM</CardTitle>
            <CardDescription>Capital total administrado por mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaSaldo data={aumSerie} height={240} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comisión mensual del operador</CardTitle>
            <CardDescription>Tu ingreso por mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Bars data={comisionSerie} height={240} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes</CardTitle>
          <CardDescription>Saldo actual y resultado del último mes.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Saldo actual</TableHead>
                <TableHead className="text-right">Último mes</TableHead>
                <TableHead className="text-right">Comisión acum.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.ledgers.map((l) => {
                const ult = [...l.meses].reverse().find((x) => x.tieneRendimiento);
                return (
                  <TableRow key={l.cliente.id}>
                    <TableCell>
                      <Link
                        href={`/admin/reportes?cliente=${l.cliente.id}`}
                        className="font-medium hover:text-brand-gold-600 hover:underline"
                      >
                        {l.cliente.nombre}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.cliente.estado === "activo" ? "pos" : "muted"}>
                        {l.cliente.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <MoneyText value={l.resumen.saldoActual} />
                    </TableCell>
                    <TableCell className="text-right">
                      {ult ? (
                        <span className={ult.rendNeto >= 0 ? "text-pos" : "text-neg"}>
                          {formatUSDSigned(ult.rendNeto)} ({formatPct(ult.roiMes)})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <MoneyText value={l.resumen.comisionOperador} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {m.ledgers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Aún no hay clientes. Crea el primero en{" "}
                    <Link href="/admin/clientes" className="text-brand-gold-600 underline">
                      Clientes
                    </Link>
                    .
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
