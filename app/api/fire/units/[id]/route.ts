import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { operationalUnitUpdateSchema } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const { id } = await params;
    const unit = await prisma.operationalUnit.findFirst({
      where: { id, organizationId: operator.organizationId },
      include: {
        station: true,
        maintenanceRecords: { orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] },
        assignments: {
          where: { status: { not: 'released' }, releasedAt: null },
          orderBy: { assignedAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!unit) return fail(404, 'Unit not found');
    return ok(unit);
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'resource.update');
    const { id } = await params;
    const validated = operationalUnitUpdateSchema.parse(await request.json());
    const unit = await prisma.operationalUnit.update({
      where: { id, organizationId: operator.organizationId },
      data: {
        code: validated.code,
        name: validated.name,
        type: validated.type,
        stationId: validated.stationId === undefined ? undefined : validated.stationId || null,
        baseName: validated.baseName === undefined ? undefined : validated.baseName || null,
        status: validated.status,
        contact: validated.contact === undefined ? undefined : validated.contact || null,
        licensePlate: validated.licensePlate === undefined ? undefined : validated.licensePlate || null,
        capacityLiters: validated.capacityLiters,
        crewCapacity: validated.crewCapacity,
        lat: validated.lat,
        lon: validated.lon,
        notes: validated.notes === undefined ? undefined : validated.notes || null,
        payload: toJsonPayload(validated.payload),
      },
      include: {
        station: true,
        maintenanceRecords: {
          where: { status: { in: ['scheduled', 'in_progress'] } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    await prisma.operationalAudit.create({
      data: {
        organizationId: operator.organizationId,
        unitId: unit.id,
        action: 'unit_updated',
        actor: operator.id,
        reason: `Edicion de unidad: ${unit.name}`,
        payload: toAuditPayload(validated),
      },
    });

    return ok(unit);
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toAuditPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toJsonPayload(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : toAuditPayload(value);
}
