import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CambiarPasswordForm } from "@/components/auth/cambiar-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default async function CambiarPasswordPage() {
  const session = await requireUser();
  const forzado = session.user.mustChangePassword;

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Logo size={48} />
      </div>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>{forzado ? "Configura tu contraseña" : "Cambiar contraseña"}</CardTitle>
          <CardDescription>
            {forzado
              ? "Por seguridad, define una contraseña personal antes de continuar."
              : "Actualiza tu contraseña de acceso."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CambiarPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
