"use client";

import { useRouter } from "next/navigation";

export function MovimientosFiltro({
  clientes,
  current,
}: {
  clientes: { id: string; nombre: string }[];
  current: string;
}) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v === "todos" ? "/admin/movimientos" : `/admin/movimientos?cliente=${v}`);
      }}
      aria-label="Filtrar por cliente"
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="todos">Todos los clientes</option>
      {clientes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}
