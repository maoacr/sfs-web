import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("test1234", 12);

  // ─── Dueño ─────────────────────────────────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: "dueno@test.com" },
    update: {},
    create: {
      email: "dueno@test.com",
      passwordHash: password,
      primerNombre: "Carlos",
      segundoNombre: "Andrés",
      apellidos: "Gómez Pérez",
      apodo: "carlitosgomez",
      telefono: "3001234567",
      codigoPais: "+57",
      role: "OWNER",
    },
  });
  console.log(`✅ Owner:  ${owner.email} / test1234`);

  // ─── Jugador ───────────────────────────────────────────────────────────
  const player = await prisma.user.upsert({
    where: { email: "jugador@test.com" },
    update: {},
    create: {
      email: "jugador@test.com",
      passwordHash: password,
      primerNombre: "María",
      apellidos: "López",
      apodo: "marialopez",
      telefono: "3109876543",
      codigoPais: "+57",
      role: "PLAYER",
    },
  });
  console.log(`✅ Player: ${player.email} / test1234`);

  // ─── Complejo ──────────────────────────────────────────────────────────
  const complejo = await prisma.complejo.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      tenantId: owner.id,
      nombre: "Fútbol Center El Campito",
      direccion: "Calle 123 #45-67, Bogotá",
      descripcion: "Complejo deportivo con 3 canchas",
      telefono: "3001234567",
      email: "elcampito@test.com",
    },
  });
  console.log(`✅ Complejo: ${complejo.nombre}`);

  // ─── Cancha de prueba ──────────────────────────────────────────────────
  const cancha = await prisma.cancha.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      tenantId: owner.id,
      complejoId: complejo.id,
      nombre: "Cancha Principal",
      tipo: "F5",
      capacidad: 10,
      descripcion: "Cancha de fútbol 5 con grama sintética",
      servicios: ["vestidores", "cafeteria", "parqueadero"],
      duracionSlotMinutos: 60,
    },
  });
  console.log(`✅ Cancha: ${cancha.nombre} (F5)`);

  // ─── Slots ─────────────────────────────────────────────────────────────
  await prisma.slotConfig.createMany({
    data: [
      { canchaId: cancha.id, diaSemana: 1, horaApertura: new Date("1970-01-01T08:00:00Z"), horaCierre: new Date("1970-01-01T23:00:00Z") },
      { canchaId: cancha.id, diaSemana: 2, horaApertura: new Date("1970-01-01T08:00:00Z"), horaCierre: new Date("1970-01-01T23:00:00Z") },
      { canchaId: cancha.id, diaSemana: 3, horaApertura: new Date("1970-01-01T08:00:00Z"), horaCierre: new Date("1970-01-01T23:00:00Z") },
      { canchaId: cancha.id, diaSemana: 4, horaApertura: new Date("1970-01-01T08:00:00Z"), horaCierre: new Date("1970-01-01T23:00:00Z") },
      { canchaId: cancha.id, diaSemana: 5, horaApertura: new Date("1970-01-01T08:00:00Z"), horaCierre: new Date("1970-01-01T23:00:00Z") },
      { canchaId: cancha.id, diaSemana: 6, horaApertura: new Date("1970-01-01T09:00:00Z"), horaCierre: new Date("1970-01-01T20:00:00Z") },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Slots: Lun-Vie 8-23, Sáb 9-20");

  // ─── Tarifa ────────────────────────────────────────────────────────────
  await prisma.tarifa.create({
    data: {
      canchaId: cancha.id,
      precioBase: 60000,
      factor: 1.0,
    },
  });
  console.log("✅ Tarifa base: $60.000 COP");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
