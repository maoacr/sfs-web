import { db, partidos, partidoJugadores } from "@sfs/db";
import { eq, inArray, or } from "drizzle-orm";

export function partidosDelUsuario(userId: string) {
  return or(
    eq(partidos.creadorId, userId),
    inArray(
      partidos.id,
      db
        .select({ id: partidoJugadores.partidoId })
        .from(partidoJugadores)
        .where(eq(partidoJugadores.userId, userId))
    )
  );
}
