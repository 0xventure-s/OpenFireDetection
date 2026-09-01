import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { NextRequest } from 'next/server';

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
};

describe('GET /api/fire/command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.incident.findMany.mockResolvedValue([
      makeDbFire({ id: 'active', status: 'confirmed', lifecycleStatus: 'active' }),
      makeDbFire({ id: 'archived', status: 'confirmed', lifecycleStatus: 'archived' }),
      makeDbFire({ id: 'false', status: 'false_positive', lifecycleStatus: 'closed' }),
    ] as never);
    mockedPrisma.incidentAssignment.findMany.mockResolvedValue([] as never);
    mockedPrisma.fireStation.findMany.mockResolvedValue([] as never);
    mockedPrisma.operationalUnit.findMany.mockResolvedValue([] as never);
    mockedPrisma.operationalAsset.findMany.mockResolvedValue([] as never);
  });

  it('returns a stable command payload without archived or false-positive incidents in the action queue', async () => {
    const response = await GET(openRequest('/api/fire/command'));
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.actionQueue.map((fire: { id: string }) => fire.id)).toEqual(['active']);
    expect(json.data.sourceHealth.map((item: { key: string }) => item.key)).toContain('GOES');
    expect(json.data.unitStatus.noCatalog).toBe(true);
    expect(json.data.assetCoverage.noCatalog).toBe(true);
  });

  it('still returns fire data when optional operational tables are not migrated', async () => {
    mockedPrisma.incidentAssignment.findMany.mockRejectedValueOnce(makeMissingTableError('incident_assignments') as never);
    mockedPrisma.fireStation.findMany.mockRejectedValueOnce(makeMissingTableError('fire_stations') as never);
    mockedPrisma.operationalUnit.findMany.mockRejectedValueOnce(makeMissingTableError('operational_units') as never);
    mockedPrisma.operationalAsset.findMany.mockRejectedValueOnce(makeMissingTableError('operational_assets') as never);

    const response = await GET(openRequest('/api/fire/command'));
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.activeFires.map((fire: { id: string }) => fire.id)).toEqual(['active']);
    expect(json.data.actionQueue.map((fire: { id: string }) => fire.id)).toEqual(['active']);
    expect(json.data.unitStatus.noCatalog).toBe(true);
    expect(json.data.assetCoverage.noCatalog).toBe(true);
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
    sources: [{ source: 'GOES', ts: '2026-05-11T11:55:00.000Z', frp: 1 }],
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
