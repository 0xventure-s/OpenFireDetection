import { describe, expect, it } from 'vitest';
import {
  buildActionQueue,
  buildAssetCoverage,
  buildCommandDashboard,
  buildSourceHealth,
} from '@/lib/command-dashboard';
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
    sources: [{ source: 'GOES', ts: '2026-05-11T11:55:00.000Z', frp: 1 }],
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

describe('command dashboard helpers', () => {
  it('keeps terminal incidents out of the action queue', () => {
    const queue = buildActionQueue(
      [
        makeFire({ id: 'active', status: 'confirmed' }),
        makeFire({ id: 'false', status: 'false_positive', lifecycleStatus: 'closed' }),
        makeFire({ id: 'out', status: 'extinguished', lifecycleStatus: 'closed' }),
      ],
      [],
      NOW
    );

    expect(queue.map((fire) => fire.id)).toEqual(['active']);
  });

  it('ranks critical incidents before lower priority work', () => {
    const queue = buildActionQueue(
      [
        makeFire({ id: 'low', sources: [{ source: 'GOES', ts: '2026-05-11T11:55:00.000Z', frp: 1 }] }),
        makeFire({
          id: 'critical',
          status: 'confirmed',
          sources: [{ source: 'FIRMS', ts: '2026-05-11T11:55:00.000Z', frp: 14, confidence: 'high' }],
        }),
      ],
      [],
      NOW
    );

    expect(queue[0].id).toBe('critical');
    expect(queue[0].actionReason).toBe('meteo critica');
  });

  it('marks confirmed incidents without assignment as no-unit decisions', () => {
    const queue = buildActionQueue(
      [
        makeFire({
          id: 'confirmed',
          status: 'confirmed',
          reviewedAt: '2026-05-11T10:15:00.000Z',
          sources: [{ source: 'GOES', ts: '2026-05-11T11:55:00.000Z', frp: 2 }],
        }),
      ],
      [],
      NOW
    );

    expect(queue[0].actionReason).toBe('sin unidad');
    expect(queue[0].nextAction).toBe('Asignar unidad');
  });

  it('uses active assignments to avoid no-unit noise', () => {
    const fire = makeFire({
      id: 'assigned',
      status: 'confirmed',
      reviewedAt: '2026-05-11T10:15:00.000Z',
      sources: [{ source: 'GOES', ts: '2026-05-11T11:55:00.000Z', frp: 2 }],
    });
    const queue = buildActionQueue([fire], [makeAssignment({ fireId: 'assigned' })], NOW);

    expect(queue[0].assignment?.unitName).toBe('Movil 1');
    expect(queue[0].actionReason).not.toBe('sin unidad');
  });

  it('calculates source health freshness', () => {
    const health = buildSourceHealth(
      [
        makeFire({
          sources: [
            { source: 'GOES', ts: '2026-05-11T11:50:00.000Z' },
            { source: 'FIRMS', ts: '2026-05-11T02:00:00.000Z' },
          ],
          weatherSnapshot: { source: 'Open-Meteo', observedAt: '2026-05-11T11:30:00.000Z' },
        }),
      ],
      NOW
    );

    expect(health.find((item) => item.key === 'GOES')?.status).toBe('fresh');
    expect(health.find((item) => item.key === 'FIRMS')?.status).toBe('stale');
    expect(health.find((item) => item.key === 'weather')?.status).toBe('fresh');
  });

  it('marks missing resource catalog data instead of inventing it', () => {
    const dashboard = buildCommandDashboard({
      fires: [makeFire({ status: 'confirmed' })],
      units: [] as OperationalUnit[],
      assets: [] as OperationalAsset[],
      assignments: [],
      now: NOW,
    });

    expect(dashboard.unitStatus.noCatalog).toBe(true);
    expect(dashboard.assetCoverage.noCatalog).toBe(true);
    expect(dashboard.maintenanceStatus.totalOpen).toBe(0);
    expect(buildAssetCoverage([]).missingWaterSources).toBe(true);
  });
});
