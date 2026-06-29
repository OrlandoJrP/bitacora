import postgres from "postgres";

/** Crea un cliente postgres para scripts one-off (migrate/seed), con SSL si la
 *  URL lo requiere. max:1 ⇒ una sola conexión, las variables de sesión persisten. */
export function connectForScript() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está definida. Configúrala en .env.local (local) o en el entorno de DigitalOcean.",
    );
  }
  const sslRequired = url.includes("sslmode=require") || url.includes("sslmode=verify");
  const ssl = sslRequired
    ? process.env.DATABASE_CA_CERT
      ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true }
      : { rejectUnauthorized: false as const }
    : false;

  return postgres(url, { max: 1, ssl, onnotice: () => {} });
}
