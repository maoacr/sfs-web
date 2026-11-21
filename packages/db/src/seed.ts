import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { db } from "./client";
import { usuarios, complejos, canchas, slotConfigs, tarifas } from "./schema";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

async function runSeed() {
  console.log("🌱 Iniciando seed de base de datos...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Crear Owner y Player
  const [owner] = await db
    .insert(usuarios)
    .values({
      email: "owner@sfs.test",
      passwordHash,
      nombre: "Carlos",
      apellido: "Valderrama",
      apodo: "Pibe",
      telefono: "+573001234567",
      rol: "OWNER",
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: { nombre: "Carlos", apellido: "Valderrama", apodo: "Pibe" },
    })
    .returning();

  const [player] = await db
    .insert(usuarios)
    .values({
      email: "player@sfs.test",
      passwordHash,
      nombre: "Radamel",
      apellido: "Falcao",
      apodo: "Tigre",
      telefono: "+573109876543",
      rol: "PLAYER",
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: { nombre: "Radamel", apellido: "Falcao", apodo: "Tigre" },
    })
    .returning();

  console.log(`✅ Usuarios creados: Owner (${owner.email}), Player (${player.email})`);

  // 2. Complejos y canchas
  //
  // Tres complejos con 1, 2 y 3 canchas a propósito: el carrusel de canchas se
  // comporta distinto según cuántas haya, y con un solo complejo de dos
  // canchas no se puede ver.
  //
  // El seed es ADITIVO: no borra nada. Esta base tiene reservas y pagos
  // reales, así que lo que ya existe se respeta y sólo se crea lo que falta.
  const CATALOGO = [
    {
      nombre: "Complejo Deportivo El Campín",
      slug: "complejo-el-campin",
      direccion: "Calle 53 #28-30, Bogotá",
      tipoVia: "Calle", numeroVia: "53", numeroSec: "28-30",
      descripcion: "El mejor centro deportivo sintético con iluminación LED profesional y parqueadero.",
      telefono: "+573001234567", email: "contacto@elcampin.test",
      latitud: "4.6486259", longitud: "-74.0776538",
      canchas: [
        { nombre: "Cancha Maracaná (F5)", tipo: "FUTBOL_5" as const, capacidad: 10,
          descripcion: "Grama sintética monofilamento de última generación.",
          servicios: ["Iluminación LED", "Parqueadero", "Vestuarios", "Petos", "Balón"] },
        { nombre: "Cancha Wembley (F7)", tipo: "FUTBOL_7" as const, capacidad: 14,
          descripcion: "Cancha techada con gradería y cafetería.",
          servicios: ["Techada", "Iluminación LED", "Cafetería", "Vestuarios"] },
        { nombre: "Cancha Azteca (F11)", tipo: "FUTBOL_11" as const, capacidad: 22,
          descripcion: "Cancha de fútbol 11 con medidas reglamentarias.",
          servicios: ["Iluminación LED", "Vestuarios", "Parqueadero", "Gradería"] },
      ],
    },
    {
      nombre: "Centro Deportivo La 85",
      slug: "centro-deportivo-la-85",
      direccion: "Carrera 15 #85-40, Bogotá",
      tipoVia: "Carrera", numeroVia: "15", numeroSec: "85-40",
      descripcion: "Dos canchas en pleno centro, con cafetería y transmisión de partidos.",
      telefono: "+573002223344", email: "hola@la85.test",
      latitud: "4.6708", longitud: "-74.0537",
      canchas: [
        { nombre: "Cancha Bombonera (F5)", tipo: "FUTBOL_5" as const, capacidad: 10,
          descripcion: "Cancha rápida, ideal para partidos cortos.",
          servicios: ["Iluminación LED", "Cafetería", "Vestuarios"] },
        { nombre: "Cancha Monumental (F6)", tipo: "FUTBOL_6" as const, capacidad: 12,
          descripcion: "Grama sintética nueva con red perimetral alta.",
          servicios: ["Iluminación LED", "Vestuarios", "Petos"] },
      ],
    },
    {
      nombre: "Potrero del Norte",
      slug: "potrero-del-norte",
      direccion: "Calle 170 #45-12, Bogotá",
      tipoVia: "Calle", numeroVia: "170", numeroSec: "45-12",
      descripcion: "Cancha de barrio, sencilla y bien cuidada.",
      telefono: "+573005556677", email: "potrero@norte.test",
      latitud: "4.7510", longitud: "-74.0450",
      canchas: [
        { nombre: "La Única (F5)", tipo: "FUTBOL_5" as const, capacidad: 10,
          descripcion: "Una sola cancha, siempre impecable.",
          servicios: ["Iluminación", "Parqueadero"] },
      ],
    },
  ];

  const PRECIOS: Record<string, string> = {
    FUTBOL_5: "100000.00", FUTBOL_6: "130000.00", FUTBOL_7: "160000.00",
    FUTBOL_8: "180000.00", FUTBOL_9: "200000.00", FUTBOL_11: "240000.00",
  };

  for (const def of CATALOGO) {
    const existente = await db.query.complejos.findFirst({
      where: eq(complejos.slug, def.slug),
    });

    const complejo = existente ?? (
      await db.insert(complejos).values({
        tenantId: owner.id,
        nombre: def.nombre,
        slug: def.slug,
        direccion: def.direccion,
        tipoVia: def.tipoVia,
        numeroVia: def.numeroVia,
        numeroSec: def.numeroSec,
        ciudad: "Bogotá",
        departamento: "Cundinamarca",
        descripcion: def.descripcion,
        telefono: def.telefono,
        email: def.email,
        latitud: def.latitud,
        longitud: def.longitud,
      }).returning()
    )[0];

    console.log(`${existente ? "↷ Ya existía" : "✅ Complejo creado"}: ${complejo.nombre}`);

    for (const c of def.canchas) {
      const yaEsta = await db.query.canchas.findFirst({
        where: and(eq(canchas.complejoId, complejo.id), eq(canchas.nombre, c.nombre)),
      });
      if (yaEsta) {
        console.log(`   ↷ Ya existía: ${c.nombre}`);
        continue;
      }

      const [cancha] = await db.insert(canchas).values({
        tenantId: owner.id,
        complejoId: complejo.id,
        nombre: c.nombre,
        tipo: c.tipo,
        capacidad: c.capacidad,
        descripcion: c.descripcion,
        servicios: c.servicios,
        duracionSlotMinutos: 60,
      }).returning();

      // Lunes a domingo, 07:00 a 23:00.
      for (let dia = 0; dia <= 6; dia++) {
        await db.insert(slotConfigs).values({
          canchaId: cancha.id,
          diaSemana: dia,
          horaApertura: "07:00:00",
          horaCierre: "23:00:00",
        });
      }

      await db.insert(tarifas).values({
        canchaId: cancha.id,
        precioBase: PRECIOS[c.tipo] ?? "100000.00",
        factor: "1.00",
      });

      console.log(`   ✅ ${cancha.nombre}`);
    }
  }

  console.log("🎉 Seed completado: 3 complejos con 3, 2 y 1 canchas.");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Error ejecutando seed:", err);
  process.exit(1);
});
