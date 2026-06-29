import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { Importar } from "@/components/admin/importar";

export const metadata: Metadata = { title: "Importar histórico" };

export default async function ImportarPage() {
  await requireAdmin();
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Importar histórico</h1>
        <p className="text-sm text-muted-foreground">
          Carga de una sola vez los rendimientos y movimientos desde septiembre 2024 con las
          plantillas. Validación previa y reporte de errores por fila.
        </p>
      </div>
      <Importar />
    </div>
  );
}
