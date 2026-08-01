import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Distribución · Panel de ventas e inventario",
    template: "%s · Distribución",
  },
  description:
    "Sistema de gestión para distribuidores: compras, asignaciones a vendedores, cortes de venta, cobros e inventario en almacén y en manos.",
  metadataBase: new URL("https://reportes-ventas.pages.dev"),
  openGraph: {
    title: "Distribución · Panel de ventas e inventario",
    description: "Compras, asignaciones, cortes de venta y cobros para distribuidores.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("rv:theme")||"dark";document.documentElement.classList.toggle("dark",t==="dark");}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // THEME_SCRIPT cambia la clase de <html> antes de hidratar para que no haya
  // parpadeo de tema: esa diferencia es intencional y no debe avisar.
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático propio, sin datos del usuario */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <div className="ambient" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
