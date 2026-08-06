import { NextResponse } from "next/server";
import { prisma } from "@sfs/db";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      primerNombre,
      segundoNombre,
      apellidos,
      apodo,
      telefono,
      codigoPais,
      role,
    } = await request.json();

    if (!email || !password || !primerNombre || !apellidos || !role) {
      return NextResponse.json(
        {
          error:
            "Email, contraseña, primer nombre, apellidos y tipo de cuenta son requeridos",
        },
        { status: 400 }
      );
    }

    if (!["OWNER", "PLAYER"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Verificar si el email ya existe
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 409 }
      );
    }

    // Verificar si el apodo ya existe (si se proporcionó)
    if (apodo) {
      const existingApodo = await prisma.user.findUnique({
        where: { apodo },
      });
      if (existingApodo) {
        return NextResponse.json(
          { error: "Este nombre de usuario ya está en uso" },
          { status: 409 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        primerNombre,
        segundoNombre: segundoNombre || null,
        apellidos,
        apodo: apodo || null,
        telefono: telefono || null,
        codigoPais: codigoPais || "+57",
        role,
      },
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await signRefreshToken(user.id);

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          nombre: [user.primerNombre, user.segundoNombre, user.apellidos]
            .filter(Boolean)
            .join(" "),
          apodo: user.apodo,
          role: user.role,
        },
      },
      { status: 201 }
    );

    response.cookies.set("sfs_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });

    response.cookies.set("sfs_refresh", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
