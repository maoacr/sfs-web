import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/manifest.json",
  "/sw.js",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar token JWT en cookie
  const token = request.cookies.get("sfs_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;

    // Proteger rutas por rol
    if (pathname.startsWith("/owner") && role !== "OWNER") {
      return NextResponse.redirect(new URL("/player/buscar", request.url));
    }

    if (pathname.startsWith("/player") && role !== "PLAYER") {
      return NextResponse.redirect(new URL("/owner/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    // Token inválido o expirado — limpiar cookie y redirigir
    const response = NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
    response.cookies.delete("sfs_token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, icons, etc.)
     * - service worker and manifest
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
