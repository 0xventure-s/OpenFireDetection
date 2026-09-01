import { JURISDICTION_BBOX, JURISDICTION_NAME } from '@/lib/constants';
import { isPointInJurisdiction } from '@/lib/jurisdiction';
import { EarthquakeEvent, EarthquakeFeedResponse } from '@/types';

const USGS_EARTHQUAKE_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const LOOKBACK_HOURS = 168;

interface UsgsEarthquakeResponse {
  features?: Array<{
    id?: string;
    properties?: {
      mag?: number | null;
      place?: string | null;
      time?: number | null;
      updated?: number | null;
      detail?: string | null;
    };
    geometry?: {
      coordinates?: number[];
    };
  }>;
}

export async function fetchJurisdictionEarthquakes(now = new Date()): Promise<EarthquakeFeedResponse> {
  const starttime = new Date(now.getTime() - LOOKBACK_HOURS * 3600000).toISOString();
  const params = new URLSearchParams({
    format: 'geojson',
    starttime,
    endtime: now.toISOString(),
    minlatitude: String(JURISDICTION_BBOX.south),
    maxlatitude: String(JURISDICTION_BBOX.north),
    minlongitude: String(JURISDICTION_BBOX.west),
    maxlongitude: String(JURISDICTION_BBOX.east),
    orderby: 'time',
    limit: '100',
  });

  const response = await fetch(`${USGS_EARTHQUAKE_QUERY_URL}?${params.toString()}`, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5000),
    headers: { 'User-Agent': 'OpenFireDetection/1.0' },
  });

  if (!response.ok) {
    throw new Error(`USGS earthquake feed failed: ${response.status}`);
  }

  const payload = (await response.json()) as UsgsEarthquakeResponse;
  const events = (payload.features || [])
    .map(toEarthquakeEvent)
    .filter((event): event is EarthquakeEvent => Boolean(event))
    .filter((event) => isPointInJurisdiction(event.lat, event.lon))
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());

  return {
    generatedAt: now.toISOString(),
    source: 'USGS Earthquake Catalog',
    scope: JURISDICTION_NAME,
    lookbackHours: LOOKBACK_HOURS,
    events,
  };
}

function toEarthquakeEvent(feature: NonNullable<UsgsEarthquakeResponse['features']>[number]): EarthquakeEvent | null {
  const coordinates = feature.geometry?.coordinates;
  const [lon, lat, depthKm] = coordinates || [];
  const occurredAt = feature.properties?.time;
  const id = feature.id;
  if (!id || typeof lat !== 'number' || typeof lon !== 'number' || typeof occurredAt !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(occurredAt)) return null;

  return {
    id,
    lat,
    lon,
    magnitude: typeof feature.properties?.mag === 'number' ? feature.properties.mag : null,
    depthKm: typeof depthKm === 'number' && Number.isFinite(depthKm) ? depthKm : null,
    place: feature.properties?.place || 'Ubicación no informada',
    occurredAt: new Date(occurredAt).toISOString(),
    updatedAt: feature.properties?.updated ? new Date(feature.properties.updated).toISOString() : undefined,
    source: 'USGS',
    detailUrl: feature.properties?.detail || undefined,
  };
}
