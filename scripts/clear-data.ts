import { PrismaClient } from '@prisma/client';
import { COMMUNITY_ORGANIZATION_ID } from '../lib/tenancy';

const prisma = new PrismaClient();

async function main() {
  console.log('Limpiando solo datos de prueba...');

  const testFires = await prisma.incident.findMany({
    where: {
      organizationId: COMMUNITY_ORGANIZATION_ID,
      OR: [
        { lifecycleStatus: 'test' },
        {
          payload: {
            path: ['test'],
            equals: true,
          },
        },
      ],
    },
    select: { id: true },
  });

  const ids = testFires.map((fire) => fire.id);
  if (ids.length === 0) {
    console.log('No hay datos de prueba para limpiar.');
    return;
  }

  const deletedAudits = await prisma.fireAudit.deleteMany({
    where: { organizationId: COMMUNITY_ORGANIZATION_ID, fireId: { in: ids } },
  });
  console.log(`Eliminados ${deletedAudits.count} registros de auditoria de prueba`);

  const deletedFires = await prisma.incident.deleteMany({
    where: { organizationId: COMMUNITY_ORGANIZATION_ID, id: { in: ids } },
  });
  console.log(`Eliminados ${deletedFires.count} focos de prueba`);

  console.log('Limpieza segura completada.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
