import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** Hashea una contraseña en texto plano. NUNCA se almacena la contraseña sin hash. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Verifica una contraseña contra su hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Genera una contraseña temporal legible (para el primer acceso del cliente). */
export function generarPasswordTemporal(): string {
  const adjetivos = ["Norte", "Sur", "Astro", "Brujula", "Faro", "Polar", "Ancla", "Vela"];
  const a = adjetivos[Math.floor(Math.random() * adjetivos.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  const sym = "!@#$%&".charAt(Math.floor(Math.random() * 6));
  return `${a}${n}${sym}`;
}

/** Reglas mínimas de contraseña (compartidas por seed, alta y cambio). */
export function validarFortalezaPassword(pw: string): string | null {
  if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(pw)) return "La contraseña debe incluir al menos una letra.";
  if (!/[0-9]/.test(pw)) return "La contraseña debe incluir al menos un número.";
  return null;
}
