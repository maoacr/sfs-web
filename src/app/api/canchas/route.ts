import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * GET /api/canchas
 * Lista las canchas del dueño autenticado.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    // Solo dueños pueden listar sus canchas
    if (user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Solo dueños pueden gestionar canchas" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const activas = searchParams.get("activas") === "true";

    const canchas = await prisma.cancha.findMany({
      where: {
        tenantId: user.sub,
        ...(activas ? { deletedAt: null } : {}),
      },
      include: {
        complejo: true,
        imagenes: { orderBy: { orden: "asc" } },
        slots: { orderBy: { diaSemana: "asc" } },
        tarifas: true,
        _count: { select: { reservas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(canchas);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET /api/canchas error:", error);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/canchas
 * Crea una nueva cancha para el dueño autenticado.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    if (user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Solo dueños pueden crear canchas" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validación básica
    if (!body.nombre || !body.tipo || !body.capacidad || !body.complejoId) {
      return NextResponse.json(
        { error: "Nombre, tipo, capacidad y complejo son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el complejo pertenece al dueño
    const complejo = await prisma.complejo.findFirst({
      where: { id: body.complejoId, tenantId: user.sub },
    });

    if (!complejo) {
      return NextResponse.json(
        { error: "Complejo no encontrado" },
        { status: 404 }
      );
    }

    const tiposValidos = ["F5", "F6", "F7", "F8", "F9", "F11"];
    if (!tiposValidos.includes(body.tipo)) {
      return NextResponse.json(
        { error: `Tipo inválido. Debe ser: ${tiposValidos.join(", ")}` },
        { status: 400 }
      );
    }

    const cancha = await prisma.cancha.create({
      data: {
        tenantId: user.sub,
        complejoId: body.complejoId,
        nombre: body.nombre,
        tipo: body.tipo,
        capacidad: body.capacidad,
        descripcion: body.descripcion || null,
        servicios: body.servicios || [],
        duracionSlotMinutos: body.duracionSlotMinutos || 60,
      },
      include: {
        complejo: true,
        imagenes: true,
        slots: true,
        tarifas: true,
      },
    });

    return NextResponse.json(cancha, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/canchas error:", error);
    return NextResponse.json(
      { error: "Error interno al crear la cancha" },
      { status: 500 }
    );
  }
}
