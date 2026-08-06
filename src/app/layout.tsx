import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaRegister } from "@/components/pwa-register";
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
    default: "SFS — Gestión de Canchas",
    template: "%s | SFS",
  },
  description:
    "Plataforma SaaS para dueños de canchas de fútbol y jugadores. Reservá, gestioná y pagá en un solo lugar.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SFS" },
};

export const viewport: Viewport = {
  themeColor: "#0a5c2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <head>
        <PwaRegister />
      </head>
      <body className="min-h-screen flex flex-col bg-bg text-text">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
