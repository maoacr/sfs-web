const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Encontrar todos los dueños únicos con canchas
  const owners = await prisma.cancha.groupBy({
    by: ["tenantId"],
    where: { deletedAt: null },
  });

  for (const { tenantId } of owners) {
    // 2. Crear complejo default si no existe
    let complejo = await prisma.complejo.findFirst({
      where: { tenantId },
    });

    if (!complejo) {
      complejo = await prisma.complejo.create({
        data: {
          tenantId,
          nombre: "Mi Complejo",
          direccion: "Dirección pendiente de configurar",
          descripcion: null,
        },
      });
      console.log(`✅ Complejo creado para tenant ${tenantId}: ${complejo.id}`);
    }

    // 3. Asignar canchas sin complejo
    const result = await prisma.cancha.updateMany({
      where: { tenantId, complejoId: null },
      data: { complejoId: complejo.id },
    });
    console.log(`   ${result.count} canchas asignadas al complejo ${complejo.id}`);
  }

  console.log("\n✅ Migración completada");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
