"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cambiarPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CambiarPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      actual: String(fd.get("actual") ?? ""),
      nueva: String(fd.get("nueva") ?? ""),
      confirmar: String(fd.get("confirmar") ?? ""),
    };
    setErrores({});
    setErrorGeneral(null);
    startTransition(async () => {
      // En éxito, la acción cierra sesión y redirige (no retorna aquí).
      const res = await cambiarPassword(input);
      if (res && !res.ok) {
        setErrorGeneral(res.error);
        setErrores(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        id="actual"
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        errors={errores.actual}
      />
      <Field
        id="nueva"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con letras y números."
        errors={errores.nueva}
      />
      <Field
        id="confirmar"
        label="Confirmar nueva contraseña"
        type="password"
        autoComplete="new-password"
        errors={errores.confirmar}
      />

      {errorGeneral && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorGeneral}
        </div>
      )}

      <Button type="submit" variant="gold" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar nueva contraseña
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  hint,
  errors,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  hint?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} autoComplete={autoComplete} required />
      {hint && !errors?.length && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}
