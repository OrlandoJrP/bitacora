"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { iniciarSesion } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(iniciarSesion, undefined);
  const params = useSearchParams();
  const cambiada = params.get("cambiada") === "1";

  return (
    <form action={formAction} className="space-y-4">
      {cambiada && (
        <div className="flex items-center gap-2 rounded-md bg-pos/10 px-3 py-2 text-sm text-pos">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Contraseña actualizada. Inicia sesión con la nueva.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" variant="gold" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Ingresar
      </Button>
    </form>
  );
}
