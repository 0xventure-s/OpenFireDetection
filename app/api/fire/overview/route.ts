import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { enrichFires, derivePriority, getDetectionCount } from '@/lib/fire-utils';
import { isPointInJurisdiction } from '@/lib/jurisdiction';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { DataFreshness, Fire, FireStatus, IncidentPriority, LifecycleStatus } from '@/types';
import { requireOperator } from '@/lib/operator-auth';

const fireStatuses: FireStatus[] = ['unconfirmed', 'probable', 'confirmed', 'false_positive', 'extinguished'];
const priorities: IncidentPriority[] = ['low', 'medium', 'high', 'critical'];
const lifecycles: LifecycleStatus[] = ['active', 'closed', 'archived', 'test'];

export async function GET(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request);

    const now = Date.now();
    const last24h = new Date(now - 24 * 3600000);

    const allRaw = (
      await prisma.incident.findMany({
        where: {
          organizationId: operator.organizationId,
          lat: {
            gte: JURISDICTION_BBOX.south,
            lte: JURISDICTION_BBOX.north,
          },
          lon: {
            gte: JURISDICTION_BBOX.west,
            lte: JURISDICTION_BBOX.east,
          },
        },
        orderBy: { detectedAt: 'desc' },
      })
    ).filter((fire) => isPointInJurisdiction(fire.lat, fire.lon));

    const active = enrichFires(allRaw.filter((fire) => fire.lifecycleStatus === 'active') as unknown as Fire[]);
    const recent = enrichFires(
      allRaw
        .filter((fire) => fire.lifecycleStatus === 'active' && fire.detectedAt.getTime() >= last24h.getTime())
        .slice(0, 10) as unknown as Fire[]
    );
    const totalsByLifecycle = Object.fromEntries(lifecycles.map((status) => [status, 0])) as Record<LifecycleStatus, number>;
    for (const fire of allRaw) {
      totalsByLifecycle[fire.lifecycleStatus as LifecycleStatus] += 1;
    }

    const byStatus = Object.fromEntries(fireStatuses.map((status) => [status, 0])) as Record<FireStatus, number>;
    const byPriority = Object.fromEntries(priorities.map((priority) => [priority, 0])) as Record<IncidentPriority, number>;

    for (const fire of active) {
      byStatus[fire.status] += 1;
      byPriority[derivePriority(fire)] += 1;
    }

    const confirmedOrProbable = active.filter((fire) => fire.status === 'confirmed' || fire.status === 'probable');
    const reviewed = active.filter((fire) => fire.reviewedAt);
    const dispatched = active.filter((fire) => fire.dispatchedAt || fire.dispatchAt);
    const falsePositive = active.filter((fire) => fire.status === 'false_positive').length;
    const missingWeather = active.filter((fire) => !fire.weatherSnapshot).length;

    const overview = {
      generatedAt: new Date(now).toISOString(),
      totals: {
        ...totalsByLifecycle,
        last24h: active.filter((fire) => new Date(fire.detectedAt).getTime() >= last24h.getTime()).length,
        confirmedOrProbable: confirmedOrProbable.length,
        unreviewedConfirmedOrProbable: confirmedOrProbable.filter((fire) => !fire.reviewedAt).length,
        missingWeather,
        falsePositiveRate: active.length ? (falsePositive / active.length) * 100 : 0,
        avgReviewMinutes: averageMinutesFromDetection(reviewed, 'reviewedAt'),
        avgDispatchMinutes: averageMinutesFromDetection(dispatched, 'dispatchedAt'),
      },
      byPriority,
      byStatus,
      freshness: buildFreshness(active),
      topZones: buildTopZones(active),
      recent,
    };

    return ok(overview);
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function averageMinutesFromDetection(fires: Fire[], field: 'reviewedAt' | 'dispatchedAt') {
  if (fires.length === 0) return 0;
  const total = fires.reduce((sum, fire) => {
    const endValue = field === 'dispatchedAt' ? fire.dispatchedAt || fire.dispatchAt : fire.reviewedAt;
    if (!endValue) return sum;
    return sum + (new Date(endValue).getTime() - new Date(fire.detectedAt).getTime()) / 60000;
  }, 0);
  return Math.max(0, total / fires.length);
}

function buildFreshness(fires: Fire[]): DataFreshness {
  const freshness: DataFreshness = {};
  const assignLatest = (key: keyof DataFreshness, value?: string) => {
    if (!value) return;
    if (!freshness[key] || new Date(value).getTime() > new Date(String(freshness[key])).getTime()) {
      freshness[key] = value;
    }
  };

  for (const fire of fires) {
    assignLatest('lastScan', new Date(fire.updatedAt).toISOString());
    if (fire.manual) assignLatest('manual', new Date(fire.createdAt).toISOString());
    for (const source of fire.sources || []) {
      if (source.source === 'FIRMS') {
        assignLatest('firms', source.ts);
        assignLatest('firmsPolar', source.ts);
      }
      if (source.source === 'GOES') assignLatest('goes', source.ts);
      if (source.layer === 'goes-fdcf') assignLatest('goesFdcf', source.ts);
      if (source.layer === 'firms-goes-nrt') assignLatest('firmsGeo', source.ts);
      if (source.layer === 'viirs-noaa21' || source.layer === 'viirs-noaa20' || source.layer === 'viirs-snpp') {
        assignLatest('viirs', source.ts);
      }
      if (source.layer === 'modis') assignLatest('modis', source.ts);
      if (source.source === 'SENTINEL3' || source.layer === 'sentinel3-slstr') assignLatest('sentinel3', source.ts);
      if (source.source === 'HLS' || source.layer === 'sentinel2-hls' || source.layer === 'landsat-hls') assignLatest('hls', source.ts);
      if (source.source === 'THERMAL' || source.layer === 'thermal-anomaly') assignLatest('thermal', source.ts);
      if (source.source === 'MANUAL') assignLatest('manual', source.ts);
    }
  }

  return freshness;
}

function buildTopZones(fires: Fire[]) {
  const zones = new Map<string, number>();
  for (const fire of fires) {
    const label = getApproxZone(fire.lat, fire.lon);
    zones.set(label, (zones.get(label) || 0) + getDetectionCount(fire));
  }
  return Array.from(zones.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function getApproxZone(lat: number, lon: number) {
  const width = JURISDICTION_BBOX.east - JURISDICTION_BBOX.west;
  const height = JURISDICTION_BBOX.north - JURISDICTION_BBOX.south;
  if (lon < JURISDICTION_BBOX.west + width / 3) return 'Oeste';
  if (lon > JURISDICTION_BBOX.east - width / 3) return 'Este';
  if (lat > JURISDICTION_BBOX.north - height / 3) return 'Norte';
  if (lat < JURISDICTION_BBOX.south + height / 3) return 'Sur';
  return 'Centro';
}
