import { prisma } from "@sfs/db";

// Guarda una notificación en la base de datos para el usuario
export async function crearNotificacion(params: {
  userId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  reservaId?: string;
}) {
  return prisma.notificacion.create({
    data: {
      userId: params.userId,
      tipo: params.tipo as any,
      titulo: params.titulo,
      mensaje: params.mensaje,
      reservaId: params.reservaId,
    },
  });
}

// Obtiene notificaciones del usuario, más recientes primero
export async function getNotificaciones(userId: string, limit = 50) {
  return prisma.notificacion.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// Cuenta notificaciones no leídas (para el badge)
export async function getNoLeidas(userId: string) {
  return prisma.notificacion.count({
    where: { userId, leida: false },
  });
}

// Marca una notificación como leída
export async function marcarLeida(id: string, userId: string) {
  return prisma.notificacion.updateMany({
    where: { id, userId },
    data: { leida: true },
  });
}

// Marca TODAS como leídas
export async function marcarTodasLeidas(userId: string) {
  return prisma.notificacion.updateMany({
    where: { userId, leida: false },
    data: { leida: true },
  });
}
