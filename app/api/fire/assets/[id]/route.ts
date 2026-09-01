import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { operationalAssetUpdateSchema } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const { id } = await params;
    const asset = await prisma.operationalAsset.findFirst({ where: { id, organizationId: operator.organizationId } });
    if (!asset) return fail(404, 'Asset not found');
    return ok(asset);
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
    const validated = operationalAssetUpdateSchema.parse(await request.json());
    const asset = await prisma.operationalAsset.update({
      where: { id, organizationId: operator.organizationId },
      data: {
        name: validated.name,
        type: validated.type,
        status: validated.status,
        lat: validated.lat,
        lon: validated.lon,
        notes: validated.notes === undefined ? undefined : validated.notes || null,
        payload: toJsonPayload(validated.payload),
      },
    });
    await prisma.operationalAudit.create({
      data: {
        organizationId: operator.organizationId,
        assetId: asset.id,
        action: 'asset_updated',
        actor: operator.id,
        reason: `Edicion de activo: ${asset.name}`,
        payload: toAuditPayload(validated),
      },
    });
    return ok(asset);
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toJsonPayload(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toAuditPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
