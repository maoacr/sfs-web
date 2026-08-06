import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import { getAuthUser, AuthError } from "@/lib/auth-api";

/**
 * GET /api/auth/me
 * Devuelve los datos del usuario autenticado.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    const data = await prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true, email: true, primerNombre: true, segundoNombre: true,
        apellidos: true, apodo: true, telefono: true, codigoPais: true, role: true,
      },
    });
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/me
 * Actualiza los datos del usuario autenticado.
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();

    // Verificar si el apodo está disponible
    if (body.apodo) {
      const existing = await prisma.user.findUnique({ where: { apodo: body.apodo } });
      if (existing && existing.id !== user.sub) {
        return NextResponse.json({ error: "Este nombre de usuario ya está en uso" }, { status: 409 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.sub },
      data: {
        ...(body.primerNombre !== undefined && { primerNombre: body.primerNombre }),
        ...(body.segundoNombre !== undefined && { segundoNombre: body.segundoNombre }),
        ...(body.apellidos !== undefined && { apellidos: body.apellidos }),
        ...(body.apodo !== undefined && { apodo: body.apodo }),
        ...(body.telefono !== undefined && { telefono: body.telefono }),
        ...(body.codigoPais !== undefined && { codigoPais: body.codigoPais }),
      },
      select: {
        id: true, email: true, primerNombre: true, segundoNombre: true,
        apellidos: true, apodo: true, telefono: true, codigoPais: true, role: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
