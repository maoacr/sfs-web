import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { apiHandler } from "@/lib/api-handler";
import { invitarMiembroSchema } from "@/lib/schemas";
import { crearNotificacion } from "@/lib/notifications";

type InvitarBody = { userId: string; rol?: "CAPITAN" | "MIEMBRO" };

/**
 * POST /api/equipos/:id/miembros
 *
 * Invita a un usuario al equipo. Solo el capitán/creador puede invitar.
 */
export const POST = apiHandler<InvitarBody>(
  async (request, ctx, { body }) => {
    const user = ctx.user!;
    const equipoId = request.url.split("/equipos/")[1]?.split("/")[0];
    if (!equipoId || !body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const { userId, rol } = body;

    // Verificar que el equipo existe y el usuario es capitán
    const equipo = await prisma.equipo.findUnique({
      where: { id: equipoId },
      include: { miembros: { where: { userId: user.sub } } },
    });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    const miembroActual = equipo.miembros[0];
    if (equipo.creadorId !== user.sub && miembroActual?.rol !== "CAPITAN") {
      return NextResponse.json(
        { error: "Solo el capitán puede invitar miembros" },
        { status: 403 }
      );
    }

    // Verificar que el usuario existe
    const invitado = await prisma.user.findUnique({ where: { id: userId } });
    if (!invitado) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar que no es ya miembro
    const existe = await prisma.equipoMiembro.findUnique({
      where: { equipoId_userId: { equipoId, userId } },
    });

    if (existe) {
      return NextResponse.json(
        { error: "Este usuario ya es miembro del equipo" },
        { status: 409 }
      );
    }

    // Agregar miembro
    const miembro = await prisma.equipoMiembro.create({
      data: {
        equipoId,
        userId,
        rol: rol || "MIEMBRO",
      },
      include: {
        user: { select: { id: true, primerNombre: true, apellidos: true, apodo: true } },
      },
    });

    // Notificar al invitado
    await crearNotificacion({
      userId,
      tipo: "INVITACION_EQUIPO",
      titulo: `Invitación a ${equipo.nombre}`,
      mensaje: `${invitado.primerNombre}, te invitaron a ser parte de "${equipo.nombre}".`,
    });

    return NextResponse.json(miembro, { status: 201 });
  },
  {
    requireAuth: true,
    bodySchema: invitarMiembroSchema,
  }
);

/**
 * DELETE /api/equipos/:id/miembros?userId=xxx
 *
 * Remueve a un miembro del equipo. El capitán puede remover a cualquiera.
 * Un miembro puede salir del equipo por su cuenta.
 */
export const DELETE = apiHandler(
  async (request, ctx, _validated) => {
    const user = ctx.user!;
    const equipoId = request.url.split("/equipos/")[1]?.split("/")[0];
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!equipoId) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const equipo = await prisma.equipo.findUnique({
      where: { id: equipoId },
      include: { miembros: { where: { userId: user.sub } } },
    });

    if (!equipo) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    const miembroActual = equipo.miembros[0];
    const esCapitan = equipo.creadorId === user.sub || miembroActual?.rol === "CAPITAN";
    const esAutoRemocion = targetUserId === user.sub || !targetUserId;

    if (!esCapitan && !esAutoRemocion) {
      return NextResponse.json(
        { error: "No tenés permiso para remover miembros" },
        { status: 403 }
      );
    }

    const userIdToRemove = targetUserId || user.sub;

    await prisma.equipoMiembro.deleteMany({
      where: { equipoId, userId: userIdToRemove },
    });

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true }
);
