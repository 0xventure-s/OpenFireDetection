import { NextRequest } from 'next/server';
import { fetchFirmsByBBox, toGeoJSON } from '@/lib/firms';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { rateLimit } from '@/lib/rate-limit';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';

const limiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
});

/**
 * GET /api/fire/firms
 * Proxy endpoint for FIRMS data (keeps API key secure)
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const daysBack = parseInt(searchParams.get('days') || '1');
    const format = searchParams.get('format') || 'json';

    // Validate days
    if (daysBack < 1 || daysBack > 10) {
      return fail(400, 'Invalid parameter', 'days must be between 1 and 10');
    }

    // Fetch FIRMS data
    const points = await fetchFirmsByBBox(JURISDICTION_BBOX, daysBack);

    // Return in requested format
    if (format === 'geojson') {
      return ok(toGeoJSON(points));
    }

    return ok({
      points,
      count: points.length,
      bbox: JURISDICTION_BBOX,
      daysBack,
      products: Array.from(new Set(points.map((point) => point.sourceProduct).filter(Boolean))),
    });
  } catch (error: unknown) {
    console.error('[API] Error fetching FIRMS data:', error);
    return fail(500, 'Failed to fetch FIRMS data', getErrorMessage(error));
  }
}
