import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { operationalUnitSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const units = await prisma.operationalUnit.findMany({
      where: { organizationId: operator.organizationId },
      include: {
        station: true,
        maintenanceRecords: {
          where: { status: { in: ['scheduled', 'in_progress'] } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          take: 3,
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return ok({ items: units });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return ok({ items: [] });
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = await requireOperator(request, 'resource.create');
    const validated = operationalUnitSchema.parse(await request.json());
    const unit = await prisma.operationalUnit.create({
      data: {
        organizationId: operator.organizationId,
        code: validated.code,
        name: validated.name,
        type: validated.type,
        stationId: validated.stationId || null,
        baseName: validated.baseName,
        status: validated.status,
        contact: validated.contact,
        licensePlate: validated.licensePlate,
        capacityLiters: validated.capacityLiters,
        crewCapacity: validated.crewCapacity,
        lat: validated.lat,
        lon: validated.lon,
        notes: validated.notes,
        payload: toJsonPayload(validated.payload),
      },
      include: { station: true, maintenanceRecords: true },
    });

    await prisma.operationalAudit.create({
      data: {
        organizationId: operator.organizationId,
        unitId: unit.id,
        action: 'unit_created',
        actor: operator.id,
        reason: `Alta de unidad: ${unit.name}`,
        payload: toAuditPayload(unit),
      },
    });
    return ok(unit, { status: 201 });
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

function isMissingOperationalTableError(error: unknown) {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  return code === 'P2021' || /table .* does not exist/i.test(message);
}
