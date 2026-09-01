import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { enrichFire, normalizePayload } from '@/lib/fire-utils';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { operateFireSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'incident.review');
    const { id } = await params;
    const validated = operateFireSchema.parse(await request.json());

    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const payload = normalizePayload(fire.payload);
    const nextPayload = {
      ...payload,
      ...(validated.operationalStatus ? { operationalStatus: validated.operationalStatus } : {}),
      ...(validated.priority ? { priority: validated.priority } : {}),
      ...(validated.assignedUnit ? { assignedUnit: validated.assignedUnit } : {}),
      ...(validated.assignedTeam ? { assignedTeam: validated.assignedTeam } : {}),
      ...(validated.riskSummary ? { riskSummary: validated.riskSummary } : {}),
      ...(validated.reviewed ? { reviewedAt: new Date().toISOString(), reviewedBy: operator.id } : {}),
      ...(validated.dispatch ? { dispatchAt: new Date().toISOString(), dispatchBy: operator.id } : {}),
    };

    const now = new Date();
    const updatedFire = await db.updateFire(
      id,
      operator.organizationId,
      {
        payload: nextPayload,
        ...(validated.reviewed ? { reviewedAt: now, reviewedBy: operator.id } : {}),
        ...(validated.dispatch ? { dispatchedAt: now, dispatchedBy: operator.id } : {}),
        ...(validated.operationalStatus === 'closed' ? { lifecycleStatus: 'closed', closedAt: now } : {}),
      },
      {
        action: 'operational_update',
        actor: operator.id,
        reason: `Operational status updated to ${nextPayload.operationalStatus || 'unchanged'}`,
      }
    );

    return ok(enrichFire(updatedFire as never));
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }
    if (error instanceof ZodError) {
      return fail(400, 'Validation error', error.errors[0]?.message);
    }
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
