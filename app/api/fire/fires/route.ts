import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { RATE_LIMITS } from '@/lib/constants';
import { created, fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { enrichFires } from '@/lib/fire-utils';
import { fetchOpenMeteoIncidentSnapshots } from '@/lib/incident-context';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { rateLimit } from '@/lib/rate-limit';
import { createFireSchema, firesQuerySchema } from '@/lib/validations';

const limiter = rateLimit({
  windowMs: RATE_LIMITS.WINDOW_MS,
  maxRequests: RATE_LIMITS.MAX_REQUESTS,
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;
    const authResponse = await guardFireApi(req);
    if (authResponse) return authResponse;
    const operator = await requireOperator(req);

    const searchParams = req.nextUrl.searchParams;
    const validated = firesQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      lifecycle: searchParams.get('lifecycle') || undefined,
      since: searchParams.get('since') || undefined,
      period: searchParams.get('period') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    const since = validated.since || getSinceFromPeriod(validated.period);
    const { fires, total } = await db.getFires({ organizationId: operator.organizationId, ...validated, since });
    return ok({
      items: enrichFires(fires as never),
      total,
      page: Math.floor(validated.offset / validated.limit) + 1,
      limit: validated.limit,
      totalPages: Math.ceil(total / validated.limit),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(400, 'Validation error', error.errors[0]?.message);
    }
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;

    const operator = await requireOperator(req, 'incident.report');
    const validated = createFireSchema.parse(await req.json());
    const context = await fetchOpenMeteoIncidentSnapshots({
      lat: validated.lat,
      lon: validated.lon,
      sources: [],
    });

    const fire = await db.createFire({
      organizationId: operator.organizationId,
      lat: validated.lat,
      lon: validated.lon,
      detectedAt: validated.detectedAt,
      status: 'unconfirmed',
      manual: true,
      confirmedBy: operator.id,
      dataFreshness: {
        manual: new Date().toISOString(),
        ...(context.weatherSnapshot?.observedAt ? { weather: context.weatherSnapshot.observedAt } : {}),
        ...(context.terrainSnapshot?.observedAt ? { terrain: context.terrainSnapshot.observedAt } : {}),
      },
      weatherSnapshot: context.weatherSnapshot,
      terrainSnapshot: context.terrainSnapshot,
      projectionSnapshot: context.projectionSnapshot,
      payload: {
        reportedBy: operator.id,
        manual: true,
        detectionSource: 'MANUAL',
        ...(validated.notes ? { notes: validated.notes } : {}),
      },
    });

    return created(fire, 'Fire created successfully');
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }
    if (error instanceof ZodError) {
      return fail(400, 'Validation error', error.errors[0]?.message);
    }
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function getSinceFromPeriod(period?: '24h' | '7d' | '30d' | '90d' | 'all') {
  if (!period || period === 'all') return undefined;
  const hoursByPeriod: Record<'24h' | '7d' | '30d' | '90d', number> = {
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24,
    '90d': 90 * 24,
  };
  return new Date(Date.now() - hoursByPeriod[period] * 3600000);
}
