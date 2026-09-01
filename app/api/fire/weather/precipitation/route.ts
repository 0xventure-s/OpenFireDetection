import { NextRequest } from 'next/server';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { fetchPrecipitationLayerMetadata } from '@/lib/precipitation';
import { rateLimit } from '@/lib/rate-limit';
import { guardFireApi } from '../../_auth';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await limiter(request);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;

    const metadata = await fetchPrecipitationLayerMetadata();
    return ok(metadata, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    console.error('[API] Error fetching precipitation layer metadata:', error);
    return fail(502, 'No se pudo leer la hora de la capa de precipitación', getErrorMessage(error));
  }
}
