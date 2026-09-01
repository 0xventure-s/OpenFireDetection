import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS } from '@/lib/constants';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { requireOperator } from '@/lib/operator-auth';

const limiter = rateLimit({
  windowMs: RATE_LIMITS.WINDOW_MS,
  maxRequests: RATE_LIMITS.MAX_REQUESTS,
});

/**
 * GET /api/fire/stats
 * Get statistics about fires
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;
    const operator = await requireOperator(req);

    const stats = await db.getStats(operator.organizationId);

    return ok(stats);
  } catch (error: unknown) {
    console.error('[API] Error fetching stats:', error);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
