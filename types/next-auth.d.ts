import type { DefaultSession } from "next-auth";

type Rol = "admin" | "cliente";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Rol;
      clienteId: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Rol;
    clienteId: string | null;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Rol;
    clienteId: string | null;
    mustChangePassword: boolean;
  }
}
