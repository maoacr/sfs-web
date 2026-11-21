import { NextResponse } from "next/server";
import { db, reservas, usuarios } from "@sfs/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { toApiUsuario } from "@/lib/db-mappers";

/**
 * GET /api/clientes?q=juan
 *
 * Busca entre los clientes del dueño para vincular una reserva manual a su
 * cuenta real, de modo que la persona la vea en su propia app.
 *
 * **Sólo busca entre quienes ya reservaron en los complejos de ese dueño, no
 * en todos los usuarios de la plataforma.** Permitir buscar sobre el padrón
 * completo convertiría este endpoint en un enumerador de nombres y teléfonos:
 * cualquier dueño podría tipear dos letras y cosechar datos de gente que
 * nunca pisó su cancha.
 *
 * La contracara es que un cliente nuevo no aparece acá, y está bien: para ese
 * caso existe `invitadoNombre`, que deja la reserva anotada sin bloquear nada.
 */
export const GET = apiHandler(
  async (request, ctx) => {
    const user = ctx.user!;
    const busqueda = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    // Con menos de dos caracteres cualquier búsqueda devuelve media base.
    if (busqueda.length < 2) return NextResponse.json([]);

    const patron = `%${busqueda}%`;

    const filas = await db
      .selectDistinct({
        id: usuarios.id,
        nombre: usuarios.nombre,
        apellido: usuarios.apellido,
        apodo: usuarios.apodo,
        telefono: usuarios.telefono,
      })
      .from(usuarios)
      .innerJoin(reservas, eq(reservas.playerId, usuarios.id))
      .where(
        and(
          eq(reservas.tenantId, user.sub),
          or(
            ilike(usuarios.nombre, patron),
            ilike(usuarios.apellido, patron),
            ilike(usuarios.apodo, patron),
            ilike(sql`${usuarios.nombre} || ' ' || ${usuarios.apellido}`, patron)
          )
        )
      )
      .limit(10);

    return NextResponse.json(filas.map(toApiUsuario));
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
