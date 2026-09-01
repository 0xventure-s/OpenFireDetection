import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/constants';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../../_auth';
import { requireOperator } from '@/lib/operator-auth';

const limiter = rateLimit({
  windowMs: RATE_LIMITS.WINDOW_MS,
  maxRequests: RATE_LIMITS.MAX_REQUESTS,
});

/**
 * GET /api/fire/fires/[id]/history
 * Get audit history for a fire
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req, 'audit.read');
    if (authResponse) return authResponse;
    const operator = await requireOperator(req, 'audit.read');

    const { id } = await params;

    // Check if fire exists
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) {
      return fail(404, 'Not found', 'Fire not found');
    }

    // Get history
    const history = await db.getFireHistory(id, operator.organizationId);

    return ok({
      fireId: id,
      history,
    });
  } catch (error: unknown) {
    console.error('[API] Error fetching fire history:', error);

    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
