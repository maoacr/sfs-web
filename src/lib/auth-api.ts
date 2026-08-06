import { jwtVerify } from "jose";

/**
 * Extrae y verifica el usuario desde la cookie JWT en API routes.
 * Retorna el payload del JWT o lanza error.
 */
export async function getAuthUser(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("sfs_token="))
    ?.split("=")[1];

  if (!token) {
    throw new AuthError("No autenticado", 401);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub: string; email: string; role: "OWNER" | "PLAYER" };
  } catch {
    throw new AuthError("Token inválido o expirado", 401);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
