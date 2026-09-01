import { describe, expect, it } from 'vitest';
import { buildOperationalContext } from '@/lib/incident-context';
import { Fire } from '@/types';

function makeFire(partial: Partial<Fire>): Fire {
  return {
    id: 'fire-1',
    lat: -27.5,
    lon: -67,
    geom: 'POINT(-67 -27.5)',
    detectedAt: '2026-04-28T10:00:00.000Z',
    confirmed: false,
    confirmedBy: null,
    confirmedAt: null,
    status: 'unconfirmed',
    lifecycleStatus: 'active',
    sources: [],
    payload: {},
    manual: false,
    createdAt: '2026-04-28T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
    ...partial,
  };
}

describe('incident operational context', () => {
  it('recommends reinforced resources for remote high-risk windy incidents', () => {
    const context = buildOperationalContext(
      makeFire({
        lat: -26.8,
        lon: -67.4,
        status: 'confirmed',
        sources: [{ source: 'FIRMS', ts: '2026-04-28T10:00:00.000Z', frp: 14, confidence: 'high' }],
      }),
      {
        source: 'Open-Meteo',
        observedAt: '2026-04-28T10:00:00.000Z',
        temperatureC: 35,
        humidityPct: 16,
        windSpeedKmh: 45,
        windGustKmh: 62,
      },
      {
        source: 'Open-Meteo Elevation',
        observedAt: '2026-04-28T10:00:00.000Z',
        altitudeM: 2200,
        slopeDeg: 10,
      }
    );

    expect(context.accessCondition).toBe('remote');
    expect(context.resourceLevel).toBe('reinforced');
    expect(context.recommendedResources).toContain('comunicaciones VHF/satelital');
    expect(context.recommendedResources).toContain('observador de viento y columna');
  });

  it('keeps low-risk accessible incidents in monitoring mode', () => {
    const context = buildOperationalContext(
      makeFire({
        lat: -28.45,
        lon: -65.78,
        sources: [{ source: 'GOES', ts: '2026-04-28T10:00:00.000Z', frp: 0.8 }],
      }),
      null,
      {
        source: 'estimado-local',
        observedAt: '2026-04-28T10:00:00.000Z',
        altitudeM: 550,
        slopeDeg: 2,
      }
    );

    expect(context.accessCondition).toBe('direct');
    expect(context.resourceLevel).toBe('monitor');
  });
});
