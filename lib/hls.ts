import { BBox, HlsScene } from '@/types';
import { JURISDICTION_BBOX } from './constants';

const CMR_GRANULES_URL = 'https://cmr.earthdata.nasa.gov/search/granules.json';
const DEFAULT_LOOKBACK_DAYS = 10;

type HlsStatus = 'active' | 'stale' | 'disabled';
type HlsCollection = 'HLSS30' | 'HLSL30';

export interface HlsQueryResult {
  scenes: HlsScene[];
  status: HlsStatus;
  reason?: string;
  bbox: BBox;
  lookbackDays: number;
  collections: HlsCollection[];
  latestSceneTime?: string;
}

interface CmrGranule {
  id?: string;
  title?: string;
  time_start?: string;
  cloud_cover?: number;
  collection_concept_id?: string;
  links?: Array<{
    href?: string;
    rel?: string;
    type?: string;
    title?: string;
  }>;
}

export function getHlsStatus() {
  return {
    enabled: process.env.HLS_ENABLED !== 'false',
    dataset: 'NASA Harmonized Landsat Sentinel-2 HLS v2.0',
    lookbackDays: getLookbackDays(),
    collections: ['HLSS30', 'HLSL30'] as HlsCollection[],
    reason: 'NASA CMR public granule search for HLS Sentinel-2 and Landsat scenes',
  };
}

export async function fetchHlsScenes(bbox: BBox = JURISDICTION_BBOX): Promise<HlsQueryResult> {
  const status = getHlsStatus();
  if (!status.enabled) {
    return {
      scenes: [],
      status: 'disabled',
      reason: 'HLS layer is disabled',
      bbox,
      lookbackDays: status.lookbackDays,
      collections: status.collections,
    };
  }

  const results = await Promise.all(status.collections.map((collection) => searchCollection(collection, bbox)));
  const scenes = results
    .flat()
    .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())
    .slice(0, 50);

  return {
    scenes,
    status: scenes.length > 0 ? 'active' : 'stale',
    reason: scenes.length > 0 ? undefined : 'No recent HLS scenes found for the configured jurisdiction',
    bbox,
    lookbackDays: status.lookbackDays,
    collections: status.collections,
    latestSceneTime: scenes[0]?.startTime,
  };
}

async function searchCollection(collection: HlsCollection, bbox: BBox): Promise<HlsScene[]> {
  const end = new Date();
  const start = new Date(end.getTime() - getLookbackDays() * 86400000);
  const params = new URLSearchParams({
    short_name: collection,
    bounding_box: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    temporal: `${start.toISOString()},${end.toISOString()}`,
    page_size: '25',
    sort_key: '-start_date',
  });

  const response = await fetch(`${CMR_GRANULES_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'OpenFireDetection/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`NASA CMR HLS search failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { feed?: { entry?: CmrGranule[] } };
  return (payload.feed?.entry || []).map((entry, index) => mapCmrGranule(entry, collection, index));
}

function mapCmrGranule(entry: CmrGranule, collection: HlsCollection, index: number): HlsScene {
  const browseUrl = entry.links?.find((link) => isBrowseLink(link))?.href;
  const downloadUrl = entry.links?.find((link) => isDataLink(link))?.href;
  const title = entry.title || entry.id || `${collection}-${index}`;

  return {
    id: entry.id || title,
    provider: 'NASA CMR / LP DAAC',
    platform: inferPlatform(title, collection),
    instrument: collection === 'HLSS30' ? 'MSI' : 'OLI',
    collection,
    startTime: entry.time_start || new Date(0).toISOString(),
    cloudCoverPct: typeof entry.cloud_cover === 'number' ? entry.cloud_cover : undefined,
    browseUrl,
    downloadUrl,
  };
}

function isBrowseLink(link: { href?: string; rel?: string; type?: string; title?: string }) {
  const rel = link.rel || '';
  const title = link.title || '';
  const type = link.type || '';
  return Boolean(link.href && (rel.includes('browse') || title.toLowerCase().includes('browse') || type.startsWith('image/')));
}

function isDataLink(link: { href?: string; rel?: string; type?: string; title?: string }) {
  const rel = link.rel || '';
  return Boolean(link.href && (rel.includes('data#') || rel.includes('/data/')));
}

function inferPlatform(title: string, collection: HlsCollection): string {
  if (collection === 'HLSS30') return 'Sentinel-2';
  if (title.includes('L30')) return 'Landsat 8/9';
  return 'Landsat';
}

function getLookbackDays(): number {
  const configured = Number(process.env.HLS_LOOKBACK_DAYS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_LOOKBACK_DAYS;
  return Math.min(60, Math.round(configured));
}
