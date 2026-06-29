# Bitácora · Portal del fondo Brújula Markets

Portal privado de inversionistas para un fondo pequeño. Cada cliente entra y ve
**solo su cuenta** (saldo, historial mensual, ROI, reportes y PDF). Una cuenta
**maestra (operador/administrador)** carga el resultado de cada cliente, registra
depósitos/retiros, edita/elimina, importa el histórico y consulta reportes
consolidados. De la ganancia de cada mes se aparta automáticamente el **35% para
el operador** (configurable). Todo en **USD**; histórico desde **septiembre 2024**.

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions) + **TypeScript** estricto
- **Tailwind CSS** + componentes estilo **shadcn/ui** + **Framer Motion** + **Recharts**
- **Auth.js (NextAuth v5)** — credenciales (email + contraseña), sin registro público
- **Drizzle ORM** + **PostgreSQL** (Row-Level Security + scoping en cada query)
- **bcryptjs**, **Zod**, **@react-pdf/renderer**, **SheetJS (xlsx)**, **Vitest**
- Despliegue: **DigitalOcean App Platform** + **Managed Postgres**

## Decisiones financieras configurables (panel → Ajustes)

Toda la matemática vive en un solo módulo puro: [`lib/finance/ledger.ts`](lib/finance/ledger.ts),
con pruebas en [`lib/finance/ledger.test.ts`](lib/finance/ledger.test.ts). Los saldos
**no se almacenan**: se derivan al leer (derive-on-read), por eso editar o eliminar
un insumo recalcula automáticamente todos los meses siguientes.

1. **Comisión del operador (`comision_pct`, default 35%)**
   Porcentaje que se aparta de la ganancia. **Solo se cobra sobre meses con
   ganancia** (rendimiento bruto > 0). Configurable de 0 a 100%.

2. **High-water mark (`usa_high_water_mark`, default OFF)**
   Si se activa, solo se cobra comisión sobre lo que **supera el pico histórico**
   de la cuenta: tras una caída no se vuelve a cobrar hasta recuperar y exceder el
   máximo previo. Si está apagado, se cobra sobre toda ganancia mensual.

3. **El cliente asume solo las pérdidas (`pierde_solo_cliente`, default ON)**
   Si está activo, los meses negativos **no generan comisión** (ni la descuentan).
   Si se desactiva, el operador **comparte la pérdida**: se aplica una comisión
   negativa (clawback) que amortigua la pérdida del cliente.

### Modos de carga del resultado mensual

- `porcentaje` — rendimiento bruto del mes en % (admite negativos).
- `monto` — rendimiento bruto del mes en USD (admite negativos).
- `saldo_final` — el operador escribe el **saldo final neto**; ese mes la comisión
  registrada es 0 y el neto se deriva como `saldo_final − base_operativa`.

## Desarrollo local

### Requisitos

- Node 20+ y **pnpm** (`corepack enable`)
- Un PostgreSQL local (o Docker): `docker run --name bitacora-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bitacora -p 5432:5432 -d postgres:16`

### Pasos

```bash
pnpm install

# 1) Variables de entorno
cp .env.example .env.local
#   - DATABASE_URL: tu cadena local (usa sslmode=disable en local)
#   - AUTH_SECRET:  openssl rand -base64 32
#   - ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD

# 2) Migraciones (crea tablas + políticas RLS)
pnpm db:migrate

# 3) Seed (configuración + usuario admin). Con datos demo del caso §5.4:
pnpm db:seed          # solo config + admin
pnpm db:seed:demo     # además crea 1 cliente de ejemplo (saldo esperado $15,599.72)

# 4) Arranca
pnpm dev              # http://localhost:3000
```

Entra con `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`; el primer acceso obliga a
cambiar la contraseña.

### Scripts

| Comando | Acción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build de producción / servirlo |
| `pnpm test` | Pruebas del motor financiero (Vitest) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Genera SQL de migración desde el esquema |
| `pnpm db:migrate` | Aplica migraciones + RLS |
| `pnpm db:seed` / `pnpm db:seed:demo` | Seed (admin / + demo) |
| `pnpm db:studio` | Drizzle Studio |

## Seguridad y aislamiento de datos

- **Sin registro público.** El admin crea las cuentas y puede resetear contraseñas.
- **Doble barrera de aislamiento:** (a) RLS en Postgres con variable de sesión por
  request (`withTenant`, ver [`lib/db/rls.ts`](lib/db/rls.ts)) con `FORCE ROW LEVEL
  SECURITY` (falla cerrado), y (b) scoping explícito por `cliente_id` en cada query
  y Server Action. Un cliente nunca puede ver ni enumerar datos de otro.
- Contraseñas con hash bcrypt; nunca en texto plano ni en logs ni en auditoría.
- Toda mutación (crear/editar/eliminar) queda en la tabla `auditoria`.

## Estructura

```
app/(auth)        login, cambiar-password
app/(cliente)     resumen, historial, reportes, cuenta
app/(admin)       dashboard, clientes, cierre, movimientos, reportes, importar, ajustes, auditoria
app/actions       Server Actions (Zod + auditoría + scoping)
app/api           auth, reporte-pdf, export, plantilla
lib/finance       ledger.ts (motor puro) + tests
lib/db            conexión SSL + withTenant + RLS
lib/auth          Auth.js (config edge-safe + node), sesión, password
lib/pdf · lib/xlsx  estados de cuenta PDF, export/import Excel-CSV
drizzle           schema.ts + migraciones
```

Para desplegar en DigitalOcean, ver **[DEPLOY.md](DEPLOY.md)**.
