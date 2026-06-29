"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ReporteSelector({
  clientes,
  current,
}: {
  clientes: { id: string; nombre: string }[];
  current: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === "consolidado") sp.delete("cliente");
    else sp.set("cliente", value);
    router.push(`/admin/reportes?${sp.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="consolidado">Consolidado (todos)</option>
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}
