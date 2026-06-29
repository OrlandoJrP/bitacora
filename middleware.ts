import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const path = nextUrl.pathname;

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthApi = path.startsWith("/api/auth");
  const isChangePw = path === "/cambiar-password";

  // Rutas de API de Auth siempre permitidas.
  if (isAuthApi) return NextResponse.next();

  // Sin sesión → solo páginas públicas.
  if (!session?.user) {
    if (isPublic) return NextResponse.next();
    const url = new URL("/login", nextUrl);
    if (path !== "/") url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  const { role, mustChangePassword } = session.user;
  const home = role === "admin" ? "/admin" : "/cliente";

  // Primer acceso: forzar cambio de contraseña.
  if (mustChangePassword && !isChangePw) {
    return NextResponse.redirect(new URL("/cambiar-password", nextUrl));
  }
  if (!mustChangePassword && isChangePw) {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  // Con sesión en /login o raíz → enviar al panel correspondiente.
  if (isPublic || path === "/") {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  // Aislamiento de áreas por rol.
  if (path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/cliente", nextUrl));
  }
  if (path.startsWith("/cliente") && role !== "cliente") {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Ejecuta el middleware en todo excepto assets estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
