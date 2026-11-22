import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db, usuarios } from "@sfs/db";
import { eq } from "drizzle-orm";
import { inicialesDe, nombreCompleto } from "@/lib/db-mappers";
import { signedUrlFor, AVATAR_URL_TTL_SEGUNDOS } from "@/lib/storage";
import { ACCESS_COOKIE } from "@/lib/cookies";

export interface UsuarioDeSesion {
  nombre: string;
  /** Fallback del avatar cuando no hay foto. */
  iniciales: string;
  /** URL firmada que vence, o null si nunca subió foto. */
  avatarUrl: string | null;
}

/**
 * Identidad del usuario logueado, para los layouts (server components).
 *
 * Los endpoints usan `getAuthUser(request)`, que necesita un Request; en un
 * server component no hay, así que acá se lee la cookie con `cookies()`.
 *
 * Devuelve null en vez de lanzar: esto alimenta la decoración del sidebar, y
 * una sesión vencida no debería tumbar la página entera. Quien protege las
 * rutas es `proxy.ts`.
 */
export async function usuarioDeSesion(): Promise<UsuarioDeSesion | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    const fila = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, payload.sub as string),
      columns: { nombre: true, apellido: true, avatarUrl: true },
    });
    if (!fila) return null;

    return {
      nombre: nombreCompleto(fila),
      iniciales: inicialesDe(fila),
      // La columna guarda la ruta del objeto privado; al cliente sólo le viaja
      // una URL firmada.
      avatarUrl: await signedUrlFor(fila.avatarUrl ?? "", AVATAR_URL_TTL_SEGUNDOS),
    };
  } catch {
    return null;
  }
}
