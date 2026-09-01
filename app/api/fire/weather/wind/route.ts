import { NextRequest } from 'next/server';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { fetchOpenMeteoWindGrid } from '@/lib/open-meteo';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { guardFireApi } from '../../_auth';
import { summarizeWindLayer } from '@/lib/wind-layer';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;

    const points = await fetchOpenMeteoWindGrid(JURISDICTION_BBOX);

    return ok(
      {
        generatedAt: new Date().toISOString(),
        source: 'Open-Meteo Forecast API - viento 10 m',
        refreshMinutes: 10,
        summary: summarizeWindLayer(points),
        bbox: JURISDICTION_BBOX,
        count: points.length,
        points,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error: unknown) {
    console.error('[API] Error fetching wind layer:', error);
    return fail(500, 'Failed to fetch wind layer', getErrorMessage(error));
  }
}
