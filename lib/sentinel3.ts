import { BBox, Sentinel3FrpHotspot } from '@/types';
import { JURISDICTION_BBOX } from './constants';
import { isPointInJurisdiction } from './jurisdiction';

const SENTINEL3_COLLECTION = 'EO:EUM:DAT:0417';
const SENTINEL3_DATASET = 'Copernicus Sentinel-3 SLSTR L2 NRT Fire Radiative Power';
const DEFAULT_LOOKBACK_HOURS = 6;

type Sentinel3Status = 'active' | 'configured' | 'disabled' | 'stale';

interface Sentinel3Product {
  id: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  updatedAt?: string;
  downloadUrl?: string;
}

export interface Sentinel3QueryResult {
  hotspots: Sentinel3FrpHotspot[];
  products: Sentinel3Product[];
  status: Sentinel3Status;
  reason?: string;
  dataset: string;
  collection: string;
  lookbackHours: number;
  acquisitionTime?: string;
}

interface GeoJsonFeatureCollection {
  type?: string;
  features?: GeoJsonFeature[];
}

interface GeoJsonFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

export function getSentinel3Status() {
  const hasPreprocessedFeed = Boolean(process.env.SENTINEL3_FRP_GEOJSON_URL);
  const hasEumetsatCredentials = Boolean(process.env.EUMETSAT_CONSUMER_KEY && process.env.EUMETSAT_CONSUMER_SECRET);

  return {
    enabled: hasPreprocessedFeed || hasEumetsatCredentials,
    hasPreprocessedFeed,
    hasEumetsatCredentials,
    dataset: SENTINEL3_DATASET,
    collection: SENTINEL3_COLLECTION,
    lookbackHours: getLookbackHours(),
    reason: hasPreprocessedFeed
      ? 'Sentinel-3 FRP preprocessed GeoJSON feed configured'
      : hasEumetsatCredentials
        ? 'EUMETSAT credentials configured; product discovery enabled'
        : 'Set SENTINEL3_FRP_GEOJSON_URL or EUMETSAT_CONSUMER_KEY/EUMETSAT_CONSUMER_SECRET',
  };
}

export async function fetchSentinel3FrpHotspots(bbox: BBox = JURISDICTION_BBOX): Promise<Sentinel3QueryResult> {
  const status = getSentinel3Status();
  if (!status.enabled) {
    return {
      hotspots: [],
      products: [],
      status: 'disabled',
      reason: status.reason,
      dataset: SENTINEL3_DATASET,
      collection: SENTINEL3_COLLECTION,
      lookbackHours: status.lookbackHours,
    };
  }

  const products = status.hasEumetsatCredentials ? await searchEumetsatProducts(bbox).catch(() => []) : [];

  if (status.hasPreprocessedFeed) {
    const hotspots = await fetchPreprocessedGeoJsonFeed(bbox);
    return {
      hotspots,
      products,
      status: hotspots.length > 0 ? 'active' : 'stale',
      reason: hotspots.length > 0 ? undefined : 'Sentinel-3 returned no hotspots for the configured jurisdiction in the current window',
      dataset: SENTINEL3_DATASET,
      collection: SENTINEL3_COLLECTION,
      lookbackHours: status.lookbackHours,
      acquisitionTime: hotspots[0]?.ts,
    };
  }

  return {
    hotspots: [],
    products,
    status: 'configured',
    reason: 'EUMETSAT product discovery is configured, but NetCDF FRP point extraction needs a preprocessed GeoJSON feed',
    dataset: SENTINEL3_DATASET,
    collection: SENTINEL3_COLLECTION,
    lookbackHours: status.lookbackHours,
    acquisitionTime: products[0]?.startTime,
  };
}

async function fetchPreprocessedGeoJsonFeed(bbox: BBox): Promise<Sentinel3FrpHotspot[]> {
  const url = process.env.SENTINEL3_FRP_GEOJSON_URL;
  if (!url) return [];

  const response = await fetch(url, {
    headers: { 'User-Agent': 'OpenFireDetection/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Sentinel-3 FRP feed failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GeoJsonFeatureCollection;
  const cutoffMs = Date.now() - getLookbackHours() * 3600000;

  return (payload.features || [])
    .map((feature, index) => mapFeatureToHotspot(feature, bbox, index))
    .filter((hotspot): hotspot is Sentinel3FrpHotspot => Boolean(hotspot))
    .filter((hotspot) => new Date(hotspot.ts).getTime() >= cutoffMs);
}

async function searchEumetsatProducts(bbox: BBox): Promise<Sentinel3Product[]> {
  const token = await getEumetsatToken();
  const end = new Date();
  const start = new Date(end.getTime() - getLookbackHours() * 3600000);
  const params = new URLSearchParams({
    format: 'json',
    pi: SENTINEL3_COLLECTION,
    bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    dtstart: start.toISOString(),
    dtend: end.toISOString(),
  });
  const url = `https://api.eumetsat.int/data/search-products/1.0.0/os?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'OpenFireDetection/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`EUMETSAT Sentinel-3 search failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return extractProducts(payload).slice(0, 20);
}

async function getEumetsatToken(): Promise<string> {
  const key = process.env.EUMETSAT_CONSUMER_KEY;
  const secret = process.env.EUMETSAT_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('EUMETSAT credentials are not configured');

  const response = await fetch('https://api.eumetsat.int/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`EUMETSAT token request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error('EUMETSAT token response did not include access_token');
  return payload.access_token;
}

function mapFeatureToHotspot(feature: GeoJsonFeature, bbox: BBox, index: number): Sentinel3FrpHotspot | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lon = toNumber(coordinates[0]);
  const lat = toNumber(coordinates[1]);
  if (lat === null || lon === null || !isInsideBBox(lat, lon, bbox) || !isPointInJurisdiction(lat, lon)) {
    return null;
  }

  const props = feature.properties || {};
  const ts = readString(props, ['ts', 'time', 'datetime', 'acquisitionTime', 'sensing_time']);
  if (!ts) return null;

  const frp = readNumber(props, ['frp', 'FRP', 'radiative_power_mw', 'power']);

  return {
    id: readString(props, ['id', 'identifier']) || `sentinel3:${ts}:${lat.toFixed(4)}:${lon.toFixed(4)}:${index}`,
    lat,
    lon,
    ts: new Date(ts).toISOString(),
    satellite: readString(props, ['satellite', 'platform']) || 'Sentinel-3 SLSTR',
    frp,
    confidence: frp !== undefined && frp >= 10 ? 'high' : frp !== undefined && frp >= 2 ? 'nominal' : 'low',
    sourceProduct: readString(props, ['sourceProduct', 'product']) || SENTINEL3_COLLECTION,
  };
}

function extractProducts(payload: Record<string, unknown>): Sentinel3Product[] {
  const candidates =
    asArray(payload.features) ||
    asArray(payload.products) ||
    asArray(payload.entries) ||
    asArray(payload.items) ||
    [];

  return candidates.map((item, index) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const props = record.properties && typeof record.properties === 'object' ? (record.properties as Record<string, unknown>) : record;
    return {
      id: readString(props, ['id', 'identifier', 'title']) || `sentinel3-product-${index}`,
      title: readString(props, ['title', 'name']),
      startTime: readString(props, ['startTime', 'sensingStart', 'beginposition', 'datetime']),
      endTime: readString(props, ['endTime', 'sensingEnd', 'endposition']),
      updatedAt: readString(props, ['updated', 'updatedAt']),
      downloadUrl: extractLink(record),
    };
  });
}

function extractLink(record: Record<string, unknown>): string | undefined {
  const links = asArray(record.links) || [];
  const link = links.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    const rel = String(candidate.rel || '');
    return rel.includes('download') || rel.includes('data');
  });
  if (!link || typeof link !== 'object') return undefined;
  const href = (link as Record<string, unknown>).href;
  return typeof href === 'string' ? href : undefined;
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value !== null) return value;
  }
  return undefined;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isInsideBBox(lat: number, lon: number, bbox: BBox): boolean {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

function getLookbackHours(): number {
  const configured = Number(process.env.SENTINEL3_FRP_LOOKBACK_HOURS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_LOOKBACK_HOURS;
  return Math.min(72, Math.round(configured));
}
