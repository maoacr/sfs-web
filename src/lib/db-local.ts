import Dexie, { type EntityTable } from "dexie";

// ─── Modelos locales (espejo de tablas del servidor) ─────────────────────────

interface ReservaLocal {
  id?: string; // UUID (puede ser local hasta sincronizar)
  serverId?: string; // ID asignado por el servidor después de sync
  canchaId: string;
  playerId: string;
  playerNombre: string;
  slotInicio: Date;
  slotFin: Date;
  montoTotal: number;
  estado: "PENDIENTE_PAGO" | "CONFIRMADA" | "COMPLETADA" | "CANCELADA";
  sincronizada: boolean; // false = pendiente de sync
  creadaEn: Date; // timestamp local
  tenantId?: string; // ID del dueño (local)
}

interface SyncOperation {
  id?: number;
  type: "CREATE" | "UPDATE" | "DELETE";
  entity: "reserva";
  data: Record<string, unknown>;
  createdAt: Date;
  retries: number;
  lastError?: string;
}

// ─── Base de datos IndexedDB ─────────────────────────────────────────────────

class SFSLocalDB extends Dexie {
  reservas!: EntityTable<ReservaLocal, "id">;
  syncQueue!: EntityTable<SyncOperation, "id">;

  constructor() {
    super("sfs-offline");

    this.version(1).stores({
      reservas: "id, serverId, canchaId, sincronizada, estado",
      syncQueue: "++id, type, entity, createdAt",
    });
  }
}

export const localDB = new SFSLocalDB();

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function guardarReservaOffline(reserva: Omit<ReservaLocal, "sincronizada" | "creadaEn">) {
  const nueva: ReservaLocal = {
    ...reserva,
    id: reserva.id || crypto.randomUUID(),
    sincronizada: false,
    creadaEn: new Date(),
  };

  await localDB.reservas.put(nueva);

  // Encolar para sincronización
  await localDB.syncQueue.add({
    type: "CREATE",
    entity: "reserva",
    data: nueva as unknown as Record<string, unknown>,
    createdAt: new Date(),
    retries: 0,
  });

  return nueva;
}

export async function obtenerReservasLocales() {
  return localDB.reservas.toArray();
}

export async function obtenerColaSync() {
  return localDB.syncQueue.orderBy("createdAt").toArray();
}

export async function eliminarDeColaSync(id: number) {
  return localDB.syncQueue.delete(id);
}

export async function marcarSincronizada(localId: string, serverId: string) {
  return localDB.reservas.update(localId, {
    serverId,
    sincronizada: true,
  });
}
