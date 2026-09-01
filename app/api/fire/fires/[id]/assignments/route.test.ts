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
  db: {
    getFireById: vi.fn(),
    updateFire: vi.fn(),
  },
  prisma: {
    incidentAssignment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    operationalUnit: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    operationalAsset: {
      findFirst: vi.fn(),
    },
    maintenanceRecord: {
      count: vi.fn(),
    },
    fireAudit: {
      create: vi.fn(),
    },
    operationalAudit: {
      create: vi.fn(),
    },
  },
}));

import { DELETE, POST } from './route';
import { db, prisma } from '@/lib/db';

const mockedDb = db as unknown as { getFireById: Mock; updateFire: Mock };
const mockedPrisma = prisma as unknown as {
  operationalUnit: { findFirst: Mock; update: Mock };
  operationalAsset: { findFirst: Mock };
  incidentAssignment: { create: Mock; update: Mock };
  maintenanceRecord: { count: Mock };
  fireAudit: { create: Mock };
  operationalAudit: { create: Mock };
};

describe('POST /api/fire/fires/[id]/assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.getFireById.mockResolvedValue({ id: 'fire-1', payload: {} });
  });

  it('does not dispatch units that are in maintenance', async () => {
    mockedPrisma.operationalUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      name: 'Autobomba 1',
      status: 'maintenance',
    });

    const request = new NextRequest('http://localhost/api/fire/fires/fire-1/assignments', {
      method: 'POST',
      body: JSON.stringify({ unitId: 'unit-1', status: 'assigned' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'fire-1' }) });
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.success).toBe(false);
    expect(mockedPrisma.incidentAssignment.create).not.toHaveBeenCalled();
    expect(mockedPrisma.operationalUnit.update).not.toHaveBeenCalled();
  });

  it('does not dispatch units that are already assigned or unavailable', async () => {
    for (const status of ['assigned', 'unavailable']) {
      vi.clearAllMocks();
      mockedDb.getFireById.mockResolvedValue({ id: 'fire-1', payload: {} });
      mockedPrisma.operationalUnit.findFirst.mockResolvedValue({
        id: 'unit-1',
        name: 'Autobomba 1',
        status,
      });

      const request = new NextRequest('http://localhost/api/fire/fires/fire-1/assignments', {
        method: 'POST',
        body: JSON.stringify({ unitId: 'unit-1', status: 'assigned' }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'fire-1' }) });

      expect(response.status).toBe(409);
      expect(mockedPrisma.incidentAssignment.create).not.toHaveBeenCalled();
      expect(mockedPrisma.operationalUnit.update).not.toHaveBeenCalled();
    }
  });

  it('keeps a released unit in maintenance when it has open maintenance', async () => {
    mockedPrisma.incidentAssignment.update.mockResolvedValue({
      id: 'assignment-1',
      fireId: 'fire-1',
      unitId: 'unit-1',
      assetId: null,
      unitName: 'Autobomba 1',
      role: 'primary',
      status: 'released',
      notes: null,
    });
    mockedPrisma.maintenanceRecord.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/fire/fires/fire-1/assignments?assignmentId=assignment-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'fire-1' }) });

    expect(response.status).toBe(200);
    expect(mockedPrisma.operationalUnit.update).toHaveBeenCalledWith({
      where: { id: 'unit-1', organizationId: 'org-community' },
      data: { status: 'maintenance' },
    });
  });
});
