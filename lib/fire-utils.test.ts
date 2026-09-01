import { describe, expect, it } from 'vitest';
import { buildCommandAlerts, compareByPriorityAndTime, derivePriority, deriveRiskScore, deriveOperationalStatus, enrichFire } from '@/lib/fire-utils';
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

describe('fire command helpers', () => {
  it('derives operational status from payload and terminal states', () => {
    expect(deriveOperationalStatus(makeFire({ payload: { operationalStatus: 'dispatched' } }))).toBe('dispatched');
    expect(deriveOperationalStatus(makeFire({ status: 'false_positive' }))).toBe('closed');
  });

  it('escalates priority based on confirmed high FRP incidents', () => {
    expect(
      derivePriority(
        makeFire({
          status: 'confirmed',
          sources: [{ source: 'FIRMS', ts: '2026-04-28T10:00:00.000Z', frp: 12, confidence: 'high' }],
        })
      )
    ).toBe('critical');
  });

  it('adds weather pressure to priority and risk score', () => {
    const fire = makeFire({
      sources: [{ source: 'GOES', ts: '2026-04-28T10:00:00.000Z', frp: 2 }],
      weatherSnapshot: {
        source: 'Open-Meteo',
        observedAt: '2026-04-28T10:00:00.000Z',
        temperatureC: 35,
        humidityPct: 14,
        windSpeedKmh: 42,
        windGustKmh: 58,
      },
    });

    expect(derivePriority(fire)).toBe('high');
    expect(deriveRiskScore(fire)).toBeGreaterThan(45);
  });

  it('orders same-priority incidents by risk score before age', () => {
    const older = enrichFire(
      makeFire({
        id: 'older',
        detectedAt: '2026-04-28T09:00:00.000Z',
        sources: [{ source: 'GOES', ts: '2026-04-28T09:00:00.000Z', frp: 1 }],
      })
    );
    const windy = enrichFire(
      makeFire({
        id: 'windy',
        detectedAt: '2026-04-28T08:00:00.000Z',
        sources: [{ source: 'GOES', ts: '2026-04-28T08:00:00.000Z', frp: 1 }],
        weatherSnapshot: {
          source: 'Open-Meteo',
          observedAt: '2026-04-28T08:00:00.000Z',
          temperatureC: 31,
          humidityPct: 22,
          windSpeedKmh: 30,
        },
      })
    );

    expect([older, windy].sort(compareByPriorityAndTime)[0].id).toBe('windy');
  });

  it('builds prioritized alerts from enriched incidents', () => {
    const fires = [
      enrichFire(
        makeFire({
          id: 'critical',
          status: 'confirmed',
          sources: [{ source: 'FIRMS', ts: '2026-04-28T10:00:00.000Z', frp: 11, confidence: 'high' }],
        })
      ),
      enrichFire(
        makeFire({
          id: 'new',
          detectedAt: '2026-04-28T11:00:00.000Z',
          sources: [{ source: 'GOES', ts: '2026-04-28T11:00:00.000Z' }],
        })
      ),
    ];

    const alerts = buildCommandAlerts(fires);
    expect(alerts[0].fireId).toBe('critical');
    expect(alerts[0].kind).toBe('critical');
    expect(alerts).toHaveLength(2);
  });

  it('defaults terminal or test incidents out of the active lifecycle when enriching old records', () => {
    expect(enrichFire(makeFire({ lifecycleStatus: undefined as never, status: 'false_positive' })).lifecycleStatus).toBe('closed');
    expect(enrichFire(makeFire({ lifecycleStatus: undefined as never, payload: { test: true } })).lifecycleStatus).toBe('test');
  });
});
