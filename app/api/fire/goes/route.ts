import { NextRequest, NextResponse } from 'next/server';
import { fetchGoesFdcfHotspots, getGoesStatus } from '@/lib/goes';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { rateLimit } from '@/lib/rate-limit';
import { fail, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 10,
});

/**
 * GET /api/fire/goes/latest
 * Get latest GOES-19 FDCF hotspot detections
 *
 * GOES-19 FDCF provides fire detections every 10 minutes
 * Bands: Fire mask, Temperature, Area, Radiative Power
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;

    const status = getGoesStatus();

    if (!status.enabled) {
      return NextResponse.json({
        success: true,
        data: {
          hotspots: [],
          status: 'disabled',
          reason: status.reason,
          message: 'GOES-19 detection requires Earth Engine service account configuration',
        },
      });
    }

    const result = await fetchGoesFdcfHotspots(JURISDICTION_BBOX);

    return ok({
      hotspots: result.hotspots,
      count: result.hotspots.length,
      bbox: JURISDICTION_BBOX,
      status: result.status,
      reason: result.reason,
      acquisitionTime: result.acquisitionTime,
      usedFallback: result.usedFallback,
      cadence: `${result.cadenceMinutes} minutes`,
      maxFallbackMinutes: result.maxFallbackMinutes,
      source: result.dataset,
      rawProductUrl: result.rawProductUrl,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error fetching GOES data:', errorMessage);
    return fail(500, 'Failed to fetch GOES data', errorMessage);
  }
}
