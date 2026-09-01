import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/constants';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../_auth';
import { enrichFire } from '@/lib/fire-utils';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';

const limiter = rateLimit({
  windowMs: RATE_LIMITS.WINDOW_MS,
  maxRequests: RATE_LIMITS.MAX_REQUESTS,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request);

    const { id } = await params;

    const fire = await db.getFireById(id, operator.organizationId);

    if (!fire) {
      return fail(404, 'Fire not found');
    }

    return ok({ fire: enrichFire(fire as never) });
  } catch (error) {
    console.error('Error fetching fire:', error);
    return fail(500, 'Failed to fetch fire', getErrorMessage(error));
  }
}

/**
 * DELETE /api/fire/fires/[id]
 * Archive a fire while preserving its operational history.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) return rateLimitResponse;

    const operator = await requireOperator(request, 'incident.archive');
    const { id } = await params;

    // Check if fire exists
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) {
      return fail(404, 'Not found', 'Fire not found');
    }

    const deletedFire = await db.deleteFire(id, operator.organizationId, operator.id);

    return ok(deletedFire);
  } catch (error: unknown) {
    console.error('[API] Error deleting fire:', error);

    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }

    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
