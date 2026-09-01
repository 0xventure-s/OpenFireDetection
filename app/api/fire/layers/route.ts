import { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { FIRMS_CONFIG, JURISDICTION_NAME } from '@/lib/constants';
import { guardFireApi } from '../_auth';
import { getGoesStatus } from '@/lib/goes';
import { getHlsStatus } from '@/lib/hls';
import { getLightningStatus } from '@/lib/lightning';
import { getSentinel3Status } from '@/lib/sentinel3';
import { FIRMS_RESTRICTED_PRODUCTS, SATELLITE_LAYERS } from '@/lib/satellite-layers';

export async function GET(request: NextRequest) {
  const authResponse = await guardFireApi(request);
  if (authResponse) return authResponse;

  const goes = getGoesStatus();
  const lightning = getLightningStatus();
  const sentinel3 = getSentinel3Status();
  const hls = getHlsStatus();

  return ok({
    layers: SATELLITE_LAYERS,
    activeProducts: {
      firms: FIRMS_CONFIG.SATELLITES,
      firmsRestrictedOutsideJurisdiction: FIRMS_RESTRICTED_PRODUCTS,
      goes: {
        enabled: goes.enabled,
        dataset: goes.dataset,
        cadenceMinutes: goes.cadenceMinutes,
        maxFallbackMinutes: goes.maxFallbackMinutes,
        reason: goes.reason,
      },
      lightning: {
        enabled: lightning.enabled,
        dataset: lightning.dataset,
        cadenceSeconds: lightning.cadenceSeconds,
        maxFallbackMinutes: lightning.maxFallbackMinutes,
        reason: lightning.reason,
      },
      sentinel3: {
        enabled: sentinel3.enabled,
        hasPreprocessedFeed: sentinel3.hasPreprocessedFeed,
        hasEumetsatCredentials: sentinel3.hasEumetsatCredentials,
        dataset: sentinel3.dataset,
        collection: sentinel3.collection,
        lookbackHours: sentinel3.lookbackHours,
        reason: sentinel3.reason,
      },
      hls: {
        enabled: hls.enabled,
        dataset: hls.dataset,
        collections: hls.collections,
        lookbackDays: hls.lookbackDays,
        reason: hls.reason,
      },
      thermal: {
        enabled: true,
        source: 'GOES/FIRMS/Sentinel-3 thermal anomaly aggregation',
        endpoint: '/api/fire/thermal',
      },
      environmental: {
        weatherForecast: {
          scope: JURISDICTION_NAME,
          endpoint: '/api/fire/weather/forecast',
          refreshMinutes: 15,
        },
        earthquakes: {
          scope: JURISDICTION_NAME,
          source: 'USGS Earthquake Catalog',
          endpoint: '/api/fire/earthquakes',
          lookbackHours: 168,
        },
      },
    },
  });
}
