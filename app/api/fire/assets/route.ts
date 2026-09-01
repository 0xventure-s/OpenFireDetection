import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { operationalAssetSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const assets = await prisma.operationalAsset.findMany({
      where: { organizationId: operator.organizationId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return ok({ items: assets });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return ok({ items: [] });
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = await requireOperator(request, 'resource.create');
    const validated = operationalAssetSchema.parse(await request.json());
    const asset = await prisma.operationalAsset.create({
      data: {
        organizationId: operator.organizationId,
        name: validated.name,
        type: validated.type,
        status: validated.status,
        lat: validated.lat,
        lon: validated.lon,
        notes: validated.notes,
        payload: toJsonPayload(validated.payload),
      },
    });
    await prisma.operationalAudit.create({
      data: {
        organizationId: operator.organizationId,
        assetId: asset.id,
        action: 'asset_created',
        actor: operator.id,
        reason: `Alta de activo: ${asset.name}`,
        payload: toAuditPayload(asset),
      },
    });
    return ok(asset, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}


function isMissingOperationalTableError(error: unknown) {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  return code === 'P2021' || /table .* does not exist/i.test(message);
}

function toJsonPayload(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toAuditPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
