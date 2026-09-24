import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";

/**
 * POST /api/auth/logout
 * Sin CSRF: con la sesión vencida no hay token que obtener y el usuario
 * igual tiene que poder salir. Cerrar sesión no es una acción peligrosa.
 */
export const POST = apiHandler(
  async (request, _ctx, _validated) => {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete("sfs_token");
    response.cookies.delete("sfs_refresh");
    response.cookies.delete("csrf_token");
    return response;
  },
  { requireCsrf: false }
);
