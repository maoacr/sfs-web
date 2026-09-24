import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { markNotificationSchema } from "@/lib/schemas";
import { getNotificaciones, getNoLeidas, marcarLeida, marcarTodasLeidas } from "@/lib/notifications";

type MarcarBody = { id?: string; todas?: boolean };

/**
 * GET /api/notificaciones
 * Query: ?noLeidas=true (solo cuenta)
 */
export const GET = apiHandler(
  async (request, ctx, _validated) => {
    const userId = ctx.user!.sub;

    if (new URL(request.url).searchParams.get("noLeidas") === "true") {
      return NextResponse.json({ count: await getNoLeidas(userId) });
    }

    return NextResponse.json(await getNotificaciones(userId));
  },
  { requireAuth: true }
);

/**
 * PATCH /api/notificaciones
 * Body: { id } marca una como leída; { todas: true } marca todas.
 */
export const PATCH = apiHandler<MarcarBody>(
  async (_request, ctx, { body }) => {
    const userId = ctx.user!.sub;

    if (body?.todas) {
      await marcarTodasLeidas(userId);
      return NextResponse.json({ ok: true });
    }

    if (body?.id) {
      await marcarLeida(body.id, userId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "id o todas requerido" }, { status: 400 });
  },
  { requireAuth: true, bodySchema: markNotificationSchema }
);
