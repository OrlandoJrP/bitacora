import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { cargarPoolsTodos } from "@/lib/data/pool";
import { mesActual } from "@/lib/format";
import { CierreFondo } from "@/components/admin/fondo/cierre-fondo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Resultado del fondo" };

export default async function CierreFondoPage() {
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

  const { anio, mes } = mesActual();
  const anioMin = Number(pool.fondo.fechaInicio.slice(0, 4));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Resultado mensual · {pool.fondo.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            Registra el resultado del fondo (cerrado o flotante) y revisa el reparto por
            socio antes de guardar.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/fondo">
            <ArrowLeft className="h-4 w-4" /> Volver al fondo
          </Link>
        </Button>
      </div>

      <CierreFondo
        fondoId={pool.fondo.id}
        input={pool.input}
        anioInicial={anio}
        mesInicial={mes}
        anioMin={anioMin}
      />
    </div>
  );
}
