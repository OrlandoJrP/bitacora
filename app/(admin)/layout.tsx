import { Logo } from "@/components/brand/Logo";
import { AdminSidebar } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";
import { getConfig } from "@/lib/data/config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const config = await getConfig();

  return (
    // El contenido sigue el tema elegido (claro/oscuro); la barra lateral y el
    // header navy son elementos de MARCA y se mantienen en ambos tonos.
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar fija — solo escritorio (≥ md) */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-brand-navy text-brand-cream md:flex">
          <div className="flex h-16 items-center border-b border-white/10 px-5">
            <Logo size={32} withWordmark nombre={config.nombreFondo} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AdminSidebar />
          </div>
          <div className="border-t border-white/10 p-4 text-xs text-brand-cream/50">
            Panel del operador · {config.nombreFondo}
          </div>
        </aside>

        {/* Contenido */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header: en móvil incluye la hamburguesa + drawer */}
          <AdminHeader email={session.user.email ?? ""} nombreFondo={config.nombreFondo} />

          {/*
            padding-bottom amplio en móvil para que el FAB + la barra inferior
            NUNCA tapen botones (p. ej. "Guardar"). En escritorio vuelve a la normalidad.
          */}
          <main className="flex-1 animate-enter p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-6 md:p-8 md:pb-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
