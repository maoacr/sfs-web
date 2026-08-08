"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface TabItem {
  label: string;
  href: string;
  icon: string;
}

interface OverflowItem {
  label: string;
  href: string;
  icon: string;
}

export function BottomTabBar({ tabs, overflow, role }: {
  tabs: TabItem[];
  overflow?: OverflowItem[];
  role: "OWNER" | "PLAYER";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [masOpen, setMasOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  // Responsive: solo visible en mobile (< md)
  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {tabs.map(tab => (
            <Link key={tab.href} href={tab.href}
              onClick={() => setMasOpen(false)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 transition-colors ${
                isActive(tab.href) ? "text-grass-light" : "text-text-dim"
              }`}>
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium leading-tight truncate max-w-[64px] text-center">{tab.label}</span>
              {isActive(tab.href) && <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-grass-light" />}
            </Link>
          ))}

          {/* "Más" overflow tab */}
          {overflow && overflow.length > 0 && (
            <button onClick={() => setMasOpen(!masOpen)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 transition-colors ${
                overflow.some(o => isActive(o.href)) ? "text-grass-light" : masOpen ? "text-text" : "text-text-dim"
              }`}>
              <span className="text-xl leading-none">{masOpen ? "✕" : "···"}</span>
              <span className="text-[10px] font-medium leading-tight">Más</span>
              {overflow.some(o => isActive(o.href)) && <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-grass-light" />}
            </button>
          )}
        </div>
      </nav>

      {/* "Más" overflow sheet */}
      {masOpen && overflow && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMasOpen(false)}>
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sheet sliding up */}
          <div onClick={e => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl border border-border bg-surface shadow-2xl animate-slide-up pb-safe">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="px-4 pb-6">
              <p className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-3 px-1">Más opciones</p>
              <div className="space-y-1">
                {/* Perfil siempre en overflow */}
                <button onClick={() => { router.push(`/${role.toLowerCase()}/perfil`); setMasOpen(false); }}
                  className={`w-full flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(`/${role.toLowerCase()}/perfil`) ? "bg-field/40 text-grass-light" : "text-text-muted hover:bg-surface-hover hover:text-text"
                  }`}>
                  <span className="text-lg">👤</span> Mi perfil
                </button>

                {overflow.filter(o => !o.href.includes("/perfil")).map(item => (
                  <button key={item.href} onClick={() => { router.push(item.href); setMasOpen(false); }}
                    className={`w-full flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive(item.href) ? "bg-field/40 text-grass-light" : "text-text-muted hover:bg-surface-hover hover:text-text"
                    }`}>
                    <span className="text-lg">{item.icon}</span> {item.label}
                  </button>
                ))}

                {/* Logout */}
                <button onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/auth/login";
                }}
                  className="w-full flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-error hover:bg-error-bg transition-colors">
                  <span className="text-lg">🚪</span> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for bottom bar on mobile */}
      <div className="md:hidden h-16" />
    </>
  );
}
