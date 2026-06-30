import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireCliente, tenantCtx } from "@/lib/auth/session";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { CambiarPasswordForm } from "@/components/auth/cambiar-password-form";
import { MoneyText } from "@/components/money-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFechaLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function CuentaPage() {
  const { session, clienteId } = await requireCliente();
  const ledger = await cargarLedgerCliente(tenantCtx(session), clienteId);
  if (!ledger) notFound();
  const c = ledger.cliente;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Tus datos y seguridad de acceso.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos de contacto</CardTitle>
            <CardDescription>Para cambios en estos datos, contacta a tu asesor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Dato label="Nombre" value={c.nombre} />
            <Dato label="Correo" value={c.email} />
            <Dato label="Fecha de ingreso" value={formatFechaLarga(c.fechaIngreso)} />
            <Dato label="Capital inicial" value={<MoneyText value={c.capitalInicial} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cambiar contraseña</CardTitle>
            <CardDescription>Define una nueva contraseña de acceso.</CardDescription>
          </CardHeader>
          <CardContent>
            <CambiarPasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </div>
  );
}
