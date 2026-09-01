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

vi.mock('@/lib/detection', () => ({
  detectOnJurisdiction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    createScanRun: vi.fn(),
    completeScanRun: vi.fn(),
    failScanRun: vi.fn(),
    getScanStatus: vi.fn(),
  },
}));

import { POST } from './route';
import { GET as GET_STATUS } from './status/route';
import { detectOnJurisdiction } from '@/lib/detection';
import { db } from '@/lib/db';

const mockedDetect = detectOnJurisdiction as Mock;
const mockedDb = db as unknown as {
  createScanRun: Mock;
  completeScanRun: Mock;
  failScanRun: Mock;
  getScanStatus: Mock;
};

describe('/api/fire/scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.createScanRun.mockResolvedValue({ id: 'scan-1' });
    mockedDb.completeScanRun.mockResolvedValue({ id: 'scan-1', status: 'success' });
    mockedDb.failScanRun.mockResolvedValue({ id: 'scan-1', status: 'failed' });
    mockedDetect.mockResolvedValue({
      scannedAt: '2026-05-25T10:00:00.000Z',
      new: 1,
      updated: 2,
      confirmed: 1,
      closed: 0,
      fires: [],
      summary: '1 nuevo, 2 actualizados',
    });
  });

  it('records a manual scan run and returns the scan metadata', async () => {
    const response = await POST(openPost({}));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.scanRunId).toBe('scan-1');
    expect(json.data.triggerType).toBe('manual');
    expect(mockedDb.createScanRun).toHaveBeenCalledWith({
      organizationId: 'org-community',
      triggerType: 'manual',
      triggeredBy: 'user-1',
    });
    expect(mockedDb.completeScanRun).toHaveBeenCalledWith(
      'scan-1',
      'org-community',
      expect.objectContaining({ summary: '1 nuevo, 2 actualizados' }),
      expect.any(Number)
    );
  });

  it('records a polling scan run without using a scheduled route', async () => {
    const response = await POST(openPost({ triggerType: 'polling' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.triggerType).toBe('polling');
    expect(mockedDb.createScanRun).toHaveBeenCalledWith({
      organizationId: 'org-community',
      triggerType: 'polling',
      triggeredBy: 'user-1',
    });
  });

  it('returns scan status for the authenticated organization', async () => {
    mockedDb.getScanStatus.mockResolvedValue({
      latest: { id: 'scan-1', status: 'success' },
      latestSuccess: { id: 'scan-1', status: 'success' },
      latestFailure: null,
      nextClientPollAt: '2026-05-25T10:10:00.000Z',
      pollIntervalMinutes: 10,
      lockTtlSeconds: 120,
      status: 'success',
    });

    const response = await GET_STATUS(openGet('/api/fire/scan/status'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.nextClientPollAt).toBe('2026-05-25T10:10:00.000Z');
    expect(mockedDb.getScanStatus).toHaveBeenCalledWith('org-community');
  });
});

function openPost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/fire/scan', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function openGet(path: string) {
  return new NextRequest(`http://localhost${path}`);
}
