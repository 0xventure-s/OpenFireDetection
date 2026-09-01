import { NextRequest } from 'next/server';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { fetchJurisdictionForecast } from '@/lib/open-meteo';
import { rateLimit } from '@/lib/rate-limit';
import { guardFireApi } from '../../_auth';

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

    const forecast = await fetchJurisdictionForecast();
    return ok(forecast, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    console.error('[API] Error fetching jurisdiction weather forecast:', error);
    return fail(500, 'No se pudo obtener el pronóstico', getErrorMessage(error));
  }
}
