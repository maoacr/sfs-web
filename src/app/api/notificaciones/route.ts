import { NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/auth-api";
import { getNotificaciones, getNoLeidas, marcarLeida, marcarTodasLeidas } from "@/lib/notifications";

/**
 * GET /api/notificaciones
 * Query: ?noLeidas=true (solo cuenta)
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("noLeidas") === "true") {
      const count = await getNoLeidas(user.sub);
      return NextResponse.json({ count });
    }

    const notificaciones = await getNotificaciones(user.sub);
    return NextResponse.json(notificaciones);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/notificaciones
 * Body: { id: string } — marca una como leída
 * Body: { todas: true } — marca todas como leídas
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();

    if (body.todas) {
      await marcarTodasLeidas(user.sub);
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      await marcarLeida(body.id, user.sub);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "id o todas requerido" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
