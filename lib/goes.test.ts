import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectHeatFromGOES,
  mapEarthEngineFeatureToHotspot,
  normalizeGoesHotspot,
  parseAcquisitionTimestamp,
  resetEarthEngineForTests,
} from '@/lib/goes';
import { JURISDICTION_BBOX } from '@/lib/constants';

describe('GOES utilities', () => {
  const originalServiceAccount = process.env.EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64;
  const originalProject = process.env.EARTH_ENGINE_PROJECT_ID;

  beforeEach(() => {
    delete process.env.EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64;
    delete process.env.EARTH_ENGINE_PROJECT_ID;
    resetEarthEngineForTests();
  });

  afterEach(() => {
    if (originalServiceAccount === undefined) delete process.env.EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64;
    else process.env.EARTH_ENGINE_SERVICE_ACCOUNT_JSON_BASE64 = originalServiceAccount;

    if (originalProject === undefined) delete process.env.EARTH_ENGINE_PROJECT_ID;
    else process.env.EARTH_ENGINE_PROJECT_ID = originalProject;

    resetEarthEngineForTests();
  });

  it('normalizes GOES hotspot payloads', () => {
    const hotspot = normalizeGoesHotspot({
      latitude: '-27.5',
      longitude: '-67.0',
      bright_ti4: '335.4',
      frp: '8.1',
      confidence: '85',
      acq_date: '2026-04-28',
      acq_time: '0915',
      satellite: 'GOES-19',
    });

    expect(hotspot).toMatchObject({
      lat: -27.5,
      lon: -67,
      heat: 335.4,
      frp: 8.1,
      confidence: 85,
      satellite: 'GOES-19',
    });
  });

  it('builds ISO timestamps from acquisition parts', () => {
    expect(parseAcquisitionTimestamp('2026-04-28', '915')).toBe('2026-04-28T09:15:00.000Z');
  });

  it('maps Earth Engine fire features to GOES hotspots', () => {
    const hotspot = mapEarthEngineFeatureToHotspot(
      {
        geometry: {
          type: 'Point',
          coordinates: [-65, -30],
        },
        properties: {
          Mask: 10,
          Temp: 6200,
          Power: 12.4,
          Area: 3,
          system_time_start: Date.UTC(2026, 3, 28, 10, 10),
        },
      },
      JURISDICTION_BBOX
    );

    expect(hotspot).toMatchObject({
      lat: -30,
      lon: -65,
      satellite: 'GOES-19',
      maskCode: 10,
      frp: 12.4,
      areaM2: 182.94,
      ts: '2026-04-28T10:10:00.000Z',
    });
    expect(hotspot?.heat).toBeCloseTo(340.60754, 5);
  });

  it('ignores Earth Engine features without valid fire geometry', () => {
    expect(
      mapEarthEngineFeatureToHotspot(
        {
          properties: {
            Mask: 10,
            system_time_start: Date.UTC(2026, 3, 28, 10, 10),
          },
        },
        JURISDICTION_BBOX
      )
    ).toBeNull();

    expect(
      mapEarthEngineFeatureToHotspot(
        {
          geometry: {
            type: 'Point',
            coordinates: [-60, -20],
          },
          properties: {
            Mask: 10,
            system_time_start: Date.UTC(2026, 3, 28, 10, 10),
          },
        },
        JURISDICTION_BBOX
      )
    ).toBeNull();

    expect(
      mapEarthEngineFeatureToHotspot(
        {
          geometry: {
            type: 'Point',
            coordinates: [-65.2226, -26.8241],
          },
          properties: {
            Mask: 10,
            system_time_start: Date.UTC(2026, 3, 28, 10, 10),
          },
        },
        JURISDICTION_BBOX
      )
    ).toBeNull();
  });

  it('returns no GOES hotspots when Earth Engine credentials are missing', async () => {
    await expect(detectHeatFromGOES(JURISDICTION_BBOX)).resolves.toEqual([]);
  }, 15_000);
});
