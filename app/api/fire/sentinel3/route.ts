import { NextRequest } from 'next/server';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { fail, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { fetchSentinel3FrpHotspots, getSentinel3Status } from '@/lib/sentinel3';
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

    const status = getSentinel3Status();
    if (!status.enabled) {
      return ok({
        hotspots: [],
        products: [],
        count: 0,
        status: 'disabled',
        reason: status.reason,
        source: status.dataset,
        collection: status.collection,
      });
    }

    const result = await fetchSentinel3FrpHotspots(JURISDICTION_BBOX);

    return ok({
      hotspots: result.hotspots,
      products: result.products,
      count: result.hotspots.length,
      bbox: JURISDICTION_BBOX,
      status: result.status,
      reason: result.reason,
      source: result.dataset,
      collection: result.collection,
      lookbackHours: result.lookbackHours,
      acquisitionTime: result.acquisitionTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error fetching Sentinel-3 FRP data:', message);
    return fail(500, 'Failed to fetch Sentinel-3 FRP data', message);
  }
}
