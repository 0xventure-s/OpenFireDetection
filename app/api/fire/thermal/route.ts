import { NextRequest } from 'next/server';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { fail, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { rateLimit } from '@/lib/rate-limit';
import { fetchThermalAnomalies } from '@/lib/thermal';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 15,
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;

    const result = await fetchThermalAnomalies(JURISDICTION_BBOX);

    return ok({
      ...result,
      count: result.anomalies.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error fetching thermal layer:', message);
    return fail(500, 'Failed to fetch thermal layer', message);
  }
}
