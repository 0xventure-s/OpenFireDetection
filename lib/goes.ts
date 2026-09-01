import eeModule from '@google/earthengine';
import { BBox, GoesHotspot } from '@/types';
import { isPointInJurisdiction } from './jurisdiction';

const ee = eeModule as EarthEngineApi;

const GOES_DATASET = 'NOAA/GOES/19/FDCF';
const GOES_NOAA_S3_DATASET = 'NOAA GOES-19 ABI-L2-FDCF S3';
const GOES_SATELLITE = 'GOES-19';
const GOES_CADENCE_MINUTES = 10;
const DEFAULT_MAX_FALLBACK_MINUTES = 120;
const NOAA_GOES_19_BUCKET_URL = 'https://noaa-goes19.s3.amazonaws.com';
const NOAA_GOES_19_PRODUCT_PREFIX = 'ABI-L2-FDCF';
const FIRE_MASK_CODES = [10, 11, 12, 13, 14, 15, 30, 31, 32, 33, 34, 35] as const;
const TEMP_SCALE = 0.0549367;
const TEMP_OFFSET = 400;
const AREA_SCALE = 60.98;
const AREA_OFFSET = 4000;
const GOES_SCAN_ANGLE_LIMIT_RAD = 0.151844;
const GOES_19_LONGITUDE_DEGREES = -75.2;
const GOES_PERSPECTIVE_POINT_HEIGHT_M = 35786023;
const GOES_SEMI_MAJOR_AXIS_M = 6378137;
const GOES_SEMI_MINOR_AXIS_M = 6356752.31414;

type GoesDetectionStatus = 'active' | 'disabled' | 'stale';

interface EarthEnginePrivateKey {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

interface EarthEngineApi {
  data: {
    authenticateViaPrivateKey: (
      privateKey: EarthEnginePrivateKey,
      success: () => void,
      error: (error: unknown) => void
    ) => void;
  };
  initialize: (
    baseUrl?: string | null,
    tileUrl?: string | null,
    success?: () => void,
    error?: (error: unknown) => void,
    xsrfToken?: string | null,
    project?: string | null
  ) => void;
  Date: (value: number) => EeDate;
  Geometry: {
    Rectangle: (coordinates: number[], projection?: string | null, geodesic?: boolean) => EeGeometry;
  };
  ImageCollection: (assetId: string) => EeImageCollection;
}

interface EeComputed {
  evaluate: (callback: (result: unknown, error?: unknown) => void) => void;
}

interface EeDate extends EeComputed {
  advance: (delta: number, unit: string) => EeDate;
}

type EeGeometry = EeComputed;

interface EeImage extends EeComputed {
  select: (bands: string | string[]) => EeImage;
  remap: (from: readonly number[], to: number[], defaultValue: number) => EeImage;
  selfMask: () => EeImage;
  rename: (name: string) => EeImage;
  updateMask: (mask: EeImage) => EeImage;
  sample: (options: {
    region: EeGeometry;
    scale: number;
    geometries: boolean;
    tileScale?: number;
  }) => EeFeatureCollection;
  get: (property: string) => EeComputed;
}

interface EeImageCollection extends EeComputed {
  filterBounds: (geometry: EeGeometry) => EeImageCollection;
  filterDate: (start: EeDate, end: EeDate) => EeImageCollection;
  sort: (property: string, ascending?: boolean) => EeImageCollection;
  limit: (limit: number) => EeImageCollection;
  aggregate_array: (property: string) => EeComputed;
  first: () => EeImage;
}

interface EeFeatureCollection extends EeComputed {
  map: (mapper: (feature: EeFeature) => EeFeature) => EeFeatureCollection;
}

interface EeFeature {
  set: (properties: Record<string, unknown>) => EeFeature;
}

interface EarthEngineFeatureCollection {
  features?: EarthEngineFeature[];
}

interface EarthEngineFeature {
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

export interface GoesDetectionQueryResult {
  hotspots: GoesHotspot[];
  status: GoesDetectionStatus;
  reason?: string;
  dataset: string;
  cadenceMinutes: typeof GOES_CADENCE_MINUTES;
  maxFallbackMinutes: number;
  acquisitionTime?: string;
  usedFallback: boolean;
  rawProductUrl?: string;
}

let earthEngineReady: Promise<EarthEngineApi> | null = null;

export function getGoesStatus(): {
  enabled: boolean;
  reason: string;
  dataset: string;
  cadenceMinutes: typeof GOES_CADENCE_MINUTES;
  maxFallbackMinutes: number;
} {
  const hasEarthEngine = hasEarthEngineCredentials();
  const hasNoaaS3Fallback = isNoaaS3FallbackEnabled();

  if (!hasEarthEngine && !hasNoaaS3Fallback) {
    return {
      enabled: false,
      reason: 'GOES-19 FDCF requires Earth Engine credentials or NOAA S3 fallback',
      dataset: GOES_DATASET,
      cadenceMinutes: GOES_CADENCE_MINUTES,
      maxFallbackMinutes: getMaxFallbackMinutes(),
    };
  }

  return {
    enabled: true,
    reason: hasEarthEngine
      ? 'GOES-19 FDCF enabled through Earth Engine with NOAA S3 fallback'
      : 'GOES-19 FDCF enabled through NOAA S3 fallback',
    dataset: hasEarthEngine ? GOES_DATASET : GOES_NOAA_S3_DATASET,
    cadenceMinutes: GOES_CADENCE_MINUTES,
    maxFallbackMinutes: getMaxFallbackMinutes(),
  };
}

export async function detectHeatFromGOES(bbox: BBox): Promise<GoesHotspot[]> {
  const result = await fetchGoesFdcfHotspots(bbox);
  return result.hotspots;
}

export async function fetchGoesFdcfHotspots(bbox: BBox): Promise<GoesDetectionQueryResult> {
  const status = getGoesStatus();
  if (!status.enabled) {
    return {
      hotspots: [],
      status: 'disabled',
      reason: status.reason,
      dataset: GOES_DATASET,
      cadenceMinutes: GOES_CADENCE_MINUTES,
      maxFallbackMinutes: status.maxFallbackMinutes,
      usedFallback: false,
    };
  }

  const maxFallbackMinutes = getMaxFallbackMinutes();
  let earthEngineFallbackReason: string | undefined;

  if (!hasEarthEngineCredentials()) {
    earthEngineFallbackReason = 'Earth Engine credentials are not configured';
  } else {
    const earthEngineResult = await fetchGoesFdcfHotspotsFromEarthEngine(bbox, maxFallbackMinutes);
    if (earthEngineResult.status === 'active') {
      return earthEngineResult;
    }
    earthEngineFallbackReason = earthEngineResult.reason;
  }

  if (isNoaaS3FallbackEnabled()) {
    return fetchGoesFdcfHotspotsFromNoaaS3(bbox, maxFallbackMinutes, earthEngineFallbackReason);
  }

  return {
    hotspots: [],
    status: 'stale',
    reason: earthEngineFallbackReason || `No GOES-19 FDCF image found inside the last ${maxFallbackMinutes} minutes`,
    dataset: GOES_DATASET,
    cadenceMinutes: GOES_CADENCE_MINUTES,
    maxFallbackMinutes,
    usedFallback: false,
  };
}

async function fetchGoesFdcfHotspotsFromEarthEngine(
  bbox: BBox,
  maxFallbackMinutes: number
): Promise<GoesDetectionQueryResult> {
  try {
    const initializedEe = await ensureEarthEngineInitialized();
    const acquisition = await getLatestAcquisition(initializedEe, bbox, maxFallbackMinutes);

    if (!acquisition) {
      return {
        hotspots: [],
        status: 'stale',
        reason: `No GOES-19 FDCF image found inside the last ${maxFallbackMinutes} minutes`,
        dataset: GOES_DATASET,
        cadenceMinutes: GOES_CADENCE_MINUTES,
        maxFallbackMinutes,
        usedFallback: false,
      };
    }

    const featureCollection = buildActiveFireFeatureCollection(initializedEe, bbox, acquisition.timeMs);
    const evaluated = await evaluateEe<EarthEngineFeatureCollection>(featureCollection);
    const hotspots = (evaluated.features || [])
      .map((feature) => mapEarthEngineFeatureToHotspot(feature, bbox))
      .filter((hotspot): hotspot is GoesHotspot => hotspot !== null);

    return {
      hotspots,
      status: 'active',
      dataset: GOES_DATASET,
      cadenceMinutes: GOES_CADENCE_MINUTES,
      maxFallbackMinutes,
      acquisitionTime: new Date(acquisition.timeMs).toISOString(),
      usedFallback: acquisition.usedFallback,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[GOES] Earth Engine FDCF error:', message);
    return {
      hotspots: [],
      status: 'disabled',
      reason: message,
      dataset: GOES_DATASET,
      cadenceMinutes: GOES_CADENCE_MINUTES,
      maxFallbackMinutes: getMaxFallbackMinutes(),
      usedFallback: false,
    };
  }
}

async function fetchGoesFdcfHotspotsFromNoaaS3(
  bbox: BBox,
  maxFallbackMinutes: number,
  previousReason?: string
): Promise<GoesDetectionQueryResult> {
  try {
    const object = await findLatestNoaaS3FdcfObject(maxFallbackMinutes);

    if (!object) {
      return {
        hotspots: [],
        status: 'stale',
        reason: joinReasons(
          previousReason,
          `No NOAA GOES-19 FDCF object found inside the last ${maxFallbackMinutes} minutes`
        ),
        dataset: GOES_NOAA_S3_DATASET,
        cadenceMinutes: GOES_CADENCE_MINUTES,
        maxFallbackMinutes,
        usedFallback: false,
      };
    }

    const hotspots = await readNoaaS3FdcfHotspots(object, bbox);
    const ageMs = Date.now() - object.acquisitionTime.getTime();

    return {
      hotspots,
      status: 'active',
      reason: previousReason ? `Earth Engine fallback: ${previousReason}` : undefined,
      dataset: GOES_NOAA_S3_DATASET,
      cadenceMinutes: GOES_CADENCE_MINUTES,
      maxFallbackMinutes,
      acquisitionTime: object.acquisitionTime.toISOString(),
      usedFallback: ageMs > GOES_CADENCE_MINUTES * 60000,
      rawProductUrl: object.url,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[GOES] NOAA S3 FDCF error:', message);
    return {
      hotspots: [],
      status: 'disabled',
      reason: joinReasons(previousReason, message),
      dataset: GOES_NOAA_S3_DATASET,
      cadenceMinutes: GOES_CADENCE_MINUTES,
      maxFallbackMinutes,
      usedFallback: false,
    };
  }
}

export function mapEarthEngineFeatureToHotspot(
  feature: EarthEngineFeature,
  bbox: BBox
): GoesHotspot | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const lon = toNumber(coordinates[0]);
  const lat = toNumber(coordinates[1]);
  if (lat === null || lon === null || !isInsideBBox(lat, lon, bbox) || !isPointInJurisdiction(lat, lon)) {
    return null;
  }

  const properties = feature.properties || {};
  const maskCode = toNumber(properties.Mask);
  if (maskCode === null || !FIRE_MASK_CODES.includes(maskCode as (typeof FIRE_MASK_CODES)[number])) {
    return null;
  }

  const acquisitionMs = toNumber(properties.system_time_start);
  if (acquisitionMs === null) {
    return null;
  }

  const rawTemp = toNumber(properties.Temp);
  const rawArea = toNumber(properties.Area);
  const frp = toNumber(properties.Power);

  return {
    lat,
    lon,
    heat: rawTemp === null ? 0 : rawTemp * TEMP_SCALE,
    frp: frp === null ? undefined : frp,
    areaM2: rawArea === null ? undefined : rawArea * AREA_SCALE,
    ts: new Date(acquisitionMs).toISOString(),
    satellite: GOES_SATELLITE,
    layer: 'goes-fdcf',
    sourceProduct: GOES_DATASET,
    maskCode,
  };
}

interface NoaaS3FdcfObject {
  key: string;
  url: string;
  acquisitionTime: Date;
  lastModified?: Date;
}

interface Hdf5Dataset {
  value: unknown;
  shape: number[];
}

interface Hdf5File {
  get: (path: string) => Hdf5Dataset;
}

async function findLatestNoaaS3FdcfObject(maxFallbackMinutes: number): Promise<NoaaS3FdcfObject | null> {
  const now = new Date();
  const hoursToScan = Math.ceil(maxFallbackMinutes / 60) + 1;

  for (let hourOffset = 0; hourOffset <= hoursToScan; hourOffset++) {
    const date = new Date(now.getTime() - hourOffset * 3600000);
    const prefix = buildNoaaS3HourlyPrefix(date);
    const objects = await listNoaaS3FdcfObjects(prefix);
    const candidates = objects
      .filter((object) => now.getTime() - object.acquisitionTime.getTime() <= maxFallbackMinutes * 60000)
      .sort((a, b) => b.acquisitionTime.getTime() - a.acquisitionTime.getTime());

    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  return null;
}

async function listNoaaS3FdcfObjects(prefix: string): Promise<NoaaS3FdcfObject[]> {
  const url = `${NOAA_GOES_19_BUCKET_URL}/?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OpenFireDetection/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA S3 listing failed with HTTP ${response.status}`);
  }

  return parseNoaaS3List(await response.text());
}

function parseNoaaS3List(xml: string): NoaaS3FdcfObject[] {
  const objects: NoaaS3FdcfObject[] = [];
  const contentsPattern = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match: RegExpExecArray | null;

  while ((match = contentsPattern.exec(xml)) !== null) {
    const key = extractXmlValue(match[1], 'Key');
    if (!key || !key.endsWith('.nc')) continue;

    const acquisitionTime = parseNoaaS3AcquisitionTime(key);
    if (!acquisitionTime) continue;

    const lastModifiedValue = extractXmlValue(match[1], 'LastModified');
    objects.push({
      key,
      url: `${NOAA_GOES_19_BUCKET_URL}/${key}`,
      acquisitionTime,
      lastModified: lastModifiedValue ? new Date(lastModifiedValue) : undefined,
    });
  }

  return objects;
}

async function readNoaaS3FdcfHotspots(object: NoaaS3FdcfObject, bbox: BBox): Promise<GoesHotspot[]> {
  const response = await fetch(object.url, {
    headers: {
      'User-Agent': 'OpenFireDetection/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA S3 product download failed with HTTP ${response.status}`);
  }

  const hdf5 = (await import('jsfive')) as { File: new (buffer: ArrayBuffer, filename?: string) => Hdf5File };
  const file = new hdf5.File(await response.arrayBuffer(), object.key);
  const maskDataset = file.get('Mask');
  const [height, width] = maskDataset.shape;
  const mask = toNumberArray(maskDataset.value);

  if (!height || !width || mask.length === 0) {
    return [];
  }

  const candidates: Array<{ index: number; lat: number; lon: number; maskCode: number }> = [];

  for (let index = 0; index < mask.length; index++) {
    const maskCode = mask[index];
    if (!FIRE_MASK_CODES.includes(maskCode as (typeof FIRE_MASK_CODES)[number])) continue;

    const row = Math.floor(index / width);
    const col = index - row * width;
    const point = goesFixedGridPixelToLatLon(row, col, height, width);

    if (!point || !isInsideBBox(point.lat, point.lon, bbox) || !isPointInJurisdiction(point.lat, point.lon)) continue;
    candidates.push({ index, lat: point.lat, lon: point.lon, maskCode });
  }

  if (candidates.length === 0) {
    return [];
  }

  const temp = toNumberArray(file.get('Temp').value);
  const power = toNumberArray(file.get('Power').value);
  const area = toNumberArray(file.get('Area').value);

  return candidates.map((candidate) => {
    const rawTemp = temp[candidate.index];
    const rawArea = area[candidate.index];
    const frp = power[candidate.index];

    return {
      lat: candidate.lat,
      lon: candidate.lon,
      heat: Number.isFinite(rawTemp) ? rawTemp * TEMP_SCALE + TEMP_OFFSET : 0,
      frp: Number.isFinite(frp) ? frp : undefined,
      areaM2: Number.isFinite(rawArea) ? rawArea * AREA_SCALE + AREA_OFFSET : undefined,
      ts: object.acquisitionTime.toISOString(),
      satellite: GOES_SATELLITE,
      layer: 'goes-fdcf',
      sourceProduct: GOES_NOAA_S3_DATASET,
      maskCode: candidate.maskCode,
    };
  });
}

function goesFixedGridPixelToLatLon(
  row: number,
  col: number,
  height: number,
  width: number
): { lat: number; lon: number } | null {
  const x = -GOES_SCAN_ANGLE_LIMIT_RAD + col * ((2 * GOES_SCAN_ANGLE_LIMIT_RAD) / (width - 1));
  const y = GOES_SCAN_ANGLE_LIMIT_RAD - row * ((2 * GOES_SCAN_ANGLE_LIMIT_RAD) / (height - 1));
  const longitudeOrigin = (GOES_19_LONGITUDE_DEGREES * Math.PI) / 180;
  const perspectiveHeight = GOES_PERSPECTIVE_POINT_HEIGHT_M + GOES_SEMI_MAJOR_AXIS_M;
  const equatorialSquared = GOES_SEMI_MAJOR_AXIS_M * GOES_SEMI_MAJOR_AXIS_M;
  const polarSquared = GOES_SEMI_MINOR_AXIS_M * GOES_SEMI_MINOR_AXIS_M;

  const cosX = Math.cos(x);
  const sinX = Math.sin(x);
  const cosY = Math.cos(y);
  const sinY = Math.sin(y);
  const a =
    sinX * sinX +
    cosX * cosX * (cosY * cosY + (equatorialSquared / polarSquared) * sinY * sinY);
  const b = -2 * perspectiveHeight * cosX * cosY;
  const c = perspectiveHeight * perspectiveHeight - equatorialSquared;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const satelliteRange = (-b - Math.sqrt(discriminant)) / (2 * a);
  const sx = satelliteRange * cosX * cosY;
  const sy = -satelliteRange * sinX;
  const sz = satelliteRange * cosX * sinY;
  const lat =
    Math.atan(
      (equatorialSquared / polarSquared) *
        (sz / Math.sqrt((perspectiveHeight - sx) * (perspectiveHeight - sx) + sy * sy))
    ) *
    (180 / Math.PI);
  const lon = (longitudeOrigin - Math.atan(sy / (perspectiveHeight - sx))) * (180 / Math.PI);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { lat, lon };
}

/**
 * Legacy FIRMS/GOES normalization kept for tests and backwards compatibility.
 */
export function normalizeGoesHotspot(point: {
  latitude?: string;
  longitude?: string;
  bright_ti4?: string;
  frp?: string;
  confidence?: string;
  acq_date?: string;
  acq_time?: string;
  satellite?: string;
}): GoesHotspot | null {
  if (!point.latitude || !point.longitude || !point.acq_date || !point.acq_time) {
    return null;
  }

  const lat = parseFloat(point.latitude);
  const lon = parseFloat(point.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    heat: parseFloat(point.bright_ti4 || '0') || 0,
    frp: parseFloat(point.frp || '0') || 0,
    ts: parseAcquisitionTimestamp(point.acq_date, point.acq_time),
    satellite: point.satellite || GOES_SATELLITE,
    layer: 'goes-fdcf',
    sourceProduct: GOES_DATASET,
    confidence: parseInt(point.confidence || '0', 10) || 0,
  };
}

export function parseAcquisitionTimestamp(date: string, time: string): string {
  const normalizedTime = time.padStart(4, '0');
  const hours = normalizedTime.slice(0, 2);
  const minutes = normalizedTime.slice(2, 4);
  return new Date(`${date}T${hours}:${minutes}:00.000Z`).toISOString();
}

export function resetEarthEngineForTests(): void {
  earthEngineReady = null;
}

function ensureEarthEngineInitialized(): Promise<EarthEngineApi> {
  if (earthEngineReady) {
    return earthEngineReady;
  }

  earthEngineReady = new Promise((resolve, reject) => {
    const privateKey = readServiceAccountKey();
    const projectId = process.env.EARTH_ENGINE_PROJECT_ID;

    if (!privateKey || !projectId) {
      reject(new Error(getGoesStatus().reason));
      return;
    }

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        ee.initialize(
          null,
          null,
          () => resolve(ee),
          (error) => reject(new Error(getErrorMessage(error))),
          null,
          projectId
        );
      },
      (error) => reject(new Error(getErrorMessage(error)))
    );
  });

  return earthEngineReady;
}

async function getLatestAcquisition(
  initializedEe: EarthEngineApi,
  bbox: BBox,
  maxFallbackMinutes: number
): Promise<{ timeMs: number; usedFallback: boolean } | null> {
  const nowMs = Date.now();
  const region = buildRegion(initializedEe, bbox);
  const collection = initializedEe
    .ImageCollection(GOES_DATASET)
    .filterBounds(region)
    .filterDate(initializedEe.Date(nowMs).advance(-maxFallbackMinutes, 'minute'), initializedEe.Date(nowMs))
    .sort('system:time_start', false);

  const timeValues = await evaluateEe<unknown[]>(collection.limit(1).aggregate_array('system:time_start'));
  const timeMs = Array.isArray(timeValues) && timeValues.length > 0 ? toNumber(timeValues[0]) : null;
  if (timeMs === null) {
    return null;
  }

  return {
    timeMs,
    usedFallback: nowMs - timeMs > GOES_CADENCE_MINUTES * 60000,
  };
}

function buildActiveFireFeatureCollection(
  initializedEe: EarthEngineApi,
  bbox: BBox,
  acquisitionTimeMs: number
): EeFeatureCollection {
  const region = buildRegion(initializedEe, bbox);
  const image = initializedEe
    .ImageCollection(GOES_DATASET)
    .filterBounds(region)
    .filterDate(initializedEe.Date(acquisitionTimeMs - 1000), initializedEe.Date(acquisitionTimeMs + 1000))
    .sort('system:time_start', false)
    .first();

  const activeFireMask = image
    .select('Mask')
    .remap(FIRE_MASK_CODES, FIRE_MASK_CODES.map(() => 1), 0)
    .selfMask()
    .rename('active_fire');

  const firePixels = image
    .select(['Mask', 'Temp', 'Power', 'Area'])
    .updateMask(activeFireMask)
    .sample({
      region,
      scale: 2000,
      geometries: true,
      tileScale: 4,
    });

  return firePixels.map((feature) =>
    feature.set({
      system_time_start: acquisitionTimeMs,
      dataset: GOES_DATASET,
      satellite: GOES_SATELLITE,
    })
  );
}

function buildRegion(initializedEe: EarthEngineApi, bbox: BBox): EeGeometry {
  return initializedEe.Geometry.Rectangle([bbox.west, bbox.south, bbox.east, bbox.north], null, false);
}

function evaluateEe<T>(computed: EeComputed): Promise<T> {
  return new Promise((resolve, reject) => {
    computed.evaluate((result, error) => {
      if (error) {
        reject(new Error(getErrorMessage(error)));
        return;
      }
      resolve(result as T);
    });
  });
}

function readServiceAccountKey(): EarthEnginePrivateKey | null {
  const encoded = process.env.EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!encoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Partial<EarthEnginePrivateKey>;
    if (!parsed.client_email || !parsed.private_key) {
      return null;
    }
    return parsed as EarthEnginePrivateKey;
  } catch {
    return null;
  }
}

function hasEarthEngineCredentials(): boolean {
  return Boolean(process.env.EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64 && process.env.EARTH_ENGINE_PROJECT_ID);
}

function isNoaaS3FallbackEnabled(): boolean {
  return process.env.GOES_NOAA_S3_FALLBACK !== 'false';
}

function getMaxFallbackMinutes(): number {
  const configured = Number(process.env.GOES_MAX_FALLBACK_MINUTES);
  if (!Number.isFinite(configured) || configured <= GOES_CADENCE_MINUTES) {
    return DEFAULT_MAX_FALLBACK_MINUTES;
  }
  return Math.round(configured);
}

function buildNoaaS3HourlyPrefix(date: Date): string {
  const year = date.getUTCFullYear();
  const day = getUtcDayOfYear(date).toString().padStart(3, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');
  return `${NOAA_GOES_19_PRODUCT_PREFIX}/${year}/${day}/${hour}/`;
}

function getUtcDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86400000) + 1;
}

function parseNoaaS3AcquisitionTime(key: string): Date | null {
  const match = key.match(/_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, yearValue, dayValue, hourValue, minuteValue, secondValue] = match;
  const year = Number(yearValue);
  const dayOfYear = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);

  if (![year, dayOfYear, hour, minute, second].every(Number.isFinite)) {
    return null;
  }

  return new Date(Date.UTC(year, 0, dayOfYear, hour, minute, second));
}

function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXmlEntities(match[1]) : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function toNumberArray(value: unknown): ArrayLike<number> {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return value as ArrayLike<number>;
  }
  return [];
}

function joinReasons(...reasons: Array<string | undefined>): string | undefined {
  const parts = reasons.filter((reason): reason is string => Boolean(reason));
  return parts.length > 0 ? parts.join('; ') : undefined;
}

function isInsideBBox(lat: number, lon: number, bbox: BBox): boolean {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
