import axios from 'axios';
import { JURISDICTION_BBOX, FIRMS_CONFIG } from './constants';
import { isPointInJurisdiction } from './jurisdiction';
import { FirmsPoint, FirmsGeoJSON, FirmsFeature, BBox } from '@/types';
import { getFirmsLayer, isFirmsGeostationaryProduct, isFirmsPolarProduct } from './satellite-layers';

// Simple in-memory cache
interface CacheEntry {
  data: FirmsPoint[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Fetch FIRMS data by bounding box and time range
 */
export async function fetchFirmsByBBox(
  bbox: BBox = JURISDICTION_BBOX,
  daysBack: number = 1
): Promise<FirmsPoint[]> {
  const cacheKey = `${bbox.west},${bbox.south},${bbox.east},${bbox.north},${daysBack}`;

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FIRMS_CONFIG.CACHE_TTL) {
    return cached.data;
  }

  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    throw new Error('FIRMS_MAP_KEY not configured');
  }

  // Limit days to maximum allowed
  const days = Math.min(daysBack, FIRMS_CONFIG.MAX_DAYS);

  const allPoints: FirmsPoint[] = [];

  // Fetch from all configured satellites
  for (const satellite of FIRMS_CONFIG.SATELLITES) {
    const url = `${FIRMS_CONFIG.BASE_URL}/${mapKey}/${satellite}/${bbox.west},${bbox.south},${bbox.east},${bbox.north}/${days}`;

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'OpenFireDetection/1.0',
        },
      });

      const csvData = response.data;
      const points = parseCSV(csvData, satellite);
      allPoints.push(...points);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FIRMS] Error fetching ${satellite}:`, message);
      // Continue with other satellites
    }
  }

  // Remove duplicates and keep only detections inside la jurisdicción province.
  const uniquePoints = deduplicatePoints(allPoints).filter((point) =>
    isPointInJurisdiction(point.latitude, point.longitude)
  );

  // Update cache
  cache.set(cacheKey, {
    data: uniquePoints,
    timestamp: Date.now(),
  });

  return uniquePoints;
}

/**
 * Query FIRMS data by bbox and time window
 */
export async function queryByBBoxAndTime(
  bbox: BBox,
  hoursBack: number = 3
): Promise<FirmsPoint[]> {
  const daysBack = Math.ceil(hoursBack / 24);
  const allPoints = await fetchFirmsByBBox(bbox, daysBack);

  // Filter by time window
  const cutoffTime = new Date(Date.now() - hoursBack * 3600000);

  return allPoints.filter((point) => {
    const pointTime = parseFirmsDateTime(point.acq_date, point.acq_time);
    return pointTime >= cutoffTime;
  });
}

/**
 * Convert FIRMS data to GeoJSON
 */
export function toGeoJSON(points: FirmsPoint[]): FirmsGeoJSON {
  const features: FirmsFeature[] = points.map((point) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [point.longitude, point.latitude],
    },
    properties: point,
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Parse FIRMS CSV response
 */
export function parseCSV(csv: string, sourceProduct?: string): FirmsPoint[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const points: FirmsPoint[] = [];
  const numericFields = new Set([
    'latitude',
    'longitude',
    'brightness',
    'brightness2',
    'bright_ti4',
    'bright_ti5',
    'scan',
    'track',
    'bright_t31',
    'frp',
  ]);

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue;

    const point: Record<string, string | number> = {};
    headers.forEach((header, index) => {
      const value = values[index].trim();
      point[header] = numericFields.has(header) ? parseFloat(value) : value;
    });

    const product = sourceProduct || asString(point.sourceProduct) || asString(point.source) || undefined;
    const confidenceRaw = asString(point.confidence);
    const brightTi4 = asOptionalNumber(point.bright_ti4);
    const brightTi5 = asOptionalNumber(point.bright_ti5);
    const brightness =
      asOptionalNumber(point.brightness) ?? brightTi4 ?? asOptionalNumber(point.brightness2) ?? 0;

    points.push({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      brightness,
      bright_ti4: brightTi4,
      bright_ti5: brightTi5,
      scan: Number(point.scan),
      track: Number(point.track),
      acq_date: String(point.acq_date),
      acq_time: String(point.acq_time),
      satellite: String(point.satellite),
      instrument: asString(point.instrument) || undefined,
      confidence: normalizeFirmsConfidence(confidenceRaw),
      confidenceRaw,
      version: String(point.version),
      bright_t31: asOptionalNumber(point.bright_t31) ?? brightTi5 ?? asOptionalNumber(point.brightness2) ?? 0,
      frp: Number(point.frp),
      daynight: String(point.daynight) as 'D' | 'N',
      sourceProduct: product,
      sourceLayer: product ? getFirmsLayer(product) : undefined,
      sourceFamily: isFirmsGeostationaryProduct(product)
        ? 'geostationary'
        : isFirmsPolarProduct(product)
          ? 'polar'
          : undefined,
    });
  }

  return points;
}

/**
 * Parse FIRMS date and time to Date object
 */
export function parseFirmsDateTime(date: string, time: string): Date {
  // date format: YYYY-MM-DD
  // time format: HHMM
  const [year, month, day] = date.split('-').map(Number);
  const hours = parseInt(time.substring(0, 2));
  const minutes = parseInt(time.substring(2, 4));

  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}

/**
 * Remove duplicate points based on lat/lon/time
 */
function deduplicatePoints(points: FirmsPoint[]): FirmsPoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    // Create unique key based on coordinates and acquisition time
    const key = [
      point.sourceProduct || 'unknown',
      point.satellite || 'unknown',
      point.latitude.toFixed(4),
      point.longitude.toFixed(4),
      point.acq_date,
      point.acq_time,
    ].join(':');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache(): void {
  cache.clear();
}

function normalizeFirmsConfidence(value: string): 'low' | 'nominal' | 'high' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'h' || normalized === 'high') return 'high';
  if (normalized === 'n' || normalized === 'nominal') return 'nominal';
  if (normalized === 'l' || normalized === 'low') return 'low';

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    if (numeric >= 80) return 'high';
    if (numeric >= 30) return 'nominal';
  }

  return 'low';
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      count: entry.data.length,
      age: Date.now() - entry.timestamp,
    })),
  };
}
