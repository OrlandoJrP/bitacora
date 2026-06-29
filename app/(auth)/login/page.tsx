import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getConfig } from "@/lib/data/config";

export const metadata: Metadata = { title: "Acceso" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const config = await getConfig().catch(() => null);
  const nombre = config?.nombreFondo ?? "Brújula Markets";

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={56} />
        <h1 className="mt-4 font-serif text-3xl font-semibold text-brand-cream">Bitácora</h1>
        <p className="mt-1 text-sm text-brand-cream/70">Portal de inversionistas · {nombre}</p>
      </div>

      <Card className="border-brand-cream-200 shadow-xl">
        <CardContent className="pt-6">
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acceso exclusivo para inversionistas y operador. <br />
            Si olvidaste tu contraseña, contacta a tu asesor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
