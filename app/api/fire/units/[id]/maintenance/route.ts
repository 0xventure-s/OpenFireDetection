import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../../_auth';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { maintenanceRecordCreateSchema, maintenanceRecordUpdateSchema } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request, 'maintenance.read');
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'maintenance.read');

    const { id } = await params;
    const unit = await prisma.operationalUnit.findFirst({
      where: { id, organizationId: operator.organizationId },
      select: { id: true },
    });
    if (!unit) return fail(404, 'Unit not found');

    const records = await prisma.maintenanceRecord.findMany({
      where: { organizationId: operator.organizationId, unitId: id },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      include: { unit: { include: { station: true } } },
    });
    return ok({ unitId: id, items: records });
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'maintenance.create');
    const { id } = await params;
    const validated = maintenanceRecordCreateSchema.parse(await request.json());
    const unit = await prisma.operationalUnit.findFirst({
      where: { id, organizationId: operator.organizationId },
    });
    if (!unit) return fail(404, 'Unit not found');

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRecord.create({
        data: {
          organizationId: operator.organizationId,
          unitId: id,
          title: validated.title,
          status: validated.status,
          dueAt: validated.dueAt,
          scheduledAt: validated.scheduledAt,
          startedAt: validated.status === 'in_progress' ? validated.startedAt || new Date() : validated.startedAt,
          completedAt: validated.status === 'completed' ? validated.completedAt || new Date() : validated.completedAt,
          odometerKm: validated.odometerKm,
          performedBy: validated.performedBy,
          notes: validated.notes,
          createdBy: operator.id,
        },
        include: { unit: { include: { station: true } } },
      });

      if (created.status === 'in_progress') {
        await tx.operationalUnit.update({
          where: { id, organizationId: operator.organizationId },
          data: { status: 'maintenance' },
        });
      }

      await tx.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          unitId: id,
          maintenanceId: created.id,
          action: 'maintenance_created',
          actor: operator.id,
          reason: `Alta de mantenimiento: ${created.title}`,
          payload: toAuditPayload(created),
        },
      });

      return created;
    });

    return ok(record, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'maintenance.update');
    const { id } = await params;
    const validated = maintenanceRecordUpdateSchema.parse(await request.json());
    const existing = await prisma.maintenanceRecord.findFirst({
      where: { id: validated.maintenanceId, organizationId: operator.organizationId, unitId: id },
      include: { unit: true },
    });
    if (!existing) return fail(404, 'Maintenance record not found');

    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRecord.update({
        where: { id: validated.maintenanceId, organizationId: operator.organizationId },
        data: {
          title: validated.title,
          status: validated.status,
          dueAt: validated.dueAt,
          scheduledAt: validated.scheduledAt,
          startedAt:
            validated.status === 'in_progress' && !validated.startedAt
              ? existing.startedAt || new Date()
              : validated.startedAt,
          completedAt:
            validated.status === 'completed' && !validated.completedAt
              ? existing.completedAt || new Date()
              : validated.completedAt,
          odometerKm: validated.odometerKm,
          performedBy: validated.performedBy,
          notes: validated.notes,
        },
        include: { unit: { include: { station: true } } },
      });

      if (updated.status === 'in_progress') {
        await tx.operationalUnit.update({
          where: { id, organizationId: operator.organizationId },
          data: { status: 'maintenance' },
        });
      }

      if (updated.status === 'completed' || updated.status === 'cancelled') {
        const activeMaintenance = await tx.maintenanceRecord.count({
          where: {
            organizationId: operator.organizationId,
            unitId: id,
            status: 'in_progress',
            id: { not: updated.id },
          },
        });
        if (activeMaintenance === 0 && existing.unit.status === 'maintenance') {
          await tx.operationalUnit.update({
            where: { id, organizationId: operator.organizationId },
            data: { status: 'available' },
          });
        }
      }

      await tx.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          unitId: id,
          maintenanceId: updated.id,
          action: 'maintenance_updated',
          actor: operator.id,
          reason: `Mantenimiento actualizado a ${updated.status}`,
          payload: toAuditPayload(validated),
        },
      });

      return updated;
    });

    return ok(record);
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toAuditPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
