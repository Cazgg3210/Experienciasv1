"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/db";
import { homePathForRole, type AppRole } from "@/server/auth/permissions";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
  callbackUrl: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

function safeCallback(url: string | undefined): string | null {
  if (!url) return null;
  // Sólo rutas internas (evita open redirect)
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return null;
  return url;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true },
  });
  const home = homePathForRole((user?.role ?? "STAFF") as AppRole);
  const requested = safeCallback(parsed.data.callbackUrl);
  // STAFF no puede ir a /admin aunque lo pida
  const redirectTo = requested && !(user?.role === "STAFF" && requested.startsWith("/admin")) ? requested : home;

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      if (code === "demasiados_intentos") {
        return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
      }
      return { error: "Correo o contraseña incorrectos." };
    }
    throw error; // NEXT_REDIRECT
  }
  return undefined;
}
