"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAddress } from "@/lib/address";

interface Complejo { id: string; nombre: string; direccion: string; telefono: string | null; email: string | null; _count: { canchas: number }; }

export default function OwnerComplejos() {
  const [complejos, setComplejos] = useState<Complejo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/complejos").then(r => r.json()).then(setComplejos).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Complejos</h1>
          <p className="text-sm text-text-muted mt-1">Tus espacios deportivos</p>
        </div>
        <Link href="/owner/complejos/nuevo"
          className="rounded-xl bg-grass px-5 py-2.5 text-sm font-semibold text-white hover:bg-grass-light transition-colors">+ Nuevo</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {loading ? (
          [1,2].map(i => <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface" />)
        ) : complejos.length === 0 ? (
          <div className="sm:col-span-2 rounded-2xl border border-dashed border-border bg-surface p-14 text-center">
            <p className="text-text-muted text-base">No tenés complejos todavía.</p>
            <Link href="/owner/complejos/nuevo" className="mt-4 inline-block text-sm font-medium text-grass">Creá tu primer complejo →</Link>
          </div>
        ) : (
          complejos.map(c => (
            <Link key={c.id} href={`/owner/complejos/${c.id}`}
              className="rounded-2xl border border-border bg-surface p-6 hover:border-border-hover hover:shadow-sm transition-all duration-150 block group">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text text-base group-hover:text-grass-light transition-colors">{c.nombre}</h3>
                  <p className="text-sm text-text-muted mt-1">{formatAddress(c)}</p>
                </div>
                <span className="text-text-dim opacity-0 group-hover:opacity-100 transition-opacity text-sm">Editar →</span>
              </div>
              {c.telefono && <p className="text-xs text-text-dim mt-2">📞 {c.telefono}</p>}
              {c.email && <p className="text-xs text-text-dim">{c.email}</p>}
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-field/40 px-3 py-1 text-xs font-medium text-grass-light">
                <span className="h-1.5 w-1.5 rounded-full bg-grass-light" />
                {c._count.canchas} cancha{c._count.canchas !== 1 ? "s" : ""}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
