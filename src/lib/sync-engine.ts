import {
  obtenerColaSync,
  eliminarDeColaSync,
  marcarSincronizada,
} from "./db-local";

/**
 * Sync Engine: procesa la cola de operaciones pendientes
 * cuando la conexión se restablece.
 */
export async function sincronizarPendientes() {
  const cola = await obtenerColaSync();

  if (cola.length === 0) return { procesadas: 0, errores: 0 };

  let procesadas = 0;
  let errores = 0;

  for (const op of cola) {
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });

      if (!res.ok) {
        const body = await res.json();

        if (res.status === 409) {
          // Conflicto: el slot ya fue reservado online
          console.warn(`[Sync] Conflicto en operación ${op.id}:`, body);
          // TODO: notificar al usuario del conflicto
          await eliminarDeColaSync(op.id!); // Eliminar de la cola, conflicto resuelto manualmente
        } else {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const { serverId, localId } = await res.json();

        if (localId && serverId) {
          await marcarSincronizada(localId, serverId);
        }

        await eliminarDeColaSync(op.id!);
        procesadas++;
      }
    } catch (error) {
      console.error(`[Sync] Error en operación ${op.id}:`, error);
      errores++;

      // Si ya reintentó 3 veces, dejar de intentar
      if (op.retries >= 3) {
        await eliminarDeColaSync(op.id!);
      }
    }
  }

  return { procesadas, errores };
}

/**
 * Inicia el listener de conectividad.
 * Cuando vuelve la conexión, sincroniza automáticamente.
 */
export function iniciarSyncEngine() {
  const sync = async () => {
    if (!navigator.onLine) return;

    const resultado = await sincronizarPendientes();

    if (resultado.procesadas > 0 || resultado.errores > 0) {
      // Disparar evento para que la UI se actualice
      window.dispatchEvent(
        new CustomEvent("sfs:sync-complete", { detail: resultado })
      );
    }
  };

  window.addEventListener("online", sync);

  // También intentar al cargar (por si había conexión pero no se procesó)
  if (navigator.onLine) {
    sync();
  }
}
