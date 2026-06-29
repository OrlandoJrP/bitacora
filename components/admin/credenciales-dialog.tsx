"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function CampoCopiable({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* sin portapapeles */
    }
  }
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <code className="flex-1 truncate text-sm">{value}</code>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={copiar}>
          {copiado ? <Check className="h-4 w-4 text-pos" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function CredencialesDialog({
  open,
  onOpenChange,
  email,
  password,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  password: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-gold-600" />
            Credenciales de acceso
          </DialogTitle>
          <DialogDescription>
            Cópialas y compártelas de forma segura. Por seguridad, la contraseña{" "}
            <strong>no se volverá a mostrar</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <CampoCopiable label="Correo" value={email} />
          <CampoCopiable label="Contraseña temporal" value={password} />
          <p className="text-xs text-muted-foreground">
            El cliente deberá cambiarla en su primer inicio de sesión.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
