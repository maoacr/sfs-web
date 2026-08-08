import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sileo";
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
  icons: { icon: "/favicon.svg" },
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
      <body className="min-h-screen flex flex-col bg-bg text-text" suppressHydrationWarning>
        <Toaster
          position="top-right"
          options={{
            fill: "#141414",
            roundness: 16,
            styles: {
              title: "text-text! text-sm!",
              description: "text-text-muted! text-xs!",
              badge: "bg-grass/20!",
              button: "bg-grass/15! hover:bg-grass/25! text-grass-light! text-xs!",
            },
          }}
        />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
