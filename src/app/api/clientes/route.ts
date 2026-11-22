import { NextResponse } from "next/server";
import { db, reservas, usuarios } from "@sfs/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { apiHandler } from "@/lib/api-handler";
import { toApiUsuario } from "@/lib/db-mappers";
import { saldosPendientesDe } from "@/lib/saldo";

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
 *
 * Cada cliente viaja con su `saldoPendiente` porque deber bloquea reservar, y
 * el mostrador necesita saberlo AL ELEGIR a la persona. Sin esto el dueño se
 * entera recién cuando manda el formulario entero y come un 403, con la cancha,
 * la hora y el cobro ya elegidos. El 403 sigue existiendo: esto es el aviso
 * temprano, no la defensa.
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

    // El saldo se pregunta por el lote completo: una consulta para los diez
    // resultados, no una por cliente.
    const saldos = await saldosPendientesDe(filas.map((fila) => fila.id));

    return NextResponse.json(
      filas.map((fila) => ({
        ...toApiUsuario(fila),
        // Quien no debe nada no viene en el Map. Mandar 0 explícito le ahorra
        // a la UI tener que distinguir "no debe" de "no sé".
        saldoPendiente: saldos.get(fila.id) ?? 0,
      }))
    );
  },
  { requireAuth: true, requiredRole: "OWNER" }
);
