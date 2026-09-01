import { BBox, FireConfidence, Sentinel3FrpHotspot, ThermalAnomaly } from '@/types';
import { JURISDICTION_BBOX, DETECTION_THRESHOLDS } from './constants';
import { parseFirmsDateTime, queryByBBoxAndTime } from './firms';
import { fetchGoesFdcfHotspots } from './goes';
import { fetchSentinel3FrpHotspots } from './sentinel3';

export interface ThermalLayerResult {
  anomalies: ThermalAnomaly[];
  status: 'active' | 'stale';
  bbox: BBox;
  generatedAt: string;
  sources: {
    goes: number;
    firms: number;
    sentinel3: number;
  };
  maxIntensity: number;
}

export async function fetchThermalAnomalies(bbox: BBox = JURISDICTION_BBOX): Promise<ThermalLayerResult> {
  const [goesResult, firmsPoints, sentinel3Result] = await Promise.all([
    fetchGoesFdcfHotspots(bbox),
    queryByBBoxAndTime(bbox, DETECTION_THRESHOLDS.FIRMS_MATCH_HOURS),
    fetchSentinel3FrpHotspots(bbox),
  ]);

  const anomalies = [
    ...goesResult.hotspots.map((hotspot, index) => ({
      id: `goes:${hotspot.ts}:${hotspot.lat.toFixed(4)}:${hotspot.lon.toFixed(4)}:${index}`,
      lat: hotspot.lat,
      lon: hotspot.lon,
      ts: hotspot.ts,
      source: 'GOES' as const,
      layer: hotspot.layer || ('goes-fdcf' as const),
      satellite: hotspot.satellite,
      sourceProduct: hotspot.sourceProduct,
      temperatureK: normalizeTemperatureK(hotspot.heat),
      frp: hotspot.frp,
      intensity: computeIntensity({ frp: hotspot.frp, temperatureK: normalizeTemperatureK(hotspot.heat), confidence: 'nominal' }),
    })),
    ...firmsPoints.map((point, index) => {
      const ts = parseFirmsDateTime(point.acq_date, point.acq_time).toISOString();
      return {
        id: `firms:${point.sourceProduct || 'unknown'}:${ts}:${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}:${index}`,
        lat: point.latitude,
        lon: point.longitude,
        ts,
        source: point.sourceFamily === 'geostationary' ? ('GOES' as const) : ('FIRMS' as const),
        layer: point.sourceLayer || ('thermal-anomaly' as const),
        satellite: point.satellite,
        sourceProduct: point.sourceProduct,
        brightnessK: point.brightness,
        frp: point.frp,
        confidence: point.confidence,
        intensity: computeIntensity({ frp: point.frp, brightnessK: point.brightness, confidence: point.confidence }),
      };
    }),
    ...sentinel3Result.hotspots.map((hotspot, index) => mapSentinel3Hotspot(hotspot, index)),
  ].sort((left, right) => new Date(right.ts).getTime() - new Date(left.ts).getTime());

  const maxIntensity = anomalies.reduce((max, anomaly) => Math.max(max, anomaly.intensity), 0);

  return {
    anomalies,
    status: anomalies.length > 0 ? 'active' : 'stale',
    bbox,
    generatedAt: new Date().toISOString(),
    sources: {
      goes: goesResult.hotspots.length,
      firms: firmsPoints.length,
      sentinel3: sentinel3Result.hotspots.length,
    },
    maxIntensity,
  };
}

function mapSentinel3Hotspot(hotspot: Sentinel3FrpHotspot, index: number): ThermalAnomaly {
  return {
    id: hotspot.id || `sentinel3:${hotspot.ts}:${hotspot.lat.toFixed(4)}:${hotspot.lon.toFixed(4)}:${index}`,
    lat: hotspot.lat,
    lon: hotspot.lon,
    ts: hotspot.ts,
    source: 'SENTINEL3',
    layer: 'sentinel3-slstr',
    satellite: hotspot.satellite,
    sourceProduct: hotspot.sourceProduct,
    frp: hotspot.frp,
    confidence: hotspot.confidence,
    intensity: computeIntensity({ frp: hotspot.frp, confidence: hotspot.confidence }),
  };
}

function computeIntensity(input: { frp?: number; brightnessK?: number; temperatureK?: number; confidence?: FireConfidence }) {
  const frpScore = typeof input.frp === 'number' ? Math.min(1, input.frp / 30) : 0;
  const brightness = input.brightnessK ?? input.temperatureK;
  const thermalScore = typeof brightness === 'number' ? Math.max(0, Math.min(1, (brightness - 300) / 90)) : 0;
  const confidenceScore = input.confidence === 'high' ? 0.22 : input.confidence === 'nominal' ? 0.12 : 0;
  return Math.max(0.12, Math.min(1, frpScore * 0.62 + thermalScore * 0.48 + confidenceScore));
}

function normalizeTemperatureK(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value < 180 ? value + 273.15 : value;
}
