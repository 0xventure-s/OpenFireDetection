import { NextRequest } from 'next/server';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { fail, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { fetchHlsScenes, getHlsStatus } from '@/lib/hls';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 10,
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;

    const status = getHlsStatus();
    if (!status.enabled) {
      return ok({
        scenes: [],
        count: 0,
        status: 'disabled',
        reason: 'HLS layer is disabled',
        bbox: JURISDICTION_BBOX,
      });
    }

    const result = await fetchHlsScenes(JURISDICTION_BBOX);

    return ok({
      scenes: result.scenes,
      count: result.scenes.length,
      status: result.status,
      reason: result.reason,
      bbox: result.bbox,
      collections: result.collections,
      lookbackDays: result.lookbackDays,
      latestSceneTime: result.latestSceneTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error fetching HLS scenes:', message);
    return fail(500, 'Failed to fetch HLS scenes', message);
  }
}
