import { NextRequest } from 'next/server';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { fetchJurisdictionEarthquakes } from '@/lib/earthquakes';
import { rateLimit } from '@/lib/rate-limit';
import { guardFireApi } from '../_auth';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 20,
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;

    const earthquakes = await fetchJurisdictionEarthquakes();
    return ok(earthquakes, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    console.error('[API] Error fetching jurisdiction earthquakes:', error);
    return fail(500, 'No se pudo obtener la actividad sísmica', getErrorMessage(error));
  }
}
