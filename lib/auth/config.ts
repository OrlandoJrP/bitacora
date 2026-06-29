import type { NextAuthConfig } from "next-auth";

/**
 * Configuración edge-safe de Auth.js (sin db ni bcrypt). La consume el
 * middleware para leer la sesión JWT y proteger rutas. El proveedor Credentials
 * (con acceso a BD) se añade aparte en lib/auth/index.ts (runtime Node).
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 horas
  pages: { signIn: "/login" },
  providers: [], // se completan en lib/auth/index.ts
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id?: string;
          role: "admin" | "cliente";
          clienteId: string | null;
          mustChangePassword: boolean;
        };
        token.uid = u.id ?? token.uid;
        token.role = u.role;
        token.clienteId = u.clienteId;
        token.mustChangePassword = u.mustChangePassword;
      }
      // Tras cambiar la contraseña, la sesión se actualiza vía update().
      if (trigger === "update" && (session as { mustChangePassword?: boolean })?.mustChangePassword === false) {
        token.mustChangePassword = false;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as {
        uid?: string;
        role: "admin" | "cliente";
        clienteId: string | null;
        mustChangePassword: boolean;
      };
      if (session.user) {
        session.user.id = t.uid ?? session.user.id;
        session.user.role = t.role;
        session.user.clienteId = t.clienteId;
        session.user.mustChangePassword = t.mustChangePassword;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
