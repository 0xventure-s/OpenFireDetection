import { NextRequest } from 'next/server';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { fail, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { fetchGoesLightningFlashes, getLightningStatus } from '@/lib/lightning';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 10,
});

/**
 * GET /api/fire/lightning
 * GOES-19 GLM lightning flashes over la jurisdicción.
 *
 * This is a risk/ignition layer, not a fire-confirmation source.
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;

    const status = getLightningStatus();
    if (!status.enabled) {
      return ok({
        flashes: [],
        count: 0,
        bbox: JURISDICTION_BBOX,
        status: 'disabled',
        reason: 'GOES GLM lightning layer is disabled',
        source: status.dataset,
      });
    }

    const result = await fetchGoesLightningFlashes(JURISDICTION_BBOX);

    return ok({
      flashes: result.flashes,
      count: result.count,
      bbox: JURISDICTION_BBOX,
      status: result.status,
      reason: result.reason,
      acquisitionTime: result.acquisitionTime,
      cadence: `${result.cadenceSeconds} seconds`,
      maxFallbackMinutes: result.maxFallbackMinutes,
      filesRead: result.filesRead,
      source: result.dataset,
      role: 'risk',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error fetching GLM lightning data:', message);
    return fail(500, 'Failed to fetch lightning data', message);
  }
}
