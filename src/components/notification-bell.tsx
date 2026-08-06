"use client";

import { useEffect, useState } from "react";

interface Notif {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

const ICONOS: Record<string, string> = {
  RESERVA_CREADA: "📅",
  RESERVA_CONFIRMADA: "✅",
  RESERVA_CANCELADA: "❌",
  RESERVA_COMPLETADA: "🏆",
  RESERVA_EXPIRADA: "⏰",
};

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCount() {
    try {
      const res = await fetch("/api/notificaciones?noLeidas=true");
      const data = await res.json();
      setCount(data.count || 0);
    } catch {}
  }

  async function loadNotifs() {
    try {
      const res = await fetch("/api/notificaciones");
      const data = await res.json();
      setNotifs(data);
    } catch {}
  }

  async function marcarLeida(id: string) {
    await fetch("/api/notificaciones", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCount(c => Math.max(0, c - 1));
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }

  async function marcarTodas() {
    await fetch("/api/notificaciones", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todas: true }),
    });
    setCount(0);
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
  }

  function fRel(fecha: string) {
    const diff = Date.now() - new Date(fecha).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  }

  function handleOpen() {
    setOpen(true);
    loadNotifs();
  }

  return (
    <>
      {/* Bell button */}
      <button onClick={handleOpen}
        className="relative flex items-center justify-center h-9 w-9 rounded-xl border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors">
        <span className="text-base">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-4.5 min-w-[18px] flex items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm border-l border-border bg-surface shadow-2xl flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-bold text-text">Notificaciones</h2>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button onClick={marcarTodas} className="text-xs text-grass hover:text-grass-light transition-colors">
                    Marcar todas leídas
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="flex items-center justify-center h-7 w-7 rounded-lg border border-border text-text-muted hover:text-text text-sm">
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-3xl mb-3">🔔</p>
                  <p className="text-sm text-text-muted">No tenés notificaciones</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifs.map(n => (
                    <button key={n.id} onClick={() => marcarLeida(n.id)}
                      className={`w-full text-left px-5 py-4 transition-colors hover:bg-surface-hover ${
                        !n.leida ? "bg-field/5" : ""
                      }`}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 flex-shrink-0">{ICONOS[n.tipo] || "📌"}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.leida ? "font-semibold text-text" : "text-text-muted"}`}>{n.titulo}</p>
                          <p className="text-xs text-text-dim mt-0.5 line-clamp-2">{n.mensaje}</p>
                          <p className="text-[10px] text-text-dim mt-1.5">{fRel(n.createdAt)}</p>
                        </div>
                        {!n.leida && <span className="h-2 w-2 rounded-full bg-grass-light flex-shrink-0 mt-1" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
