import { db } from './db';
import { queryByBBoxAndTime, parseFirmsDateTime } from './firms';
import { detectHeatFromGOES } from './goes';
import { haversineDistance } from './geo';
import { JURISDICTION_BBOX, DETECTION_THRESHOLDS, FIRE_STATUS } from './constants';
import { isPointInJurisdiction } from './jurisdiction';
import {
  DataFreshness,
  DetectionResult,
  Fire,
  FireSource,
  FireStatus,
  FirmsPoint,
  GoesHotspot,
  TerrainSnapshot,
  WeatherSnapshot,
} from '@/types';
import { dedupeSources } from './fire-utils';
import { fetchOpenMeteoIncidentSnapshots, shouldRefreshWeatherSnapshot } from './incident-context';
import type { ExternalIncidentSnapshots } from './incident-context';
import { isFirmsGeostationaryProduct } from './satellite-layers';
import { fetchSentinel3FrpHotspots } from './sentinel3';
import type { Sentinel3FrpHotspot } from '@/types';
import { COMMUNITY_ORGANIZATION_ID } from './tenancy';

function toFireSourceFromFirms(point: FirmsPoint, detectedAt: Date): FireSource {
  const isGeostationary = isGeostationaryFirmsPoint(point);

  return {
    source: isGeostationary ? 'GOES' : 'FIRMS',
    layer: point.sourceLayer,
    sourceProduct: point.sourceProduct,
    confidence: point.confidence,
    ts: detectedAt.toISOString(),
    satellite: point.satellite,
    brightness: point.brightness,
    frp: point.frp,
  };
}

function toFireSourceFromGoes(hotspot: GoesHotspot): FireSource {
  return {
    source: 'GOES',
    layer: hotspot.layer || 'goes-fdcf',
    sourceProduct: hotspot.sourceProduct || 'NOAA/GOES/19/FDCF',
    ts: hotspot.ts,
    satellite: hotspot.satellite,
    heat: hotspot.heat,
    frp: hotspot.frp,
    prob: hotspot.confidence,
    maskCode: hotspot.maskCode,
    areaM2: hotspot.areaM2,
  };
}

function toFireSourceFromSentinel3(hotspot: Sentinel3FrpHotspot): FireSource {
  return {
    source: 'SENTINEL3',
    layer: 'sentinel3-slstr',
    sourceProduct: hotspot.sourceProduct || 'EO:EUM:DAT:0417',
    confidence: hotspot.confidence,
    ts: hotspot.ts,
    satellite: hotspot.satellite,
    frp: hotspot.frp,
  };
}

function deriveStatusFromSources(
  currentStatus: FireStatus,
  sources: FireSource[],
  latestSource?: FireSource
): FireStatus {
  if (currentStatus === FIRE_STATUS.FALSE_POSITIVE || currentStatus === FIRE_STATUS.EXTINGUISHED) {
    return currentStatus;
  }

  const hasStrongThermalConfirmation = sources.some(
    (source) =>
      (source.source === 'FIRMS' || source.source === 'SENTINEL3') &&
      source.confidence === 'high' &&
      (source.frp || 0) >= DETECTION_THRESHOLDS.MIN_FRP_MW
  );

  if (hasStrongThermalConfirmation) {
    return FIRE_STATUS.CONFIRMED;
  }

  const detectionCount = sources.length;
  const goOnly = sources.every((source) => source.source === 'GOES');
  if (goOnly) {
    return detectionCount >= DETECTION_THRESHOLDS.PROBABLE_REPEATS
      ? FIRE_STATUS.PROBABLE
      : FIRE_STATUS.UNCONFIRMED;
  }

  if (latestSource?.source === 'FIRMS' && detectionCount >= DETECTION_THRESHOLDS.PROBABLE_REPEATS) {
    return FIRE_STATUS.PROBABLE;
  }

  return currentStatus;
}

async function upsertDetection(
  organizationId: string,
  lat: number,
  lon: number,
  detectedAt: Date,
  source: FireSource,
  payload: Record<string, unknown>,
  actor: string,
  result: DetectionResult
) {
  if (!isPointInJurisdiction(lat, lon)) {
    return;
  }

  const nearbyFires = await db.findNearbyFires({
    organizationId,
    lat,
    lon,
    radiusKm: DETECTION_THRESHOLDS.NEARBY_RADIUS_KM,
    withinMinutes: DETECTION_THRESHOLDS.NEARBY_TIME_MINUTES,
    referenceTime: detectedAt,
  });

  if (nearbyFires.length === 0) {
    const newStatus =
      source.source === 'FIRMS' && source.confidence === 'high' && (source.frp || 0) >= DETECTION_THRESHOLDS.MIN_FRP_MW
        ? FIRE_STATUS.CONFIRMED
        : FIRE_STATUS.UNCONFIRMED;
    const sources = [source];
    const context = await fetchOpenMeteoIncidentSnapshots({ lat, lon, sources });

    const fire = await db.createFire({
      organizationId,
      lat,
      lon,
      detectedAt,
      status: newStatus,
      confirmed: newStatus === FIRE_STATUS.CONFIRMED,
      confirmedBy: newStatus === FIRE_STATUS.CONFIRMED ? actor : actor,
      confirmedAt: newStatus === FIRE_STATUS.CONFIRMED ? new Date() : undefined,
      sources,
      payload: {
        detectionSource: source.source,
        detectionLayer: source.layer ?? null,
        detectionProduct: source.sourceProduct ?? null,
        ...payload,
      },
      dataFreshness: mergeContextFreshness(buildDataFreshness(sources), context),
      weatherSnapshot: context.weatherSnapshot,
      terrainSnapshot: context.terrainSnapshot,
      projectionSnapshot: context.projectionSnapshot,
      manual: false,
    });

    result.new++;
    if (newStatus === FIRE_STATUS.CONFIRMED) {
      result.confirmed++;
    }
    result.fires.push(fire as unknown as Fire);
    return;
  }

  const existingFire = nearbyFires[0];
  const existingSources = existingFire.sources as unknown as FireSource[];
  const updatedSources = dedupeSources([...existingSources, source]);

  if (updatedSources.length === existingSources.length) {
    return;
  }

  const nextStatus = deriveStatusFromSources(existingFire.status as FireStatus, updatedSources, source);
  const context = shouldRefreshWeatherSnapshot(asWeatherSnapshot(existingFire.weatherSnapshot))
    ? await fetchOpenMeteoIncidentSnapshots({
        lat: existingFire.lat,
        lon: existingFire.lon,
        sources: updatedSources,
        weatherSnapshot: asWeatherSnapshot(existingFire.weatherSnapshot),
        terrainSnapshot: asTerrainSnapshot(existingFire.terrainSnapshot),
      })
    : {};
  const updatedFire = await db.updateFire(
    existingFire.id,
    organizationId,
    {
      sources: updatedSources,
      status: nextStatus,
      confirmed: nextStatus === FIRE_STATUS.CONFIRMED,
      confirmedBy: nextStatus === FIRE_STATUS.CONFIRMED ? actor : existingFire.confirmedBy,
      confirmedAt: nextStatus === FIRE_STATUS.CONFIRMED ? new Date() : existingFire.confirmedAt,
      payload: {
        ...(existingFire.payload as Record<string, unknown>),
        lastDetectionSource: source.source,
        lastDetectionLayer: source.layer ?? null,
        lastDetectionProduct: source.sourceProduct ?? null,
      },
      dataFreshness: mergeContextFreshness(
        {
          ...(existingFire.dataFreshness as DataFreshness),
          ...buildDataFreshness(updatedSources),
        },
        context
      ),
      weatherSnapshot: context.weatherSnapshot,
      terrainSnapshot: context.terrainSnapshot,
      projectionSnapshot: context.projectionSnapshot,
    },
    {
      action: nextStatus === FIRE_STATUS.CONFIRMED ? 'confirmed' : 'updated',
      actor,
      reason:
        nextStatus === FIRE_STATUS.CONFIRMED
          ? `Confirmed by ${source.source} high-confidence detection`
          : `Merged ${source.source} detection into existing fire`,
    }
  );

  result.updated++;
  if (nextStatus === FIRE_STATUS.CONFIRMED && existingFire.status !== FIRE_STATUS.CONFIRMED) {
    result.confirmed++;
  }
  result.fires.push(updatedFire as unknown as Fire);
}

/**
 * Main detection function for la jurisdicción
 * Rules:
 * - GOES creates or reinforces early detections.
 * - FIRMS can create new detections, promote to probable, or confirm.
 * - GOES alone never confirms a fire.
 */
export async function detectOnJurisdiction(
  organizationId = COMMUNITY_ORGANIZATION_ID
): Promise<DetectionResult> {
  const result: DetectionResult = {
    scannedAt: new Date().toISOString(),
    new: 0,
    updated: 0,
    confirmed: 0,
    closed: 0,
    fires: [],
    summary: '',
  };

  try {
    const [goesHotspots, firmsPoints, sentinel3Result] = await Promise.all([
      detectHeatFromGOES(JURISDICTION_BBOX),
      queryByBBoxAndTime(JURISDICTION_BBOX, DETECTION_THRESHOLDS.FIRMS_MATCH_HOURS),
      fetchSentinel3FrpHotspots(JURISDICTION_BBOX),
    ]);
    const provincialGoesHotspots = goesHotspots.filter((hotspot) =>
      isPointInJurisdiction(hotspot.lat, hotspot.lon)
    );
    const provincialFirmsPoints = firmsPoints.filter((point) =>
      isPointInJurisdiction(point.latitude, point.longitude)
    );
    const provincialSentinel3Hotspots = sentinel3Result.hotspots.filter((hotspot) =>
      isPointInJurisdiction(hotspot.lat, hotspot.lon)
    );

    for (const hotspot of provincialGoesHotspots) {
      await upsertDetection(
        organizationId,
        hotspot.lat,
        hotspot.lon,
        new Date(hotspot.ts),
        toFireSourceFromGoes(hotspot),
        { goes: hotspot },
        'system:goes',
        result
      );
    }

    for (const point of provincialFirmsPoints) {
      const detectedAt = parseFirmsDateTime(point.acq_date, point.acq_time);
      await upsertDetection(
        organizationId,
        point.latitude,
        point.longitude,
        detectedAt,
        toFireSourceFromFirms(point, detectedAt),
        { firms: point },
        isGeostationaryFirmsPoint(point) ? 'system:firms-goes' : 'system:firms',
        result
      );
    }

    for (const hotspot of provincialSentinel3Hotspots) {
      await upsertDetection(
        organizationId,
        hotspot.lat,
        hotspot.lon,
        new Date(hotspot.ts),
        toFireSourceFromSentinel3(hotspot),
        { sentinel3: hotspot },
        'system:sentinel3',
        result
      );
    }

    const confirmingFirmsPoints = provincialFirmsPoints.filter((point) => !isGeostationaryFirmsPoint(point));
    await crossMatchExistingFires(organizationId, confirmingFirmsPoints);
    const weatherUpdated = await refreshActiveFireWeather(organizationId);
    const stale = await db.closeStaleUnactionedFires(organizationId);
    result.closed = stale.closed;

    result.summary = generateSummary(result, provincialGoesHotspots.length, provincialFirmsPoints, provincialSentinel3Hotspots.length);
    if (weatherUpdated > 0) {
      result.summary += ` | meteo: ${weatherUpdated} actualizados`;
    }
    return result;
  } catch (error) {
    console.error('[DETECTION] Error during detection:', error);
    throw error;
  }
}

async function crossMatchExistingFires(organizationId: string, firmsPoints: FirmsPoint[]): Promise<void> {
  const since = new Date(Date.now() - 24 * 3600000);
  const { fires } = await db.getFires({
    organizationId,
    since,
    limit: 200,
  });

  const candidates = fires.filter(
    (fire) => fire.status === FIRE_STATUS.UNCONFIRMED || fire.status === FIRE_STATUS.PROBABLE
  );

  for (const fire of candidates) {
    const matchingPoints = firmsPoints.filter((point) => {
      const distance = haversineDistance(fire.lat, fire.lon, point.latitude, point.longitude);
      return distance <= DETECTION_THRESHOLDS.FIRMS_MATCH_RADIUS_KM;
    });

    if (matchingPoints.length === 0 || fire.status === FIRE_STATUS.CONFIRMED) {
      continue;
    }

    const updatedSources = dedupeSources([
      ...(fire.sources as unknown as FireSource[]),
      ...matchingPoints.map((point) =>
        toFireSourceFromFirms(point, parseFirmsDateTime(point.acq_date, point.acq_time))
      ),
    ]);
    const context = shouldRefreshWeatherSnapshot(asWeatherSnapshot(fire.weatherSnapshot))
      ? await fetchOpenMeteoIncidentSnapshots({
          lat: fire.lat,
          lon: fire.lon,
          sources: updatedSources,
          weatherSnapshot: asWeatherSnapshot(fire.weatherSnapshot),
          terrainSnapshot: asTerrainSnapshot(fire.terrainSnapshot),
        })
      : {};

    await db.updateFire(
      fire.id,
      organizationId,
      {
        status: FIRE_STATUS.CONFIRMED,
        confirmed: true,
        confirmedBy: 'system:firms',
        confirmedAt: new Date(),
        sources: updatedSources,
        dataFreshness: mergeContextFreshness(
          {
            ...(fire.dataFreshness as DataFreshness),
            ...buildDataFreshness(updatedSources),
          },
          context
        ),
        weatherSnapshot: context.weatherSnapshot,
        terrainSnapshot: context.terrainSnapshot,
        projectionSnapshot: context.projectionSnapshot,
      },
      {
        action: 'confirmed',
        actor: 'system:firms',
        reason: `Cross-matched with ${matchingPoints.length} FIRMS detection(s)`,
      }
    );
  }
}

async function refreshActiveFireWeather(organizationId: string): Promise<number> {
  const { fires } = await db.getFires({
    organizationId,
    limit: 100,
  });

  const candidates = fires
    .filter((fire) => fire.status !== FIRE_STATUS.FALSE_POSITIVE && fire.status !== FIRE_STATUS.EXTINGUISHED)
    .filter((fire) => shouldRefreshWeatherSnapshot(asWeatherSnapshot(fire.weatherSnapshot)))
    .slice(0, 10);

  const updates = await Promise.all(
    candidates.map(async (fire) => {
      try {
        const context = await fetchOpenMeteoIncidentSnapshots({
          lat: fire.lat,
          lon: fire.lon,
          sources: fire.sources as unknown as FireSource[],
          weatherSnapshot: asWeatherSnapshot(fire.weatherSnapshot),
          terrainSnapshot: asTerrainSnapshot(fire.terrainSnapshot),
        });

        if (!context.weatherSnapshot && !context.terrainSnapshot && !context.projectionSnapshot) {
          return 0;
        }

        await db.updateFire(fire.id, organizationId, {
          dataFreshness: mergeContextFreshness((fire.dataFreshness as DataFreshness) || {}, context),
          weatherSnapshot: context.weatherSnapshot,
          terrainSnapshot: context.terrainSnapshot,
          projectionSnapshot: context.projectionSnapshot,
        });
        return 1;
      } catch (error) {
        console.warn('[WEATHER] Failed to refresh incident weather', { fireId: fire.id, error });
        return 0;
      }
    })
  );

  return updates.reduce<number>((sum, value) => sum + value, 0);
}

function buildDataFreshness(sources: FireSource[]): DataFreshness {
  const scannedAt = new Date().toISOString();
  const freshness: DataFreshness = { scan: scannedAt, lastScan: scannedAt };
  for (const source of sources) {
    if (source.source === 'FIRMS') {
      freshness.firms = source.ts;
      freshness.firmsPolar = source.ts;
    }
    if (source.source === 'GOES') freshness.goes = source.ts;
    if (source.layer === 'goes-fdcf') freshness.goesFdcf = source.ts;
    if (source.layer === 'firms-goes-nrt') freshness.firmsGeo = source.ts;
    if (source.layer === 'viirs-noaa21' || source.layer === 'viirs-noaa20' || source.layer === 'viirs-snpp') {
      freshness.viirs = source.ts;
    }
    if (source.layer === 'modis') freshness.modis = source.ts;
    if (source.source === 'SENTINEL3' || source.layer === 'sentinel3-slstr') freshness.sentinel3 = source.ts;
    if (source.source === 'MANUAL') freshness.manual = source.ts;
  }
  return freshness;
}

function mergeContextFreshness(freshness: DataFreshness, context: ExternalIncidentSnapshots): DataFreshness {
  return {
    ...freshness,
    ...(context.weatherSnapshot?.observedAt ? { weather: context.weatherSnapshot.observedAt } : {}),
    ...(context.terrainSnapshot?.observedAt ? { terrain: context.terrainSnapshot.observedAt } : {}),
  };
}

function asWeatherSnapshot(value: unknown) {
  return value as WeatherSnapshot | null | undefined;
}

function asTerrainSnapshot(value: unknown) {
  return value as TerrainSnapshot | null | undefined;
}

function generateSummary(
  result: DetectionResult,
  directGoesCount: number,
  firmsPoints: FirmsPoint[],
  sentinel3Count: number
): string {
  const parts: string[] = [];

  if (result.new > 0) parts.push(`${result.new} nuevos`);
  if (result.updated > 0) parts.push(`${result.updated} actualizados`);
  if (result.confirmed > 0) parts.push(`${result.confirmed} confirmados`);
  if ((result.closed || 0) > 0) parts.push(`${result.closed} cerrados a historial`);
  if (parts.length === 0) parts.push('sin cambios');

  const firmsGeoCount = firmsPoints.filter(isGeostationaryFirmsPoint).length;
  const firmsPolarCount = firmsPoints.length - firmsGeoCount;

  return `${parts.join(', ')} | GOES directo: ${directGoesCount} | GOES FIRMS: ${firmsGeoCount} | FIRMS polar: ${firmsPolarCount} | Sentinel-3: ${sentinel3Count}`;
}

export async function detectSimplified(): Promise<DetectionResult> {
  return detectOnJurisdiction();
}

export { deriveStatusFromSources };

function isGeostationaryFirmsPoint(point: FirmsPoint): boolean {
  return point.sourceFamily === 'geostationary' || isFirmsGeostationaryProduct(point.sourceProduct);
}
