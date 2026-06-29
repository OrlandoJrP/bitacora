import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/user-menu";
import { AdminSidebar, AdminTopNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/session";
import { getConfig } from "@/lib/data/config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const config = await getConfig();

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar (escritorio) */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-brand-navy lg:flex">
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
          <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-navy/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3 lg:hidden">
                <Logo size={30} />
                <span className="font-serif text-lg font-semibold">Bitácora</span>
              </div>
              <div className="hidden lg:block">
                <span className="text-sm text-brand-cream/60">Panel del operador</span>
              </div>
              <UserMenu email={session.user.email ?? ""} rol="Operador" />
            </div>
            <AdminTopNav />
          </header>

          <main className="flex-1 animate-enter p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
