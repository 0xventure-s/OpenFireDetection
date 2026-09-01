import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { extinguishFireSchema } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'incident.close');
    const { id } = await params;
    const validated = extinguishFireSchema.parse(await request.json());

    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const updatedFire = await db.updateFire(
      id,
      operator.organizationId,
      {
        status: 'extinguished',
        lifecycleStatus: 'closed',
        extinguishedBy: operator.id,
        extinguishedAt: new Date(),
        closedAt: new Date(),
      },
      {
        action: 'extinguished',
        actor: operator.id,
        reason: validated.reason || 'Fire marked as extinguished by operator',
      }
    );

    return ok(updatedFire);
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
