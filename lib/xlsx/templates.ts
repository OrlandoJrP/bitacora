import "server-only";
import * as XLSX from "xlsx";

type ClienteRef = { nombre: string; email: string };

function withSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

/** Plantilla .xlsx para importar RENDIMIENTOS mensuales. */
export function plantillaRendimientos(clientes: ClienteRef[]): Buffer {
  const wb = XLSX.utils.book_new();
  withSheet(wb, "Rendimientos", [
    { cliente: "demo@brujulamarkets.com", anio: 2024, mes: 9, modo: "porcentaje", valor: 8, descripcion: "Ejemplo" },
    { cliente: "demo@brujulamarkets.com", anio: 2024, mes: 10, modo: "porcentaje", valor: -3, descripcion: "" },
    { cliente: "demo@brujulamarkets.com", anio: 2024, mes: 11, modo: "monto", valor: 608.18, descripcion: "" },
  ]);
  withSheet(
    wb,
    "Instrucciones",
    [
      { campo: "cliente", detalle: "Correo del cliente (recomendado) o su nombre exacto." },
      { campo: "anio", detalle: "Año del resultado, ej. 2024." },
      { campo: "mes", detalle: "Mes 1-12." },
      { campo: "modo", detalle: "porcentaje | monto | saldo_final" },
      { campo: "valor", detalle: "Según modo: % (5.25), USD (800.00) o saldo final (10520.00). Admite negativos en % y monto." },
      { campo: "descripcion", detalle: "Opcional." },
      { campo: "—", detalle: "Importación idempotente: re-importar el mismo mes lo actualiza, no lo duplica." },
    ],
  );
  withSheet(wb, "Clientes", clientes.length ? clientes : [{ nombre: "(sin clientes)", email: "" }]);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Plantilla .xlsx para importar MOVIMIENTOS (depósitos/retiros). */
export function plantillaMovimientos(clientes: ClienteRef[]): Buffer {
  const wb = XLSX.utils.book_new();
  withSheet(wb, "Movimientos", [
    { cliente: "demo@brujulamarkets.com", tipo: "deposito", fecha: "2024-11-15", monto: 5000, descripcion: "Aporte adicional" },
    { cliente: "demo@brujulamarkets.com", tipo: "retiro", fecha: "2025-01-10", monto: 1000, descripcion: "Retiro parcial" },
  ]);
  withSheet(
    wb,
    "Instrucciones",
    [
      { campo: "cliente", detalle: "Correo del cliente (recomendado) o su nombre exacto." },
      { campo: "tipo", detalle: "deposito | retiro" },
      { campo: "fecha", detalle: "Formato AAAA-MM-DD, ej. 2024-11-15." },
      { campo: "monto", detalle: "USD, siempre mayor que 0." },
      { campo: "descripcion", detalle: "Opcional." },
    ],
  );
  withSheet(wb, "Clientes", clientes.length ? clientes : [{ nombre: "(sin clientes)", email: "" }]);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
