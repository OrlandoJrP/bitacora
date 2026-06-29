"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withTenant } from "@/lib/db";
import { movimientos, rendimientosMensuales } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { cargarLedgersTodos } from "@/lib/data/ledger";
import { registrarAuditoria } from "@/lib/audit";
import { leerFilas, aFechaISO, aNumero, aTexto } from "@/lib/xlsx/import";
import {
  guardarRendimientoSchema,
  crearMovimientoSchema,
} from "@/lib/validations";
import { ADMIN_CTX, fail, ok, type ActionResult } from "@/lib/types";
import { monthKey, type Modo } from "@/lib/finance/ledger";

const DIACRITICS = /[̀-ͯ]/g;
const norm = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();

function normModo(v: unknown): Modo | null {
  const s = norm(v);
  if (["porcentaje", "%", "pct", "porciento"].includes(s)) return "porcentaje";
  if (["monto", "$", "usd", "cantidad"].includes(s)) return "monto";
  if (["saldo_final", "saldo final", "saldofinal", "saldo"].includes(s)) return "saldo_final";
  return null;
}
function normTipo(v: unknown): "deposito" | "retiro" | null {
  const s = norm(v);
  if (["deposito", "deposit", "aporte"].includes(s)) return "deposito";
  if (["retiro", "withdrawal", "retirada"].includes(s)) return "retiro";
  return null;
}

export interface ImportReport {
  tipo: "rendimientos" | "movimientos";
  total: number;
  creados: number;
  actualizados: number;
  omitidos: number;
  errores: { fila: number; error: string }[];
  dryRun: boolean;
}

const MAX_FILAS = 5000;

export async function procesarImport(formData: FormData): Promise<ActionResult<ImportReport>> {
  const session = await requireAdmin();
  const tipo = (String(formData.get("tipo") ?? "rendimientos") === "movimientos"
    ? "movimientos"
    : "rendimientos") as ImportReport["tipo"];
  const dryRun = String(formData.get("dry") ?? "") === "1";
  const archivo = formData.get("archivo");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return fail("Adjunta un archivo .xlsx o .csv.");
  }

  let filas;
  try {
    const buf = await archivo.arrayBuffer();
    filas = leerFilas(buf, tipo === "movimientos" ? "Movimientos" : "Rendimientos");
  } catch {
    return fail("No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?");
  }
  if (filas.length === 0) return fail("El archivo no tiene filas de datos.");
  if (filas.length > MAX_FILAS) return fail(`Demasiadas filas (máx. ${MAX_FILAS}).`);

  // Resolver clientes y precargar lo existente.
  const ledgers = await cargarLedgersTodos(ADMIN_CTX);
  const porEmail = new Map<string, string>();
  const porNombre = new Map<string, string>();
  for (const l of ledgers) {
    porEmail.set(norm(l.cliente.email), l.cliente.id);
    porNombre.set(norm(l.cliente.nombre), l.cliente.id);
  }
  const rendExistentes = new Set<string>(); // `${clienteId}:${anio}-${mes}`
  const movExistentes = new Set<string>(); // firma de movimiento
  for (const l of ledgers) {
    for (const r of l.rendimientos) rendExistentes.add(`${r.clienteId}:${monthKey(r.anio, r.mes)}`);
    for (const m of l.movimientos)
      movExistentes.add(`${m.clienteId}|${m.tipo}|${m.fecha}|${Number(m.monto)}|${m.descripcion ?? ""}`);
  }

  function resolverCliente(v: unknown): string | null {
    const s = norm(v);
    return porEmail.get(s) ?? porNombre.get(s) ?? null;
  }

  const errores: { fila: number; error: string }[] = [];
  const rendsPlan: { clienteId: string; anio: number; mes: number; modo: Modo; valor: number; descripcion: string | null; update: boolean }[] = [];
  const movsPlan: { clienteId: string; tipo: "deposito" | "retiro"; monto: number; fecha: string; descripcion: string | null }[] = [];
  let omitidos = 0;

  filas.forEach((f, i) => {
    const fila = i + 2; // +1 header, +1 base-1
    const clienteId = resolverCliente(f.cliente);
    if (!clienteId) {
      errores.push({ fila, error: `Cliente no encontrado: "${aTexto(f.cliente)}"` });
      return;
    }

    if (tipo === "rendimientos") {
      const modo = normModo(f.modo);
      if (!modo) {
        errores.push({ fila, error: `Modo inválido: "${aTexto(f.modo)}" (usa porcentaje, monto o saldo_final)` });
        return;
      }
      const parsed = guardarRendimientoSchema.safeParse({
        clienteId,
        anio: f.anio,
        mes: f.mes,
        modo,
        valor: aNumero(f.valor),
        descripcion: aTexto(f.descripcion) || null,
      });
      if (!parsed.success) {
        errores.push({ fila, error: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Datos inválidos" });
        return;
      }
      const key = `${clienteId}:${monthKey(parsed.data.anio, parsed.data.mes)}`;
      rendsPlan.push({ ...parsed.data, descripcion: parsed.data.descripcion ?? null, update: rendExistentes.has(key) });
    } else {
      const tipoMov = normTipo(f.tipo);
      if (!tipoMov) {
        errores.push({ fila, error: `Tipo inválido: "${aTexto(f.tipo)}" (usa deposito o retiro)` });
        return;
      }
      const fecha = aFechaISO(f.fecha);
      const parsed = crearMovimientoSchema.safeParse({
        clienteId,
        tipo: tipoMov,
        monto: aNumero(f.monto),
        fecha,
        descripcion: aTexto(f.descripcion) || null,
      });
      if (!parsed.success) {
        errores.push({ fila, error: Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Datos inválidos" });
        return;
      }
      const firma = `${clienteId}|${tipoMov}|${parsed.data.fecha}|${parsed.data.monto}|${parsed.data.descripcion ?? ""}`;
      if (movExistentes.has(firma)) {
        omitidos += 1;
        return;
      }
      movExistentes.add(firma); // evita duplicados dentro del mismo archivo
      movsPlan.push({ ...parsed.data, descripcion: parsed.data.descripcion ?? null });
    }
  });

  const creados =
    tipo === "rendimientos" ? rendsPlan.filter((r) => !r.update).length : movsPlan.length;
  const actualizados = tipo === "rendimientos" ? rendsPlan.filter((r) => r.update).length : 0;

  const report: ImportReport = {
    tipo,
    total: filas.length,
    creados,
    actualizados,
    omitidos,
    errores,
    dryRun,
  };

  if (dryRun) return ok(report, "Vista previa generada.");

  // Escritura idempotente.
  await withTenant(ADMIN_CTX, async (tx) => {
    for (const r of rendsPlan) {
      await tx
        .insert(rendimientosMensuales)
        .values({
          clienteId: r.clienteId,
          anio: r.anio,
          mes: r.mes,
          modo: r.modo,
          valor: r.valor.toFixed(4),
          descripcion: r.descripcion,
        })
        .onConflictDoUpdate({
          target: [
            rendimientosMensuales.clienteId,
            rendimientosMensuales.anio,
            rendimientosMensuales.mes,
          ],
          set: { modo: r.modo, valor: r.valor.toFixed(4), descripcion: r.descripcion, updatedAt: new Date() },
        });
    }
    for (const mv of movsPlan) {
      await tx.insert(movimientos).values({
        clienteId: mv.clienteId,
        tipo: mv.tipo,
        monto: mv.monto.toFixed(2),
        fecha: mv.fecha,
        descripcion: mv.descripcion,
      });
    }
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: tipo === "rendimientos" ? "rendimiento" : "movimiento",
    despues: { importacion: true, archivo: archivo.name, creados, actualizados, omitidos },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/cliente", "layout");
  return ok(report, "Importación completada.");
}
