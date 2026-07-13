import Link from "next/link";
import { desc } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Coins,
  Download,
  PieChart,
  PiggyBank,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { metricasFondo } from "@/lib/data/ledger";
import { cargarPoolsTodos } from "@/lib/data/pool";
import { getConfig } from "@/lib/data/config";
import { db } from "@/lib/db";
import { auditoria } from "@/drizzle/schema";
import { StatCard } from "@/components/stat-card";
import { MoneyText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Bars } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  etiquetaMesCorta,
  formatFechaHora,
  formatPct,
  formatUSD,
  formatUSDSigned,
  mesActual,
  nombreMes,
} from "@/lib/format";

const r2 = (n: number) => Math.round(n * 100) / 100;

const ACCION_VARIANT: Record<string, "pos" | "gold" | "neg" | "muted"> = {
  crear: "pos",
  editar: "gold",
  eliminar: "neg",
};

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const ctx = tenantCtx(session);
  const [m, pools, config, actividad] = await Promise.all([
    metricasFondo(ctx),
    cargarPoolsTodos(ctx),
    getConfig(),
    db.select().from(auditoria).orderBy(desc(auditoria.createdAt)).limit(6),
  ]);
  const { anio, mes } = mesActual();

  // ── Fondo común: se SUMA a la visión global del operador ────────────────
  // (modalidad separada de los clientes individuales, pero el dashboard es la
  // foto completa de todo lo que administras).
  const poolsActivos = pools.filter((p) => p.fondo.estado === "activo");
  const hayFondo = poolsActivos.length > 0;
  const fondoCapital = r2(poolsActivos.reduce((s, p) => s + p.resumen.capitalActual, 0));
  const fondoComisionAcum = r2(
    poolsActivos.reduce((s, p) => s + p.resumen.comisionPorCobrar, 0),
  );
  const fondoAportes = r2(poolsActivos.reduce((s, p) => s + p.resumen.totalAportes, 0));
  const fondoRetiros = r2(poolsActivos.reduce((s, p) => s + p.resumen.totalRetiros, 0));
  const fondoGanancia = r2(poolsActivos.reduce((s, p) => s + p.resumen.gananciaAcumulada, 0));
  let fondoResultadoMes = 0;
  let fondoComisionMes = 0;
  let fondoFlotanteEsteMes = false;
  for (const p of poolsActivos) {
    const mm = p.meses.find((x) => x.anio === anio && x.mes === mes);
    if (mm) {
      fondoResultadoMes += mm.resultado;
      fondoComisionMes += mm.comisionMes;
      if (mm.enCurso) fondoFlotanteEsteMes = true;
    }
  }
  fondoResultadoMes = r2(fondoResultadoMes);
  fondoComisionMes = r2(fondoComisionMes);

  // Totales combinados (individual + fondo común).
  const aumTotal = r2(m.aum + fondoCapital);
  const resultadoMesTotal = r2(m.resultadoNetoMesActual + fondoResultadoMes);
  const comisionMesTotal = r2(m.comisionMesActual + fondoComisionMes);
  const comisionAcumTotal = r2(m.comisionAcumulada + fondoComisionAcum);

  // Estado del cierre del mes en curso. Solo cuentan los clientes activos que
  // YA habían ingresado en este mes (un ingreso futuro no puede tener cierre).
  const mesKey = `${anio}-${String(mes).padStart(2, "0")}`;
  const activos = m.ledgers.filter((l) => l.cliente.estado === "activo");
  const elegibles = activos.filter((l) => l.cliente.fechaIngreso.slice(0, 7) <= mesKey);
  const pendientes = elegibles.filter(
    (l) => !l.meses.some((x) => x.anio === anio && x.mes === mes && x.tieneRendimiento),
  );
  const nombresPendientes =
    pendientes
      .slice(0, 3)
      .map((l) => l.cliente.nombre)
      .join(", ") + (pendientes.length > 3 ? ` y ${pendientes.length - 3} más` : "");

  // Totales combinados de flujos (individual + fondo común).
  const depTotales = r2(
    m.ledgers.reduce((s, l) => s + l.resumen.totalDepositos, 0) + fondoAportes,
  );
  const retTotales = r2(
    m.ledgers.reduce((s, l) => s + l.resumen.totalRetiros, 0) + fondoRetiros,
  );
  const aporteNeto = r2(
    m.ledgers.reduce((s, l) => s + l.resumen.aporteNeto, 0) + fondoAportes - fondoRetiros,
  );
  const gananciaClientes = r2(
    m.ledgers.reduce((s, l) => s + l.resumen.gananciaNeta, 0) + fondoGanancia,
  );

  // Series temporales agregadas. El AUM solo suma clientes ACTIVOS (para que el
  // último punto cuadre con la tarjeta AUM); la comisión incluye todos (ingreso
  // histórico del operador, igual que "comisión acumulada").
  const agg = new Map<string, { anio: number; mes: number; saldo: number; comision: number }>();
  for (const l of m.ledgers) {
    const esActivo = l.cliente.estado === "activo";
    for (const mm of l.meses) {
      const cur = agg.get(mm.key) ?? { anio: mm.anio, mes: mm.mes, saldo: 0, comision: 0 };
      if (esActivo) cur.saldo += mm.saldoFinal;
      cur.comision += mm.comision;
      agg.set(mm.key, cur);
    }
  }
  // El fondo común también entra en las series (capital y comisión informativa).
  for (const p of poolsActivos) {
    for (const mm of p.meses) {
      const cur = agg.get(mm.key) ?? { anio: mm.anio, mes: mm.mes, saldo: 0, comision: 0 };
      cur.saldo += mm.saldoFinal;
      cur.comision += mm.comisionMes;
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
          Visión global de todo lo que administras · {nombreMes(anio, mes)}
        </p>
      </div>

      {/* Estado del cierre del mes */}
      {elegibles.length > 0 &&
        (pendientes.length > 0 ? (
          <Card className="border-brand-gold/50 bg-brand-gold/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gold/20 text-brand-gold-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Cierre de {nombreMes(anio, mes)} pendiente</p>
                <p className="text-sm text-muted-foreground">
                  Falta el resultado de {pendientes.length} de {elegibles.length} cliente(s):{" "}
                  {nombresPendientes}.
                </p>
              </div>
              <Button asChild variant="gold" size="sm">
                <Link href="/admin/cierre">Cargar cierre</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-pos/40 bg-pos/5">
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-pos" />
              <p className="text-sm">
                <span className="font-medium">Cierre de {nombreMes(anio, mes)} completo.</span>{" "}
                Los {elegibles.length} cliente(s) activo(s) ya tienen su resultado registrado.
              </p>
            </CardContent>
          </Card>
        ))}

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAction
          href="/admin/cierre"
          icon={<CalendarCheck className="h-4 w-4" />}
          title="Cargar cierre"
          desc="Resultados del mes"
        />
        <QuickAction
          href="/admin/clientes"
          icon={<UserPlus className="h-4 w-4" />}
          title="Nuevo cliente"
          desc="Alta de inversionista"
        />
        <QuickAction
          href="/admin/movimientos"
          icon={<ArrowLeftRight className="h-4 w-4" />}
          title="Movimientos"
          desc="Depósitos y retiros"
        />
        <QuickAction
          href="/api/export?formato=xlsx"
          icon={<Download className="h-4 w-4" />}
          title="Exportar Excel"
          desc="Consolidado del fondo"
          external
        />
      </div>

      {/* Métricas principales (individual + fondo común) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="AUM (capital administrado)"
          value={<MoneyText value={aumTotal} />}
          hint={
            hayFondo
              ? `Individual ${formatUSD(m.aum)} · Fondo ${formatUSD(fondoCapital)}`
              : `${m.clientesActivos} cliente(s) activo(s)`
          }
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Resultado neto del mes"
          value={
            <span className={resultadoMesTotal >= 0 ? "text-pos" : "text-neg"}>
              {formatUSDSigned(resultadoMesTotal)}
            </span>
          }
          hint={`${nombreMes(anio, mes)}${fondoFlotanteEsteMes ? " · incluye flotante del fondo" : ""}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Tu comisión del mes"
          value={<MoneyText value={comisionMesTotal} />}
          hint={
            hayFondo
              ? `Individual ${formatUSD(m.comisionMesActual)} · Fondo ${formatUSD(fondoComisionMes)}`
              : `${formatPct(Number(config.comisionPct) / 100, false)} sobre meses positivos`
          }
          icon={<Coins className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Tu comisión acumulada"
          value={<MoneyText value={comisionAcumTotal} />}
          hint={
            hayFondo
              ? `Individual ${formatUSD(m.comisionAcumulada)} · Fondo ${formatUSD(fondoComisionAcum)}`
              : "Ingreso total del operador"
          }
          icon={<Banknote className="h-4 w-4" />}
          accent
        />
      </div>

      {/* Fondo común: resumen con enlace */}
      {hayFondo && (
        <Card className="border-brand-gold/30">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gold/15 text-brand-gold-600">
              <PieChart className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                {poolsActivos.length === 1 ? poolsActivos[0]!.fondo.nombre : "Fondos comunes"}
                {fondoFlotanteEsteMes && (
                  <Badge variant="gold" className="gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    mes en curso
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {poolsActivos.reduce((s, p) => s + p.resumen.socios.filter((x) => x.estado === "activo").length, 0)}{" "}
                socio(s) activo(s) · TWR desde inicio{" "}
                {formatPct(poolsActivos[0]?.resumen.twrDesdeInicio ?? 0)}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Capital</p>
                <p className="font-serif text-lg font-semibold tabular">
                  <MoneyText value={fondoCapital} />
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tu comisión (informativa)
                </p>
                <p className="font-serif text-lg font-semibold tabular text-brand-gold-600">
                  <MoneyText value={fondoComisionAcum} />
                </p>
              </div>
              <Button asChild variant="gold" size="sm">
                <Link href="/admin/fondo">Ver fondo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totales del fondo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Depósitos totales"
          value={<MoneyText value={depTotales} />}
          hint={hayFondo ? "Incluye aportes del fondo común" : undefined}
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
        <StatCard
          label="Retiros totales"
          value={<MoneyText value={retTotales} />}
          hint={hayFondo ? "Incluye retiros del fondo común" : undefined}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Aporte neto total"
          value={<MoneyText value={aporteNeto} />}
          hint={hayFondo ? "Individual + fondo común" : undefined}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard
          label="Ganancia neta generada"
          value={
            <span className={gananciaClientes >= 0 ? "text-pos" : "text-neg"}>
              {formatUSDSigned(gananciaClientes)}
            </span>
          }
          hint={hayFondo ? "Clientes + socios del fondo" : undefined}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del AUM</CardTitle>
            <CardDescription>
              Capital total administrado por mes{hayFondo ? " (clientes + fondo común)" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AreaSaldo data={aumSerie} height={240} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comisión mensual del operador</CardTitle>
            <CardDescription>
              Tu ingreso por mes{hayFondo ? " (cobrada + informativa del fondo)" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Bars data={comisionSerie} height={240} />
          </CardContent>
        </Card>
      </div>

      {/* Clientes */}
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

      {/* Actividad reciente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <CardDescription>Últimos cambios registrados en el sistema.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/auditoria">Ver todo</Link>
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border/60 p-0">
          {actividad.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-6">
              <Badge variant={ACCION_VARIANT[a.accion] ?? "muted"} className="shrink-0">
                {a.accion}
              </Badge>
              <span className="font-medium capitalize">{a.entidad}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {a.actorEmail ?? "—"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFechaHora(a.createdAt)}
              </span>
            </div>
          ))}
          {actividad.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Sin actividad registrada aún.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  desc,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gold/15 text-brand-gold-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
    </>
  );
  const clases =
    "flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/5 sm:p-4";
  return external ? (
    <a href={href} className={clases}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={clases}>
      {inner}
    </Link>
  );
}
