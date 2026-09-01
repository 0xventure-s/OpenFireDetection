import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma, db } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../../_auth';
import { normalizePayload } from '@/lib/fire-utils';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { incidentAssignmentCreateSchema, incidentAssignmentUpdateSchema } from '@/lib/validations';
import { FirePayload } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const { id } = await params;
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const assignments = await prisma.incidentAssignment.findMany({
      where: { organizationId: operator.organizationId, fireId: id },
      include: { unit: { include: { station: true } }, asset: true },
      orderBy: { assignedAt: 'desc' },
    });

    return ok({ fireId: id, items: assignments });
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'resource.assign');
    const { id } = await params;
    const validated = incidentAssignmentCreateSchema.parse(await request.json());
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const unit = validated.unitId
      ? await prisma.operationalUnit.findFirst({
          where: { id: validated.unitId, organizationId: operator.organizationId },
        })
      : null;
    if (validated.unitId && !unit) return fail(404, 'Operational unit not found');
    const asset = validated.assetId
      ? await prisma.operationalAsset.findFirst({
          where: { id: validated.assetId, organizationId: operator.organizationId },
        })
      : null;
    if (validated.assetId && !asset) return fail(404, 'Operational asset not found');
    if (unit && unit.status !== 'available') {
      return fail(409, 'Operational unit unavailable', `La unidad ${unit.name} está ${unit.status} y no puede despacharse.`);
    }
    const unitName = unit?.name || validated.unitName || null;

    const assignment = await prisma.incidentAssignment.create({
      data: {
        organizationId: operator.organizationId,
        fireId: id,
        unitId: validated.unitId,
        assetId: validated.assetId,
        unitName,
        role: validated.role,
        status: validated.status,
        assignedBy: operator.id,
        notes: validated.notes,
      },
      include: {
        unit: { include: { station: true } },
        asset: true,
      },
    });

    if (unit) {
      await prisma.operationalUnit.update({
        where: { id: unit.id, organizationId: operator.organizationId },
        data: { status: 'assigned' },
      });
      await prisma.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          unitId: unit.id,
          action: 'unit_dispatched',
          actor: operator.id,
          reason: `Unit dispatched to incident ${id}`,
          payload: toAssignmentAuditPayload(assignment),
        },
      });
    }

    if (assignment.assetId) {
      await prisma.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          assetId: assignment.assetId,
          action: 'asset_assigned',
          actor: operator.id,
          reason: `Asset assigned to incident ${id}`,
          payload: toAssignmentAuditPayload(assignment),
        },
      });
    }

    await updateFireCompatibilityPayload(operator.organizationId, id, fire.payload, {
      assignedUnit: unitName || undefined,
      assignedTeam: validated.notes || undefined,
      operationalStatus: validated.status === 'released' ? 'monitoring' : 'dispatched',
      dispatchAt: new Date().toISOString(),
      dispatchBy: operator.id,
    });

    await prisma.fireAudit.create({
      data: {
        organizationId: operator.organizationId,
        fireId: id,
        action: 'operational_update',
        actor: operator.id,
        reason: `Assignment created${unitName ? ` for ${unitName}` : ''}`,
        payload: toAssignmentAuditPayload(assignment),
      },
    });

    return ok(assignment, { status: 201 });
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
    const operator = await requireOperator(request, 'resource.assign');
    const { id } = await params;
    const validated = incidentAssignmentUpdateSchema.parse(await request.json());
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const assignment = await prisma.incidentAssignment.update({
      where: {
        id: validated.assignmentId,
        organizationId: operator.organizationId,
        fireId: id,
      },
      data: {
        status: validated.status,
        notes: validated.notes,
        releasedAt: validated.status === 'released' ? new Date() : undefined,
      },
      include: {
        unit: { include: { station: true } },
        asset: true,
      },
    });

    if (assignment.unitId && validated.status === 'released') {
      await releaseUnitIfReady(operator.organizationId, assignment.unitId);
      await prisma.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          unitId: assignment.unitId,
          action: 'unit_released',
          actor: operator.id,
          reason: `Unit released from incident ${id}`,
          payload: toAssignmentAuditPayload(assignment),
        },
      });
    } else if (assignment.unitId && validated.status) {
      await prisma.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          unitId: assignment.unitId,
          action: 'dispatch_status_updated',
          actor: operator.id,
          reason: `Dispatch status updated to ${validated.status}`,
          payload: toAssignmentAuditPayload(assignment),
        },
      });
    }

    if (validated.status === 'released') {
      await updateFireCompatibilityPayload(operator.organizationId, id, fire.payload, {
        operationalStatus: 'monitoring',
      });
    }

    await prisma.fireAudit.create({
      data: {
        organizationId: operator.organizationId,
        fireId: id,
        action: 'operational_update',
        actor: operator.id,
        reason: `Assignment ${validated.assignmentId} updated to ${validated.status || 'unchanged'}`,
        payload: toAssignmentAuditPayload(assignment),
      },
    });

    return ok(assignment);
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    if (error instanceof ZodError) return fail(400, 'Validation error', error.errors[0]?.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'resource.release');
    const { id } = await params;
    const assignmentId = request.nextUrl.searchParams.get('assignmentId');
    if (!assignmentId) return fail(400, 'Validation error', 'assignmentId is required');

    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const assignment = await prisma.incidentAssignment.update({
      where: { id: assignmentId, organizationId: operator.organizationId, fireId: id },
      data: {
        status: 'released',
        releasedAt: new Date(),
      },
      include: {
        unit: { include: { station: true } },
        asset: true,
      },
    });

    if (assignment.unitId) {
      await releaseUnitIfReady(operator.organizationId, assignment.unitId);
      await prisma.operationalAudit.create({
        data: {
          organizationId: operator.organizationId,
          unitId: assignment.unitId,
          action: 'unit_released',
          actor: operator.id,
          reason: `Unit released from incident ${id}`,
          payload: toAssignmentAuditPayload(assignment),
        },
      });
    }

    await updateFireCompatibilityPayload(operator.organizationId, id, fire.payload, {
      operationalStatus: 'monitoring',
    });

    await prisma.fireAudit.create({
      data: {
        organizationId: operator.organizationId,
        fireId: id,
        action: 'operational_update',
        actor: operator.id,
        reason: `Assignment ${assignmentId} released`,
        payload: toAssignmentAuditPayload(assignment),
      },
    });

    return ok(assignment);
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

async function releaseUnitIfReady(organizationId: string, unitId: string) {
  const activeMaintenance = await prisma.maintenanceRecord.count({
    where: { organizationId, unitId, status: { in: ['scheduled', 'in_progress'] } },
  });
  await prisma.operationalUnit.update({
    where: { id: unitId, organizationId },
    data: { status: activeMaintenance > 0 ? 'maintenance' : 'available' },
  });
}

async function updateFireCompatibilityPayload(
  organizationId: string,
  fireId: string,
  currentPayload: unknown,
  nextValues: Partial<FirePayload>
) {
  const payload = normalizePayload(currentPayload);
  const compactNextValues = Object.fromEntries(
    Object.entries(nextValues).filter(([, value]) => value !== undefined)
  ) as Partial<FirePayload>;
  const nextPayload = {
    ...payload,
    ...compactNextValues,
  } as unknown as FirePayload;

  await db.updateFire(fireId, organizationId, {
    payload: nextPayload,
    ...(nextValues.dispatchAt ? { dispatchedAt: new Date(nextValues.dispatchAt) } : {}),
    ...(nextValues.dispatchBy ? { dispatchedBy: nextValues.dispatchBy } : {}),
  });
}

function toAssignmentAuditPayload(assignment: {
  id: string;
  fireId: string;
  unitId: string | null;
  assetId: string | null;
  unitName: string | null;
  role: string;
  status: string;
  notes: string | null;
}) {
  return {
    assignmentId: assignment.id,
    fireId: assignment.fireId,
    unitId: assignment.unitId,
    assetId: assignment.assetId,
    unitName: assignment.unitName,
    role: assignment.role,
    status: assignment.status,
    notes: assignment.notes,
  };
}
