import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Ivonne & Rosa — Experiencias íntimas en CDMX",
    template: "%s · Ivonne & Rosa",
  },
  description:
    "Brunches y experiencias íntimas para 6–12 personas en CDMX. Tú reúne a las tuyas; nosotras hacemos el resto.",
  applicationName: "Ivonne & Rosa",
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Ivonne & Rosa",
    images: [{ url: "/images/og.png", width: 1200, height: 630, alt: "Ivonne & Rosa" }],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#f7f3ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster
          position="top-center"
          richColors
          closeButton
          containerAriaLabel="Notificaciones"
          toastOptions={{ closeButtonAriaLabel: "Cerrar aviso" }}
        />
      </body>
    </html>
  );
}
