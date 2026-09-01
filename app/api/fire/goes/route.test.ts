import { afterEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/lib/goes', () => ({
  getGoesStatus: vi.fn(() => ({
    enabled: true,
    reason: 'enabled',
    dataset: 'NOAA/GOES/19/FDCF',
    cadenceMinutes: 10,
    maxFallbackMinutes: 120,
  })),
  fetchGoesFdcfHotspots: vi.fn(async () => ({
    hotspots: [
      {
        lat: -27.2,
        lon: -67.1,
        heat: 340.6,
        ts: '2026-04-28T10:10:00.000Z',
        satellite: 'GOES-19',
        maskCode: 10,
        frp: 12.4,
        areaM2: 182.94,
      },
    ],
    status: 'active',
    dataset: 'NOAA/GOES/19/FDCF',
    cadenceMinutes: 10,
    maxFallbackMinutes: 120,
    acquisitionTime: '2026-04-28T10:10:00.000Z',
    usedFallback: false,
  })),
}));

describe('GOES route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports GOES-19 FDCF detections from Earth Engine', async () => {
    const { GET } = await import('@/app/api/fire/goes/route');
    const response = await GET(new NextRequest('http://localhost/api/fire/goes'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.source).toBe('NOAA/GOES/19/FDCF');
    expect(json.data.status).toBe('active');
    expect(json.data.hotspots[0]).toMatchObject({
      satellite: 'GOES-19',
      maskCode: 10,
      frp: 12.4,
      areaM2: 182.94,
    });
  });
});
