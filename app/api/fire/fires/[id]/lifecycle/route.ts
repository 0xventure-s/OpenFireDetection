import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { enrichFire } from '@/lib/fire-utils';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { lifecycleFireSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'incident.close');
    const { id } = await params;
    const validated = lifecycleFireSchema.parse(await request.json());

    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const now = new Date();
    const updatedFire = await db.updateFire(
      id,
      operator.organizationId,
      {
        lifecycleStatus: validated.lifecycleStatus,
        closedAt: validated.lifecycleStatus === 'active' ? null : now,
      },
      {
        action: validated.lifecycleStatus === 'archived' ? 'deleted' : 'operational_update',
        actor: operator.id,
        reason: validated.reason || `Lifecycle changed to ${validated.lifecycleStatus}`,
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
