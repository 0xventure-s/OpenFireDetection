import { BBox, LightningFlash } from '@/types';
import { JURISDICTION_BBOX } from './constants';
import { isPointInJurisdiction } from './jurisdiction';

const NOAA_GOES_19_BUCKET_URL = 'https://noaa-goes19.s3.amazonaws.com';
const NOAA_GOES_19_GLM_PREFIX = 'GLM-L2-LCFA';
const GOES_GLM_SATELLITE = 'GOES-19 GLM';
const DEFAULT_MAX_FALLBACK_MINUTES = 30;
const DEFAULT_MAX_FILES = 18;

type LightningStatus = 'active' | 'stale' | 'disabled';

interface NoaaS3GlmObject {
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

export interface LightningQueryResult {
  flashes: LightningFlash[];
  count: number;
  status: LightningStatus;
  reason?: string;
  dataset: string;
  cadenceSeconds: number;
  maxFallbackMinutes: number;
  acquisitionTime?: string;
  filesRead: number;
}

export function getLightningStatus() {
  return {
    enabled: process.env.GOES_GLM_LIGHTNING_ENABLED !== 'false',
    reason: 'GOES-19 GLM lightning layer reads NOAA AWS Open Data',
    dataset: `NOAA GOES-19 ${NOAA_GOES_19_GLM_PREFIX} S3`,
    cadenceSeconds: 20,
    maxFallbackMinutes: getMaxFallbackMinutes(),
  };
}

export async function fetchGoesLightningFlashes(bbox: BBox = JURISDICTION_BBOX): Promise<LightningQueryResult> {
  const status = getLightningStatus();
  if (!status.enabled) {
    return {
      flashes: [],
      count: 0,
      status: 'disabled',
      reason: 'GOES GLM lightning layer is disabled',
      dataset: status.dataset,
      cadenceSeconds: status.cadenceSeconds,
      maxFallbackMinutes: status.maxFallbackMinutes,
      filesRead: 0,
    };
  }

  try {
    const objects = await findLatestNoaaS3GlmObjects(status.maxFallbackMinutes, getMaxFiles());
    if (objects.length === 0) {
      return {
        flashes: [],
        count: 0,
        status: 'stale',
        reason: `No GOES-19 GLM object found inside the last ${status.maxFallbackMinutes} minutes`,
        dataset: status.dataset,
        cadenceSeconds: status.cadenceSeconds,
        maxFallbackMinutes: status.maxFallbackMinutes,
        filesRead: 0,
      };
    }

    const flashGroups = await Promise.all(objects.map((object) => readNoaaS3GlmFlashes(object, bbox)));
    const flashes = flashGroups.flat().sort((left, right) => new Date(right.ts).getTime() - new Date(left.ts).getTime());

    return {
      flashes,
      count: flashes.length,
      status: 'active',
      dataset: status.dataset,
      cadenceSeconds: status.cadenceSeconds,
      maxFallbackMinutes: status.maxFallbackMinutes,
      acquisitionTime: objects[0].acquisitionTime.toISOString(),
      filesRead: objects.length,
    };
  } catch (error) {
    return {
      flashes: [],
      count: 0,
      status: 'disabled',
      reason: getErrorMessage(error),
      dataset: status.dataset,
      cadenceSeconds: status.cadenceSeconds,
      maxFallbackMinutes: status.maxFallbackMinutes,
      filesRead: 0,
    };
  }
}

async function findLatestNoaaS3GlmObjects(maxFallbackMinutes: number, maxFiles: number): Promise<NoaaS3GlmObject[]> {
  const now = new Date();
  const hoursToScan = Math.ceil(maxFallbackMinutes / 60) + 1;
  const allCandidates: NoaaS3GlmObject[] = [];

  for (let hourOffset = 0; hourOffset <= hoursToScan; hourOffset++) {
    const date = new Date(now.getTime() - hourOffset * 3600000);
    const prefix = buildNoaaS3HourlyPrefix(date);
    const objects = await listNoaaS3GlmObjects(prefix);
    allCandidates.push(
      ...objects.filter((object) => now.getTime() - object.acquisitionTime.getTime() <= maxFallbackMinutes * 60000)
    );
  }

  return allCandidates
    .sort((left, right) => right.acquisitionTime.getTime() - left.acquisitionTime.getTime())
    .slice(0, maxFiles);
}

async function listNoaaS3GlmObjects(prefix: string): Promise<NoaaS3GlmObject[]> {
  const url = `${NOAA_GOES_19_BUCKET_URL}/?list-type=2&max-keys=1000&prefix=${encodeURIComponent(prefix)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OpenFireDetection/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA S3 GLM listing failed with HTTP ${response.status}`);
  }

  return parseNoaaS3List(await response.text());
}

function parseNoaaS3List(xml: string): NoaaS3GlmObject[] {
  const objects: NoaaS3GlmObject[] = [];
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

async function readNoaaS3GlmFlashes(object: NoaaS3GlmObject, bbox: BBox): Promise<LightningFlash[]> {
  const response = await fetch(object.url, {
    headers: {
      'User-Agent': 'OpenFireDetection/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NOAA S3 GLM product download failed with HTTP ${response.status}`);
  }

  const hdf5 = (await import('jsfive')) as { File: new (buffer: ArrayBuffer, filename?: string) => Hdf5File };
  const file = new hdf5.File(await response.arrayBuffer(), object.key);
  const latitudes = toNumberArray(file.get('flash_lat').value);
  const longitudes = toNumberArray(file.get('flash_lon').value);
  const energy = safeNumberArray(file, 'flash_energy');
  const area = safeNumberArray(file, 'flash_area');
  const flashes: LightningFlash[] = [];

  for (let index = 0; index < latitudes.length; index++) {
    const lat = latitudes[index];
    const lon = longitudes[index];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!isInsideBBox(lat, lon, bbox) || !isPointInJurisdiction(lat, lon)) continue;

    flashes.push({
      lat,
      lon,
      ts: object.acquisitionTime.toISOString(),
      satellite: GOES_GLM_SATELLITE,
      energyJ: Number.isFinite(energy[index]) ? energy[index] : undefined,
      areaM2: Number.isFinite(area[index]) ? area[index] : undefined,
    });
  }

  return flashes;
}

function safeNumberArray(file: Hdf5File, path: string): ArrayLike<number> {
  try {
    return toNumberArray(file.get(path).value);
  } catch {
    return [];
  }
}

function buildNoaaS3HourlyPrefix(date: Date): string {
  const year = date.getUTCFullYear();
  const day = getUtcDayOfYear(date).toString().padStart(3, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');
  return `${NOAA_GOES_19_GLM_PREFIX}/${year}/${day}/${hour}/`;
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

function isInsideBBox(lat: number, lon: number, bbox: BBox): boolean {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

function getMaxFallbackMinutes(): number {
  const configured = Number(process.env.GOES_GLM_MAX_FALLBACK_MINUTES);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_FALLBACK_MINUTES;
  }
  return Math.round(configured);
}

function getMaxFiles(): number {
  const configured = Number(process.env.GOES_GLM_MAX_FILES);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_FILES;
  }
  return Math.min(120, Math.round(configured));
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
