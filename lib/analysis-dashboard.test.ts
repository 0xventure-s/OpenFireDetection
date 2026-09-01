import { describe, expect, it } from 'vitest';
import { buildAnalysisDashboard, normalizeAnalysisPeriod } from '@/lib/analysis-dashboard';
import { Fire, IncidentAssignment, OperationalAsset, OperationalUnit } from '@/types';

const NOW = Date.parse('2026-05-11T12:00:00.000Z');

function makeFire(partial: Partial<Fire>): Fire {
  return {
    id: 'fire-1',
    lat: -28.47,
    lon: -65.78,
    geom: 'POINT(-65.78 -28.47)',
    detectedAt: '2026-05-11T10:00:00.000Z',
    confirmed: false,
    confirmedBy: null,
    confirmedAt: null,
    status: 'unconfirmed',
    lifecycleStatus: 'active',
    sources: [{ source: 'GOES', layer: 'goes-fdcf', ts: '2026-05-11T11:55:00.000Z', frp: 1 }],
    payload: {},
    manual: false,
    createdAt: '2026-05-11T10:00:00.000Z',
    updatedAt: '2026-05-11T11:58:00.000Z',
    ...partial,
  };
}

function makeAssignment(partial: Partial<IncidentAssignment>): IncidentAssignment {
  return {
    id: 'assignment-1',
    fireId: 'fire-1',
    unitId: null,
    assetId: null,
    unitName: 'Movil 1',
    role: 'primary',
    status: 'assigned',
    assignedAt: '2026-05-11T11:00:00.000Z',
    assignedBy: 'guardia-central',
    releasedAt: null,
    notes: null,
    payload: {},
    createdAt: '2026-05-11T11:00:00.000Z',
    updatedAt: '2026-05-11T11:00:00.000Z',
    ...partial,
  };
}

describe('analysis dashboard helpers', () => {
  it('normalizes invalid periods to the 30 day tactical default', () => {
    expect(normalizeAnalysisPeriod('bad')).toBe('30d');
    expect(normalizeAnalysisPeriod('24h')).toBe('24h');
    expect(normalizeAnalysisPeriod('90d')).toBe('90d');
  });

  it('calculates headline pressure and critical drivers from active incidents', () => {
    const dashboard = buildAnalysisDashboard({
      fires: [
        makeFire({
          id: 'critical',
          status: 'confirmed',
          weatherSnapshot: {
            temperatureC: 34,
            humidityPct: 18,
            windSpeedKmh: 32,
            observedAt: '2026-05-11T11:40:00.000Z',
          },
          sources: [{ source: 'FIRMS', layer: 'viirs-noaa21', ts: '2026-05-11T11:50:00.000Z', frp: 16, confidence: 'high' }],
        }),
      ],
      now: NOW,
    });

    expect(dashboard.headline.riskLevel).toBe('critical');
    expect(dashboard.headline.topDriver).toBe('Meteo critica');
    expect(dashboard.drivers.map((driver) => driver.id)).toContain('meteo-critica');
    expect(dashboard.incidents[0].id).toBe('critical');
  });

  it('keeps active incidents older than the selected period in scope', () => {
    const dashboard = buildAnalysisDashboard({
      period: '24h',
      fires: [
        makeFire({
          id: 'old-active',
          detectedAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-05-11T11:58:00.000Z',
          status: 'confirmed',
          sources: [{ source: 'GOES', ts: '2026-05-11T11:50:00.000Z', frp: 2 }],
        }),
      ],
      now: NOW,
    });

    expect(dashboard.timeline.map((bucket) => bucket.label)).toContain('Activos previos');
    expect(dashboard.incidents.map((incident) => incident.id)).toContain('old-active');
  });

  it('groups timeline and hot zones from scoped fires', () => {
    const dashboard = buildAnalysisDashboard({
      fires: [
        makeFire({ id: 'center-1', lat: -30, lon: -65, status: 'confirmed' }),
        makeFire({ id: 'center-2', lat: -30.1, lon: -64.9, status: 'probable' }),
        makeFire({ id: 'west-1', lat: -30, lon: -66.5, status: 'unconfirmed' }),
      ],
      assignments: [makeAssignment({ fireId: 'center-1' })],
      now: NOW,
    });

    const center = dashboard.zones.find((zone) => zone.label === 'Centro');
    expect(center?.count).toBe(2);
    expect(center?.confirmed).toBe(1);
    expect(dashboard.timeline.reduce((sum, bucket) => sum + bucket.detected, 0)).toBe(3);
  });

  it('marks stale and missing sources without inventing freshness', () => {
    const dashboard = buildAnalysisDashboard({
      fires: [
        makeFire({
          id: 'stale-goes',
          sources: [{ source: 'GOES', ts: '2026-05-10T12:00:00.000Z', frp: 1 }],
          updatedAt: '2026-05-10T12:00:00.000Z',
        }),
      ],
      now: NOW,
    });

    expect(dashboard.sourceMatrix.find((source) => source.key === 'GOES')?.status).toBe('stale');
    expect(dashboard.sourceMatrix.find((source) => source.key === 'viirs-noaa21')?.status).toBe('missing');
  });

  it('uses successful scan freshness for sources checked without new detections', () => {
    const dashboard = buildAnalysisDashboard({
      fires: [
        makeFire({
          id: 'historical-goes',
          lifecycleStatus: 'closed',
          sources: [{ source: 'GOES', layer: 'firms-goes-nrt', ts: '2026-05-10T12:00:00.000Z', frp: 1 }],
          updatedAt: '2026-05-10T12:00:00.000Z',
        }),
      ],
      latestScan: {
        status: 'success',
        startedAt: '2026-05-11T11:58:00.000Z',
        finishedAt: '2026-05-11T11:59:00.000Z',
        summary: 'sin cambios | GOES directo: 0 | GOES FIRMS: 0 | FIRMS polar: 0 | Sentinel-3: 0',
      },
      now: NOW,
    });

    expect(dashboard.sourceMatrix.find((source) => source.key === 'GOES')?.status).toBe('fresh');
    expect(dashboard.sourceMatrix.find((source) => source.key === 'FIRMS')?.status).toBe('fresh');
    expect(dashboard.sourceMatrix.find((source) => source.key === 'sentinel3-slstr')?.status).toBe('fresh');
    expect(dashboard.sourceMatrix.find((source) => source.key === 'GOES')?.latestAt).toBe('2026-05-11T11:59:00.000Z');
  });

  it('does not borrow GOES freshness for the thermal layer when no thermal source exists', () => {
    const dashboard = buildAnalysisDashboard({
      fires: [
        makeFire({
          id: 'goes-only',
          sources: [{ source: 'GOES', layer: 'firms-goes-nrt', ts: '2026-05-11T11:55:00.000Z', frp: 1 }],
        }),
      ],
      now: NOW,
    });

    expect(dashboard.sourceMatrix.find((source) => source.key === 'thermal-anomaly')?.status).toBe('missing');
  });

  it('calculates operational debt from review, unit and weather gaps', () => {
    const dashboard = buildAnalysisDashboard({
      fires: [
        makeFire({
          id: 'debt',
          status: 'confirmed',
          reviewedAt: null,
          weatherSnapshot: null,
          sources: [{ source: 'FIRMS', layer: 'viirs-noaa21', ts: '2026-05-11T11:50:00.000Z', frp: 4 }],
        }),
      ],
      units: [] as OperationalUnit[],
      assets: [] as OperationalAsset[],
      now: NOW,
    });

    expect(dashboard.headline.operationalDebt).toBe(3);
    expect(dashboard.drivers.map((driver) => driver.id)).toContain('sin-unidad');
    expect(dashboard.weather.withoutWeatherFireIds).toEqual(['debt']);
  });
});
