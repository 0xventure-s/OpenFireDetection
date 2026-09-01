import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { fireStationSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const stations = await prisma.fireStation.findMany({
      where: { organizationId: operator.organizationId },
      orderBy: [{ locality: 'asc' }, { name: 'asc' }],
    });
    return ok({ items: stations });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return ok({ items: [] });
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = await requireOperator(request, 'resource.create');
    const validated = fireStationSchema.parse(await request.json());
    const station = await prisma.fireStation.create({
      data: {
        organizationId: operator.organizationId,
        code: validated.code || null,
        name: validated.name,
        locality: validated.locality || null,
        address: validated.address || null,
        contact: validated.contact || null,
        lat: validated.lat,
        lon: validated.lon,
        notes: validated.notes || null,
      },
    });

    await prisma.operationalAudit.create({
      data: {
        organizationId: operator.organizationId,
        stationId: station.id,
        action: 'station_created',
        actor: operator.id,
        reason: `Alta de cuartel: ${station.name}`,
        payload: toAuditPayload(station),
      },
    });

    return ok(station, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toAuditPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isMissingOperationalTableError(error: unknown) {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  return code === 'P2021' || /table .* does not exist/i.test(message);
}
