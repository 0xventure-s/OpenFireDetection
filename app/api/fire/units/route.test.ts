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

vi.mock('@/lib/db', () => ({
  prisma: {
    operationalUnit: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    operationalAudit: {
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/db';

const mockedPrisma = prisma as unknown as {
  operationalUnit: { findMany: Mock; create: Mock };
  operationalAudit: { create: Mock };
};

describe('/api/fire/units', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.operationalUnit.findMany.mockResolvedValue([] as never);
    mockedPrisma.operationalAudit.create.mockResolvedValue({} as never);
  });

  it('returns an empty real catalog when operational tables are missing', async () => {
    mockedPrisma.operationalUnit.findMany.mockRejectedValueOnce(
      Object.assign(new Error('The table public.operational_units does not exist.'), { code: 'P2021' })
    );

    const response = await GET(openRequest('/api/fire/units'));
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.items).toEqual([]);
  });

  it('returns the catalog for the authenticated organization', async () => {
    const response = await GET(new NextRequest('http://localhost/api/fire/units'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.items).toEqual([]);
    expect(mockedPrisma.operationalUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-community' } })
    );
  });

  it('creates a real unit and writes operational audit metadata', async () => {
    mockedPrisma.operationalUnit.create.mockResolvedValue({
      id: 'unit-1',
      code: 'M-01',
      name: 'Autobomba 1',
      type: 'engine',
      stationId: null,
      status: 'available',
      baseName: null,
      contact: null,
      licensePlate: null,
      capacityLiters: 3000,
      crewCapacity: 5,
      lat: null,
      lon: null,
      notes: null,
      payload: {},
      createdAt: new Date('2026-05-19T10:00:00.000Z'),
      updatedAt: new Date('2026-05-19T10:00:00.000Z'),
      station: null,
      maintenanceRecords: [],
    } as never);

    const request = new NextRequest('http://localhost/api/fire/units', {
      method: 'POST',
      body: JSON.stringify({
        code: 'M-01',
        name: 'Autobomba 1',
        type: 'engine',
        capacityLiters: 3000,
        crewCapacity: 5,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Autobomba 1');
    expect(mockedPrisma.operationalAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: 'unit-1',
          action: 'unit_created',
          actor: 'user-1',
          organizationId: 'org-community',
        }),
      })
    );
  });

  it('uses the authenticated user identity when creating a unit', async () => {
    mockedPrisma.operationalUnit.create.mockResolvedValue({
      id: 'unit-2',
      code: 'M-02',
      name: 'Autobomba 2',
      type: 'engine',
      stationId: null,
      status: 'available',
      baseName: null,
      contact: null,
      licensePlate: null,
      capacityLiters: 2500,
      crewCapacity: 4,
      lat: null,
      lon: null,
      notes: null,
      payload: {},
      createdAt: new Date('2026-05-19T10:00:00.000Z'),
      updatedAt: new Date('2026-05-19T10:00:00.000Z'),
      station: null,
      maintenanceRecords: [],
    } as never);

    const request = new NextRequest('http://localhost/api/fire/units', {
      method: 'POST',
      body: JSON.stringify({
        code: 'M-02',
        name: 'Autobomba 2',
        type: 'engine',
        capacityLiters: 2500,
        crewCapacity: 4,
      }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(mockedPrisma.operationalAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: 'unit-2',
          action: 'unit_created',
          actor: 'user-1',
          organizationId: 'org-community',
        }),
      })
    );
  });
});

function openRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}
