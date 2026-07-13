import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/user-menu";
import {
  ClienteNavDesktop,
  ClienteNavMobile,
  type VarianteNav,
} from "@/components/cliente/cliente-nav";
import { IosInstallHint } from "@/components/cliente/ios-install-hint";
import { contextoPortal } from "@/lib/auth/socio";
import { getConfig } from "@/lib/data/config";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contextoPortal();
  const config = await getConfig();

  const variante: VarianteNav = ctx.esSocio
    ? ctx.tieneIndividual
      ? "ambos"
      : "fondo"
    : "individual";

  return (
    <div className="min-h-screen bg-brand-cream pb-nav-safe md:pb-0">
      <header className="safe-top sticky top-0 z-30 border-b border-brand-cream-200 bg-brand-cream/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 md:gap-6">
            <Logo size={36} withWordmark nombre={config.nombreFondo} />
            <ClienteNavDesktop variante={variante} />
          </div>
          <UserMenu
            email={ctx.session.user.email ?? ""}
            rol={variante === "fondo" ? "Socio" : "Inversionista"}
            accountHref="/cliente/cuenta"
          />
        </div>
      </header>

      <main className="container animate-enter py-6 md:py-10">{children}</main>

      <IosInstallHint />
      <ClienteNavMobile variante={variante} />
    </div>
  );
}
