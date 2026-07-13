import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ──────────────────────────────────────────────────────────────────────────
 * Enums
 * ────────────────────────────────────────────────────────────────────────── */
export const roleEnum = pgEnum("role", ["admin", "cliente"]);
export const estadoClienteEnum = pgEnum("estado_cliente", ["activo", "inactivo"]);
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", ["deposito", "retiro"]);
export const modoRendimientoEnum = pgEnum("modo_rendimiento", [
  "porcentaje",
  "monto",
  "saldo_final",
]);

/* ──────────────────────────────────────────────────────────────────────────
 * clientes — un inversionista del fondo.
 * fecha_ingreso define el primer mes del historial; capital_inicial el aporte.
 * Dinero SIEMPRE en numeric(14,2) (string en JS) — nunca float.
 * ────────────────────────────────────────────────────────────────────────── */
export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull(),
  fechaIngreso: date("fecha_ingreso").notNull(),
  capitalInicial: numeric("capital_inicial", { precision: 14, scale: 2 }).notNull(),
  estado: estadoClienteEnum("estado").notNull().default("activo"),
  /** true = cliente "cascarón" creado SOLO como acceso de un socio del fondo
   *  compartido. Se excluye de todas las vistas/acciones de la modalidad
   *  individual (dashboard, clientes, reportes, movimientos, cierre). */
  esAccesoFondo: boolean("es_acceso_fondo").notNull().default(false),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────────────────────────────────────────────────
 * users — credenciales de acceso. Un admin (operador) y N clientes.
 * cliente_id es obligatorio (a nivel app) cuando role = 'cliente'.
 * ────────────────────────────────────────────────────────────────────────── */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────────────────────────────────────────────────
 * movimientos — depósitos y retiros de CAPITAL (no rendimiento).
 * monto siempre > 0; el signo lo da el `tipo`.
 * ────────────────────────────────────────────────────────────────────────── */
export const movimientos = pgTable(
  "movimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    fecha: date("fecha").notNull(),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movimientos_cliente_idx").on(t.clienteId),
    index("movimientos_cliente_fecha_idx").on(t.clienteId, t.fecha),
    check("movimientos_monto_positivo", sql`${t.monto} > 0`),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * rendimientos_mensuales — el resultado del fondo por cliente y mes.
 * Guarda SOLO los insumos (modo + valor). Los saldos se DERIVAN al leer
 * (derive-on-read), nunca se almacenan. Único por (cliente, año, mes).
 * ────────────────────────────────────────────────────────────────────────── */
export const rendimientosMensuales = pgTable(
  "rendimientos_mensuales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    modo: modoRendimientoEnum("modo").notNull(),
    valor: numeric("valor", { precision: 16, scale: 4 }).notNull(),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rendimientos_cliente_anio_mes_uniq").on(t.clienteId, t.anio, t.mes),
    check("rendimientos_mes_valido", sql`${t.mes} between 1 and 12`),
    check("rendimientos_anio_valido", sql`${t.anio} between 2000 and 2200`),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * configuracion — fila única (singleton, id=1).
 * Las 3 decisiones configurables del fondo viven aquí.
 * ────────────────────────────────────────────────────────────────────────── */
export const configuracion = pgTable(
  "configuracion",
  {
    id: integer("id").primaryKey().default(1),
    comisionPct: numeric("comision_pct", { precision: 6, scale: 3 })
      .notNull()
      .default("35.000"),
    usaHighWaterMark: boolean("usa_high_water_mark").notNull().default(false),
    pierdeSoloCliente: boolean("pierde_solo_cliente").notNull().default(true),
    nombreFondo: text("nombre_fondo").notNull().default("Brújula Markets"),
    moneda: text("moneda").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("configuracion_singleton", sql`${t.id} = 1`)],
);

/* ──────────────────────────────────────────────────────────────────────────
 * auditoria — bitácora de cambios. entidad_id es text para admitir tanto los
 * uuid de las entidades como el id entero (1) de configuracion.
 * ────────────────────────────────────────────────────────────────────────── */
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    accion: text("accion").notNull(), // crear | editar | eliminar
    entidad: text("entidad").notNull(), // cliente | movimiento | rendimiento | configuracion | usuario
    entidadId: text("entidad_id"),
    datosAntes: jsonb("datos_antes"),
    datosDespues: jsonb("datos_despues"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auditoria_created_idx").on(t.createdAt),
    index("auditoria_entidad_idx").on(t.entidad, t.entidadId),
  ],
);

/* ══════════════════════════════════════════════════════════════════════════
 * MODALIDAD FONDO COMPARTIDO (cuenta conjunta) — tablas ADITIVAS.
 * No tocan la modalidad individual. Derive-on-read: solo insumos, cero saldos.
 * ══════════════════════════════════════════════════════════════════════════ */

export const baseComisionFondoEnum = pgEnum("base_comision_fondo", [
  "ganancia_neta",
  "meses_positivos",
]);

/* fondos — la cuenta compartida. capital_inicial = capital del fondo al
 * arrancar (la "semilla", antes de los aportes del primer mes). La comisión es
 * INFORMATIVA: nunca se descuenta de los saldos de los socios. */
export const fondos = pgTable("fondos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  fechaInicio: date("fecha_inicio").notNull(),
  capitalInicial: numeric("capital_inicial", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  comisionPct: numeric("comision_pct", { precision: 6, scale: 3 })
    .notNull()
    .default("35.000"),
  baseComision: baseComisionFondoEnum("base_comision").notNull().default("ganancia_neta"),
  moneda: text("moneda").notNull().default("USD"),
  estado: estadoClienteEnum("estado").notNull().default("activo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* fondo_socios — participación en un fondo. cliente_id NULLABLE: un socio sin
 * login (p. ej. retirado) no necesita fila en clientes; `nombre` es propio.
 * capital_inicial = su parte de la semilla (Σ socios = fondo.capital_inicial). */
export const fondoSocios = pgTable(
  "fondo_socios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fondoId: uuid("fondo_id")
      .notNull()
      .references(() => fondos.id, { onDelete: "cascade" }),
    clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "restrict" }),
    nombre: text("nombre").notNull(),
    capitalInicial: numeric("capital_inicial", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    fechaAlta: date("fecha_alta").notNull(),
    estado: estadoClienteEnum("estado").notNull().default("activo"),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // MVP: un cliente pertenece a lo sumo a UN fondo (y una sola vez).
    uniqueIndex("fondo_socios_cliente_uniq")
      .on(t.clienteId)
      .where(sql`${t.clienteId} is not null`),
    index("fondo_socios_fondo_idx").on(t.fondoId),
  ],
);

/* fondo_movimientos — aportes ("deposito") y retiros POR SOCIO. fondo_id va
 * denormalizado para políticas RLS planas. transferencia_id agrupa las dos
 * patas de una transferencia entre socios (pueden caer en meses distintos). */
export const fondoMovimientos = pgTable(
  "fondo_movimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fondoId: uuid("fondo_id")
      .notNull()
      .references(() => fondos.id, { onDelete: "cascade" }),
    socioId: uuid("socio_id")
      .notNull()
      .references(() => fondoSocios.id, { onDelete: "cascade" }),
    tipo: tipoMovimientoEnum("tipo").notNull(), // deposito = aporte | retiro
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    fecha: date("fecha").notNull(),
    transferenciaId: uuid("transferencia_id"),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("fondo_mov_fondo_fecha_idx").on(t.fondoId, t.fecha),
    index("fondo_mov_socio_fecha_idx").on(t.socioId, t.fecha),
    index("fondo_mov_transferencia_idx").on(t.transferenciaId),
    check("fondo_mov_monto_positivo", sql`${t.monto} > 0`),
  ],
);

/* fondo_rendimientos — resultado mensual A NIVEL FONDO.
 * en_curso=true = mes "flotante" (provisional, editable; máx. 1 por fondo).
 * tasa_twr: tasa mensual para la composición TWR cuando difiere de
 * resultado/base (caso real: exposición parcial de un depósito de fin de mes);
 * NULL = derivarla de resultado/base. El dinero SIEMPRE usa el resultado. */
export const fondoRendimientos = pgTable(
  "fondo_rendimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fondoId: uuid("fondo_id")
      .notNull()
      .references(() => fondos.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    modo: modoRendimientoEnum("modo").notNull(), // porcentaje | monto | saldo_final (del FONDO)
    valor: numeric("valor", { precision: 16, scale: 4 }).notNull(),
    enCurso: boolean("en_curso").notNull().default(false),
    tasaTwr: numeric("tasa_twr", { precision: 16, scale: 4 }),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("fondo_rend_fondo_anio_mes_uniq").on(t.fondoId, t.anio, t.mes),
    uniqueIndex("fondo_rend_en_curso_uniq").on(t.fondoId).where(sql`${t.enCurso}`),
    check("fondo_rend_mes_valido", sql`${t.mes} between 1 and 12`),
    check("fondo_rend_anio_valido", sql`${t.anio} between 2000 and 2200`),
  ],
);

/* fondo_overrides — saldo final FIJADO de un socio en un mes (fidelidad
 * histórica: % negociados, exposición parcial). Si existe, sustituye al
 * reparto proporcional para ese socio en ese mes. */
export const fondoOverrides = pgTable(
  "fondo_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fondoId: uuid("fondo_id")
      .notNull()
      .references(() => fondos.id, { onDelete: "cascade" }),
    socioId: uuid("socio_id")
      .notNull()
      .references(() => fondoSocios.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    saldoFinal: numeric("saldo_final", { precision: 14, scale: 2 }).notNull(),
    motivo: text("motivo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("fondo_override_socio_anio_mes_uniq").on(t.socioId, t.anio, t.mes),
    index("fondo_override_fondo_periodo_idx").on(t.fondoId, t.anio, t.mes),
    check("fondo_override_mes_valido", sql`${t.mes} between 1 and 12`),
    check("fondo_override_saldo_no_negativo", sql`${t.saldoFinal} >= 0`),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * Tipos inferidos
 * ────────────────────────────────────────────────────────────────────────── */
export type Cliente = typeof clientes.$inferSelect;
export type NuevoCliente = typeof clientes.$inferInsert;
export type Usuario = typeof users.$inferSelect;
export type NuevoUsuario = typeof users.$inferInsert;
export type Movimiento = typeof movimientos.$inferSelect;
export type NuevoMovimiento = typeof movimientos.$inferInsert;
export type RendimientoMensual = typeof rendimientosMensuales.$inferSelect;
export type NuevoRendimientoMensual = typeof rendimientosMensuales.$inferInsert;
export type Configuracion = typeof configuracion.$inferSelect;
export type RegistroAuditoria = typeof auditoria.$inferSelect;
export type Fondo = typeof fondos.$inferSelect;
export type FondoSocio = typeof fondoSocios.$inferSelect;
export type FondoMovimiento = typeof fondoMovimientos.$inferSelect;
export type FondoRendimiento = typeof fondoRendimientos.$inferSelect;
export type FondoOverride = typeof fondoOverrides.$inferSelect;
