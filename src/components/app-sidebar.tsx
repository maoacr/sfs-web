"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";

interface NavItem { label: string; href: string; icon: string }

export function AppSidebar({ role, nav }: { role: "OWNER" | "PLAYER"; nav: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Sidebar: visible desde tablet (md) */}
      <div className="hidden md:block fixed top-0 left-0 h-full z-30">
        <aside className="flex flex-col h-full w-60 xl:w-64 border-r border-border bg-surface/80 backdrop-blur-sm">
          {/* Logo + brand */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-border/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-field to-grass shadow-sm">
              <span className="text-lg">⚽</span>
            </div>
            <div>
              <span className="text-base font-bold text-text tracking-tight">SFS</span>
              <span className="block text-[11px] text-text-dim leading-tight">Sistema de Fútbol</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
              {role === "OWNER" ? "Administración" : "Menú"}
            </p>
            {nav.map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive(item.href)
                    ? "bg-field/80 text-grass-light shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.label}</span>
                {isActive(item.href) && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-grass-light" />
                )}
            </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-border/50 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <Link href={role === "OWNER" ? "/owner/perfil" : "/player/perfil"}
                className="flex items-center gap-3 px-1 py-1.5 rounded-lg hover:bg-surface-hover transition-colors">
                <div className="h-8 w-8 rounded-full bg-field flex items-center justify-center text-xs font-bold text-grass-light">
                  {role === "OWNER" ? "D" : "J"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">Mi cuenta</p>
                  <p className="text-[11px] text-text-dim">{role === "OWNER" ? "Dueño" : "Jugador"}</p>
                </div>
              </Link>
              <NotificationBell />
            </div>
            <form action="/api/auth/logout" method="POST">
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-dim hover:text-error hover:bg-error-bg/50 transition-colors">
                <span className="text-sm">🚪</span> Cerrar sesión
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* Spacer for fixed sidebar */}
      <div className="hidden md:block w-60 xl:w-64 shrink-0" />
    </>
  );
}
