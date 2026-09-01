import { NASA_GIBS_PRECIPITATION_METADATA_URL } from '@/lib/constants';
import type { PrecipitationLayerMetadata } from '@/types';

const PRECIPITATION_METADATA_TIMEOUT_MS = 5000;

export async function fetchPrecipitationLayerMetadata(): Promise<PrecipitationLayerMetadata> {
  const response = await fetch(NASA_GIBS_PRECIPITATION_METADATA_URL, {
    method: 'HEAD',
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(PRECIPITATION_METADATA_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NASA GIBS precipitation metadata failed: ${response.status}`);
  }

  const observedAt = response.headers.get('layer-time-actual');
  if (!observedAt || !Number.isFinite(new Date(observedAt).getTime())) {
    throw new Error('NASA GIBS precipitation metadata has no valid observation time');
  }

  return {
    generatedAt: new Date().toISOString(),
    observedAt: new Date(observedAt).toISOString(),
    source: 'NASA GPM IMERG Early / GIBS',
    product: 'IMERG_Precipitation_Rate_30min',
    intervalMinutes: 30,
    spatialResolutionKm: 10,
    approximateLatencyHours: 4,
    role: 'risk',
  };
}
