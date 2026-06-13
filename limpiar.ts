import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Conectando a la base de datos...");
  
  // Borramos el registro corrupto del historial de Prisma
  const resultado = await prisma.$executeRawUnsafe(
    "DELETE FROM _prisma_migrations WHERE migration_name = '20260607000000_init'"
  );
  
  console.log(`¡Limpieza exitosa! Registros eliminados: ${resultado}`);
}

main()
  .catch((e) => {
    console.error("Error al limpiar la tabla:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });