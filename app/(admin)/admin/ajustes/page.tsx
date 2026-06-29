import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getConfig } from "@/lib/data/config";
import { AjustesForm } from "@/components/admin/ajustes-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  await requireAdmin();
  const config = await getConfig();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Las tres decisiones configurables del fondo y el nombre.
        </p>
      </div>
      <AjustesForm
        inicial={{
          comisionPct: config.comisionPct,
          usaHighWaterMark: config.usaHighWaterMark,
          pierdeSoloCliente: config.pierdeSoloCliente,
          nombreFondo: config.nombreFondo,
        }}
      />
    </div>
  );
}
