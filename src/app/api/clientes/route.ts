import { NextResponse } from "next/server";
import { db, reservas, usuarios } from "@sfs/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { crearClienteSchema, type CrearClienteInput } from "@/lib/schemas";
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


/**
 * POST /api/clientes
 *
 * El dueño registra a quien cayó al mostrador y no está en el sistema.
 *
 * **Por qué existe**: antes, agendarle a un desconocido dejaba la reserva a
 * nombre del DUEÑO con el nombre del invitado en una columna aparte. Si esa
 * persona quedaba debiendo, la deuda era del dueño — y como deber bloquea
 * reservar, lo dejaba sin poder agendar a nadie. Con cuenta propia, la deuda
 * cae donde corresponde.
 *
 * **La cuenta nace sin contraseña y sin dueño.** No puede entrar todavía: el
 * login busca con `eq(usuarios.email, ...)` y un `eq` nunca matchea NULL. El
 * email es lo que después le permite RECLAMARLA — al entrar con Google,
 * `decidirVinculo` la encuentra por email y le entrega su historial.
 */
export const POST = apiHandler<CrearClienteInput>(
  async (_request, _ctx, { body }) => {
    if (!body) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    // Vacío es ausente, no un string vacío: `""` ocuparía el índice único y el
    // segundo cliente sin email reventaría.
    const email = body.email?.trim().toLowerCase() || null;

    if (email) {
      const yaRegistrado = await db.query.usuarios.findFirst({
        where: eq(usuarios.email, email),
        columns: { id: true, nombre: true },
      });

      // No se crea una segunda cuenta para la misma persona —eso partiría su
      // historial Y su saldo, y la regla del bloqueo contaría de menos— pero
      // tampoco se deja al mostrador sin salida: se ofrece ESA cuenta para
      // vincular la reserva.
      //
      // Del titular sólo viaja el PRIMER NOMBRE, y es deliberado: alcanza para
      // que el dueño confirme que es la persona que tiene enfrente, y no le
      // entrega la ficha de alguien que nunca pisó su cancha. El apellido y el
      // teléfono se quedan acá.
      if (yaRegistrado) {
        // El saldo se manda junto: si esa cuenta debe, el bloqueo va a cortar
        // la reserva igual, y enterarse ahora es mejor que al mandar el
        // formulario entero.
        const saldos = await saldosPendientesDe([yaRegistrado.id]);

        return NextResponse.json(
          {
            error: "Ese email ya tiene una cuenta en SFS.",
            clienteExistente: {
              id: yaRegistrado.id,
              primerNombre: yaRegistrado.nombre.split(" ")[0],
              saldoPendiente: saldos.get(yaRegistrado.id) ?? 0,
            },
          },
          { status: 409 }
        );
      }
    }

    const [creado] = await db
      .insert(usuarios)
      .values({
        // Misma forma que el registro normal: los dos nombres van juntos en
        // `nombre`, y `toApiUsuario` los vuelve a separar al leer.
        nombre: [body.primerNombre, body.segundoNombre].filter(Boolean).join(" "),
        apellido: body.apellidos,
        email,
        // Sin contraseña a propósito: la persona no eligió ninguna. Se reclama
        // entrando con Google.
        passwordHash: null,
        // Un cliente es siempre PLAYER. No se lee del body: sería un camino
        // para que un dueño fabrique dueños.
        rol: "PLAYER",
        telefono: body.telefono?.trim() || null,
        codigoPais: body.codigoPais,
        apodo: body.apodo?.trim() || null,
        instagram: body.instagram?.trim() || null,
        tiktok: body.tiktok?.trim() || null,
        twitter: body.twitter?.trim() || null,
        facebook: body.facebook?.trim() || null,
      })
      .returning();

    // Misma forma que el GET, para que el modal lo pueda elegir sin pedir nada
    // más. Recién creado no puede deber: no tiene ni una reserva.
    return NextResponse.json(
      { ...toApiUsuario(creado), saldoPendiente: 0 },
      { status: 201 }
    );
  },
  { requireAuth: true, requiredRole: "OWNER", bodySchema: crearClienteSchema }
);
