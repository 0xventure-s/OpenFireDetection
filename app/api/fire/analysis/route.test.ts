import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@/lib/operator-auth', () => ({
  OperatorAuthError: class OperatorAuthError extends Error { status = 401; },
  requireOperator: vi.fn(async () => ({
    id: 'user-1',
    name: 'Guardia',
    email: 'guardia@example.test',
    organizationId: 'org-community',
    organizationName: 'la jurisdicción',
    role: 'operator',
    mustChangePassword: false,
  })),
}));

vi.mock('@/lib/jurisdiction', () => ({
  isPointInJurisdiction: () => true,
}));

vi.mock('@/lib/db', () => ({
  db: {
    closeStaleUnactionedFires: vi.fn(async () => ({ closed: 0, cutoff: new Date('2026-05-11T00:00:00.000Z') })),
  },
  prisma: {
    incident: {
      findMany: vi.fn(),
    },
    incidentAssignment: {
      findMany: vi.fn(),
    },
    operationalUnit: {
      findMany: vi.fn(),
    },
    fireStation: {
      findMany: vi.fn(),
    },
    operationalAsset: {
      findMany: vi.fn(),
    },
    scanRun: {
      findFirst: vi.fn(),
    },
  },
}));

import { GET } from './route';
import { prisma } from '@/lib/db';

const mockedPrisma = prisma as unknown as {
  incident: { findMany: Mock };
  incidentAssignment: { findMany: Mock };
  fireStation: { findMany: Mock };
  operationalUnit: { findMany: Mock };
  operationalAsset: { findMany: Mock };
  scanRun: { findFirst: Mock };
};

describe('GET /api/fire/analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.incident.findMany.mockResolvedValue([
      makeDbFire({ id: 'active', status: 'confirmed', lifecycleStatus: 'active' }),
      makeDbFire({ id: 'archived', status: 'confirmed', lifecycleStatus: 'archived', detectedAt: new Date('2026-04-01T10:00:00.000Z') }),
    ] as never);
    mockedPrisma.incidentAssignment.findMany.mockResolvedValue([] as never);
    mockedPrisma.fireStation.findMany.mockResolvedValue([] as never);
    mockedPrisma.operationalUnit.findMany.mockResolvedValue([] as never);
    mockedPrisma.operationalAsset.findMany.mockResolvedValue([] as never);
    mockedPrisma.scanRun.findFirst.mockResolvedValue(null as never);
  });

  it('returns the tactical analysis payload for the requested period', async () => {
    const request = openRequest('/api/fire/analysis?period=24h');
    const response = await GET(request);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.period).toBe('24h');
    expect(json.data.headline).toEqual(expect.objectContaining({ riskScore: expect.any(Number) }));
    expect(json.data.sourceMatrix.map((source: { key: string }) => source.key)).toContain('GOES');
    expect(json.data.incidents.map((incident: { id: string }) => incident.id)).toContain('active');
  });

  it('normalizes invalid periods and tolerates missing operational tables', async () => {
    mockedPrisma.incidentAssignment.findMany.mockRejectedValueOnce(makeMissingTableError('incident_assignments') as never);
    mockedPrisma.fireStation.findMany.mockRejectedValueOnce(makeMissingTableError('fire_stations') as never);
    mockedPrisma.operationalUnit.findMany.mockRejectedValueOnce(makeMissingTableError('operational_units') as never);
    mockedPrisma.operationalAsset.findMany.mockRejectedValueOnce(makeMissingTableError('operational_assets') as never);

    const request = openRequest('/api/fire/analysis?period=invalid');
    const response = await GET(request);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.period).toBe('30d');
    expect(json.data.resources.noUnitCatalog).toBe(true);
    expect(json.data.resources.noAssetCatalog).toBe(true);
  });
});

function makeMissingTableError(table: string) {
  return Object.assign(new Error(`The table public.${table} does not exist in the current database.`), {
    code: 'P2021',
  });
}

function openRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function makeDbFire(partial: Record<string, unknown>) {
  return {
    id: 'fire-1',
    lat: -28.47,
    lon: -65.78,
    geom: 'POINT(-65.78 -28.47)',
    detectedAt: new Date('2026-05-11T10:00:00.000Z'),
    confirmed: false,
    confirmedBy: null,
    confirmedAt: null,
    status: 'unconfirmed',
    lifecycleStatus: 'active',
    sources: [{ source: 'GOES', layer: 'goes-fdcf', ts: '2026-05-11T11:55:00.000Z', frp: 1 }],
    payload: {},
    manual: false,
    createdAt: new Date('2026-05-11T10:00:00.000Z'),
    updatedAt: new Date('2026-05-11T11:58:00.000Z'),
    dataFreshness: {},
    weatherSnapshot: null,
    terrainSnapshot: null,
    projectionSnapshot: null,
    extinguishedBy: null,
    extinguishedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    dispatchedAt: null,
    dispatchedBy: null,
    closedAt: null,
    ...partial,
  };
}
