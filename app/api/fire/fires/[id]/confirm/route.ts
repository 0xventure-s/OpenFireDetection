import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { RATE_LIMITS } from '@/lib/constants';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { rateLimit } from '@/lib/rate-limit';
import { confirmFireSchema } from '@/lib/validations';

const limiter = rateLimit({
  windowMs: RATE_LIMITS.WINDOW_MS,
  maxRequests: RATE_LIMITS.MAX_REQUESTS,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;

    const operator = await requireOperator(req, 'incident.confirm');
    const { id } = await params;
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Not found', 'Fire not found');

    const validated = confirmFireSchema.parse(await req.json());
    const updatedFire = await db.updateFire(
      id,
      operator.organizationId,
      {
        confirmed: validated.confirmed,
        confirmedBy: operator.id,
        confirmedAt: new Date(),
        status: validated.confirmed ? 'confirmed' : 'false_positive',
        lifecycleStatus: validated.confirmed ? 'active' : 'closed',
        reviewedAt: new Date(),
        reviewedBy: operator.id,
        closedAt: validated.confirmed ? null : new Date(),
      },
      {
        action: validated.confirmed ? 'confirmed' : 'rejected',
        actor: operator.id,
        reason:
          validated.reason ||
          (validated.confirmed ? 'Manually confirmed by operator' : 'Marked as false positive by operator'),
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
