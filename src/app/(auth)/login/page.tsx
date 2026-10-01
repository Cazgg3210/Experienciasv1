import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/server/auth/session";
import { homePathForRole } from "@/server/auth/permissions";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo subtitle="Centro de experiencias" />
        </div>
        <div className="bg-card rounded-2xl border p-6 shadow-sm sm:p-8">
          <h1 className="font-heading mb-1 text-2xl font-semibold">Bienvenida de vuelta</h1>
          <p className="text-muted-foreground mb-6 text-sm">Acceso para el equipo de Ivonne &amp; Rosa.</p>
          <LoginForm callbackUrl={callbackUrl} />
        </div>
        <p className="text-muted-foreground mt-6 text-center text-xs">
          ¿Eres clienta? Entra a tu evento desde el enlace que te enviamos o en{" "}
          <Link href="/mi-evento" className="text-foreground underline underline-offset-4">
            Mi evento
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
