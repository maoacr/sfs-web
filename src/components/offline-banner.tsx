"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { iniciarSyncEngine } from "@/lib/sync-engine";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const isOnline = useOnlineStatus();
  const [syncResult, setSyncResult] = useState<{ procesadas: number; errores: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    iniciarSyncEngine();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSyncResult(detail);
      setTimeout(() => setSyncResult(null), 5000);
    };
    window.addEventListener("sfs:sync-complete", handler);
    return () => window.removeEventListener("sfs:sync-complete", handler);
  }, []);

  if (!mounted) return null;
  if (isOnline && !syncResult) return null;

  return (
    <>
      {!isOnline && (
        <div className="sticky top-0 z-50 bg-warning-bg border-b border-warning/20 px-4 py-2 text-center text-sm font-medium text-warning">
          ⚠️ Sin conexión — los cambios se sincronizarán al reconectar
        </div>
      )}
      {syncResult && (
        <div className="sticky top-0 z-50 bg-success-bg border-b border-success/20 px-4 py-2 text-center text-sm font-medium text-success">
          ✅ {syncResult.procesadas} reservas sincronizadas
          {syncResult.errores > 0 && `, ${syncResult.errores} conflictos`}
        </div>
      )}
    </>
  );
}
