"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClienteFormDialog } from "./cliente-form-dialog";
import { CredencialesDialog } from "./credenciales-dialog";

export function NuevoClienteButton() {
  const [open, setOpen] = useState(false);
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);

  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo cliente
      </Button>
      <ClienteFormDialog open={open} onOpenChange={setOpen} onCreated={setCred} />
      <CredencialesDialog
        open={!!cred}
        onOpenChange={(v) => !v && setCred(null)}
        email={cred?.email ?? ""}
        password={cred?.password ?? ""}
      />
    </>
  );
}
