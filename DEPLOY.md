# Despliegue en DigitalOcean

Guía paso a paso para publicar **Bitácora** en **DigitalOcean App Platform** con
**Managed Postgres**. Dos rutas: (A) buildpack con `app.yaml` (recomendada, el job
de migración/seed queda automatizado) y (B) Docker.

---

## Antes de empezar

1. Sube el proyecto a un repositorio de **GitHub** (sin `.env`).
2. Genera el secreto de sesión:
   ```bash
   openssl rand -base64 32
   ```
3. Ten a mano el correo y la contraseña inicial del admin/operador.

---

## Ruta A — `app.yaml` (recomendada)

### 1. Edita `app.yaml`
- Cambia `TU_USUARIO/TU_REPO` por tu repo de GitHub (en `services` y en `jobs`).
- Pon `AUTH_SECRET` (el valor generado) y `ADMIN_INITIAL_PASSWORD`.
- Ajusta el dominio si no usas `bitacora.brujulamarkets.com`.

### 2. Crea la app
Con la CLI de DigitalOcean (`doctl`):
```bash
doctl apps create --spec app.yaml
```
O en el panel: **Apps → Create App → Edit App Spec** y pega el contenido de `app.yaml`.

App Platform hará automáticamente:
- Crear la **Managed Postgres** (`db`) e inyectar `${db.DATABASE_URL}` con `sslmode=require`.
- Ejecutar el **job PRE_DEPLOY** `pnpm db:migrate && pnpm db:seed` (crea tablas, RLS,
  configuración y el usuario admin). El seed es **idempotente**.
- Construir (`pnpm build`) y arrancar (`pnpm start`) el servicio web.

### 3. Dominio y HTTPS
- En **Settings → Domains** verifica `bitacora.brujulamarkets.com`.
- En tu DNS, crea el registro **CNAME** que indique App Platform (el panel te da el
  destino). App Platform emite el certificado TLS automáticamente.
- Confirma que `AUTH_URL` y `NEXTAUTH_URL` apunten a ese dominio (https, sin slash final).

### 4. Primer acceso
- Entra a `https://bitacora.brujulamarkets.com/login` con `ADMIN_EMAIL` /
  `ADMIN_INITIAL_PASSWORD`. El sistema **obliga a cambiar la contraseña** en el primer login.

---

## Ruta B — Docker

El `Dockerfile` produce una imagen **standalone** para el servicio web.

1. En **Create App**, elige el repo y selecciona **Dockerfile** como método de build.
2. Crea/adjunta una **Managed Postgres** y mapea su variable a `DATABASE_URL`
   (scope build + run).
3. Añade las variables `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST=true`.
4. **Migraciones + seed** (no van dentro de la imagen web). Ejecútalas una vez como
   job o desde tu máquina apuntando a la base gestionada:
   ```bash
   DATABASE_URL="postgresql://...?sslmode=require" \
   ADMIN_EMAIL="admin@brujulamarkets.com" \
   ADMIN_INITIAL_PASSWORD="..." \
   pnpm db:migrate && pnpm db:seed
   ```
   (o el ejemplo `docker run ... pnpm db:migrate && pnpm db:seed` que aparece al
   final del `Dockerfile`).

---

## Variables de entorno (resumen)

| Variable | Dónde | Notas |
|---|---|---|
| `DATABASE_URL` | web + job | `${db.DATABASE_URL}` (con `sslmode=require`) |
| `AUTH_SECRET` | web | `openssl rand -base64 32` (secreto) |
| `AUTH_URL` / `NEXTAUTH_URL` | web | `https://bitacora.brujulamarkets.com` |
| `AUTH_TRUST_HOST` | web | `true` (detrás del proxy de App Platform) |
| `ADMIN_EMAIL` | job (seed) | cuenta maestra inicial |
| `ADMIN_INITIAL_PASSWORD` | job (seed) | secreto; se cambia en el primer login |
| `DATABASE_CA_CERT` | opcional | certificado CA para verificación SSL estricta |

---

## Después del despliegue

1. **Cambia la contraseña del admin** (forzado en el primer acceso).
2. **Crea los 5 clientes** en *Clientes* (cada uno recibe una contraseña temporal
   que se muestra una sola vez; cópiala y compártela de forma segura).
3. **Importa el histórico** desde *Importar* (descarga la plantilla `.xlsx`,
   complétala desde septiembre 2024, súbela, **previsualiza** y confirma). La
   importación es idempotente: re-subir el mismo mes lo actualiza, no lo duplica.
4. Revisa *Ajustes* (comisión %, high-water mark, pérdidas solo del cliente).

---

## Operación

- **Migraciones nuevas:** `pnpm db:generate` en local (genera SQL en `drizzle/migrations`),
  commitea, y el job PRE_DEPLOY las aplica en el siguiente deploy.

- **⚠ BORRAR UNA COLUMNA VA EN DOS DEPLOYS.** El job PRE_DEPLOY corre mientras los
  contenedores VIEJOS siguen atendiendo tráfico. Un `ADD COLUMN` no molesta a nadie,
  pero un `DROP COLUMN` deja al código viejo consultando algo que ya no existe y la
  app devuelve 500 hasta que entra el deploy nuevo (Drizzle enumera las columnas en
  cada `select()`, así que revienta toda página que lea esa tabla). El orden correcto:
    1. Deploy A: código que YA NO usa la columna (la columna sigue en la base).
    2. Verificar que el deploy A está arriba.
    3. Deploy B (o un script one-off): recién ahí el `DROP COLUMN`.
  Pasó el 08-ago-2026 con `clientes.comision_informativa`; se recuperó con
  `scripts/recuperar-comision-informativa.ts`. Lo mismo aplica a renombrar columnas
  y a estrechar tipos.
- **Backups:** activa los backups automáticos de la Managed Postgres en su panel.
- **RLS:** las políticas se re-aplican (idempotentes) en cada `pnpm db:migrate`.
- **Logs:** App Platform → Runtime Logs. Las contraseñas nunca se registran.

---

## Solución de problemas

- **El job de migración falla por SSL:** confirma que `DATABASE_URL` incluye
  `?sslmode=require`. Para verificación estricta de CA, define `DATABASE_CA_CERT`.
- **Bucle de login / sesión inválida:** revisa `AUTH_SECRET`, `AUTH_URL` y
  `AUTH_TRUST_HOST=true`, y que `AUTH_URL` coincida exactamente con el dominio.
- **El cliente no ve datos:** es el comportamiento *fail-closed* de RLS si falta el
  contexto de sesión; verifica que el usuario tenga `cliente_id` asignado.
