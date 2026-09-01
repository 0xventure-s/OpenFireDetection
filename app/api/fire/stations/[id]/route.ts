import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { fireStationUpdateSchema } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const { id } = await params;
    const station = await prisma.fireStation.findFirst({
      where: { id, organizationId: operator.organizationId },
      include: {
        units: { orderBy: [{ status: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!station) return fail(404, 'Station not found');
    return ok(station);
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
    const validated = fireStationUpdateSchema.parse(await request.json());
    const station = await prisma.fireStation.update({
      where: { id, organizationId: operator.organizationId },
      data: {
        code: validated.code === undefined ? undefined : validated.code || null,
        name: validated.name,
        locality: validated.locality === undefined ? undefined : validated.locality || null,
        address: validated.address === undefined ? undefined : validated.address || null,
        contact: validated.contact === undefined ? undefined : validated.contact || null,
        lat: validated.lat,
        lon: validated.lon,
        notes: validated.notes === undefined ? undefined : validated.notes || null,
      },
    });

    await prisma.operationalAudit.create({
      data: {
        organizationId: operator.organizationId,
        stationId: station.id,
        action: 'station_updated',
        actor: operator.id,
        reason: `Edicion de cuartel: ${station.name}`,
        payload: toAuditPayload(validated),
      },
    });

    return ok(station);
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toAuditPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
