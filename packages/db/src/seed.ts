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

  // 2. Crear Complejo deportivo
  const [complejo] = await db
    .insert(complejos)
    .values({
      tenantId: owner.id,
      nombre: "Complejo Deportivo El Campín",
      slug: "complejo-el-campin",
      direccion: "Calle 53 # 28-30",
      ciudad: "Bogotá",
      departamento: "Cundinamarca",
      descripcion: "El mejor centro deportivo sintético con iluminación LED profesional y parqueadero.",
      telefono: "+573001234567",
      email: "contacto@elcampin.test",
      latitud: "4.6486259",
      longitud: "-74.0776538",
    })
    .returning();

  console.log(`✅ Complejo creado: ${complejo.nombre}`);

  // 3. Crear Canchas F5 y F7
  const [canchaF5] = await db
    .insert(canchas)
    .values({
      tenantId: owner.id,
      complejoId: complejo.id,
      nombre: "Cancha Maracaná (F5)",
      tipo: "FUTBOL_5",
      capacidad: 10,
      descripcion: "Cancha de fútbol 5 con grama sintética monofilamento de última generación.",
      servicios: ["Iluminación LED", "Parqueadero", "Vestuarios", "Petos", "Balón"],
      duracionSlotMinutos: 60,
    })
    .returning();

  const [canchaF7] = await db
    .insert(canchas)
    .values({
      tenantId: owner.id,
      complejoId: complejo.id,
      nombre: "Cancha Wembley (F7)",
      tipo: "FUTBOL_7",
      capacidad: 14,
      descripcion: "Cancha de fútbol 7 techada con gradería y cafetería.",
      servicios: ["Techada", "Iluminación LED", "Cafetería", "Vestuarios"],
      duracionSlotMinutos: 60,
    })
    .returning();

  console.log(`✅ Canchas creadas: ${canchaF5.nombre}, ${canchaF7.nombre}`);

  // 4. Configurar horarios (Lunes a Domingo 07:00 a 23:00)
  for (const cancha of [canchaF5, canchaF7]) {
    for (let dia = 0; dia <= 6; dia++) {
      await db.insert(slotConfigs).values({
        canchaId: cancha.id,
        diaSemana: dia,
        horaApertura: "07:00:00",
        horaCierre: "23:00:00",
      });
    }

    // 5. Configurar tarifas base
    await db.insert(tarifas).values({
      canchaId: cancha.id,
      precioBase: cancha.tipo === "FUTBOL_5" ? "100000.00" : "160000.00",
      factor: "1.00",
    });
  }

  console.log("✅ Horarios y tarifas configurados para todas las canchas.");
  console.log("🎉 Seed completado exitosamente.");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Error ejecutando seed:", err);
  process.exit(1);
});
