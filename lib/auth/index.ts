import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authConfig } from "./config";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { verifyPassword } from "./password";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();

        const [u] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!u) return null;

        const ok = await verifyPassword(parsed.data.password, u.passwordHash);
        if (!ok) return null;

        return {
          id: u.id,
          email: u.email,
          role: u.role,
          clienteId: u.clienteId ?? null,
          mustChangePassword: u.mustChangePassword,
        };
      },
    }),
  ],
});
