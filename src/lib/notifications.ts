import { db, notificaciones } from "@sfs/db";
import { eq, and, desc, sql } from "drizzle-orm";

// Guarda una notificación en la base de datos para el usuario
export async function crearNotificacion(params: {
  userId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  reservaId?: string;
}) {
  const [created] = await db
    .insert(notificaciones)
    .values({
      userId: params.userId,
      tipo: params.tipo as any,
      titulo: params.titulo,
      mensaje: params.mensaje,
      reservaId: params.reservaId,
    })
    .returning();
  return created;
}

// Obtiene notificaciones del usuario, más recientes primero
export async function getNotificaciones(userId: string, limit = 50) {
  return db.query.notificaciones.findMany({
    where: eq(notificaciones.userId, userId),
    orderBy: [desc(notificaciones.createdAt)],
    limit,
  });
}

// Cuenta notificaciones no leídas (para el badge)
export async function getNoLeidas(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificaciones)
    .where(and(eq(notificaciones.userId, userId), eq(notificaciones.leida, false)));
  return Number(result[0]?.count || 0);
}

// Marca una notificación como leída
export async function marcarLeida(id: string, userId: string) {
  return db
    .update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.id, id), eq(notificaciones.userId, userId)));
}

// Marca TODAS como leídas
export async function marcarTodasLeidas(userId: string) {
  return db
    .update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.userId, userId), eq(notificaciones.leida, false)));
}
