import { NextResponse } from "next/server";
import { db, equipos, equipoMiembros, usuarios } from "@sfs/db";
import { and, eq } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { invitarMiembroSchema } from "@/lib/schemas";
import { crearNotificacion } from "@/lib/notifications";
import { toApiUsuario, USUARIO_PUBLICO } from "@/lib/db-mappers";

type InvitarBody = { userId: string; rol?: "CAPITAN" | "MIEMBRO" };

async function cargarEquipo(equipoId: string, userId: string) {
  const equipo = await db.query.equipos.findFirst({
    where: eq(equipos.id, equipoId),
    with: { miembros: { where: eq(equipoMiembros.userId, userId), columns: { rol: true } } },
  });
  if (!equipo) return null;
  return { equipo, esCapitan: equipo.creadorId === userId || equipo.miembros[0]?.rol === "CAPITAN" };
}

/**
 * POST /api/equipos/:id/miembros
 *
 * Invita a un usuario al equipo. Solo el capitán/creador puede invitar.
 */
export const POST = apiHandler<InvitarBody>(
  async (request, ctx, { body }) => {
    const equipoId = request.url.split("/equipos/")[1]?.split("/")[0];
    if (!equipoId || !body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const { userId, rol } = body;

    const acceso = await cargarEquipo(equipoId, ctx.user!.sub);
    if (!acceso) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }
    if (!acceso.esCapitan) {
      return NextResponse.json({ error: "Solo el capitán puede invitar miembros" }, { status: 403 });
    }

    const invitado = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, userId),
      columns: USUARIO_PUBLICO,
    });
    if (!invitado) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const [miembro] = await db
      .insert(equipoMiembros)
      .values({ equipoId, userId, rol: rol || "MIEMBRO" })
      .onConflictDoNothing()
      .returning();

    if (!miembro) {
      return NextResponse.json({ error: "Este usuario ya es miembro del equipo" }, { status: 409 });
    }

    const usuario = toApiUsuario(invitado);

    await crearNotificacion({
      userId,
      tipo: "INVITACION_EQUIPO",
      titulo: `Invitación a ${acceso.equipo.nombre}`,
      mensaje: `${usuario.primerNombre}, te invitaron a ser parte de "${acceso.equipo.nombre}".`,
    });

    return NextResponse.json({ ...miembro, user: usuario }, { status: 201 });
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
    const targetUserId = new URL(request.url).searchParams.get("userId");

    if (!equipoId) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const acceso = await cargarEquipo(equipoId, user.sub);
    if (!acceso) {
      return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
    }

    const esAutoRemocion = !targetUserId || targetUserId === user.sub;
    if (!acceso.esCapitan && !esAutoRemocion) {
      return NextResponse.json({ error: "No tenés permiso para remover miembros" }, { status: 403 });
    }

    await db
      .delete(equipoMiembros)
      .where(and(eq(equipoMiembros.equipoId, equipoId), eq(equipoMiembros.userId, targetUserId || user.sub)));

    return NextResponse.json({ ok: true });
  },
  { requireAuth: true }
);
