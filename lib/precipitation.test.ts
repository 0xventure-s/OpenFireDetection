import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPrecipitationLayerMetadata } from './precipitation';

describe('NASA IMERG precipitation layer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the actual observation time exposed by GIBS', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 200,
        headers: {
          'layer-time-actual': '2026-08-29T20:30:00Z',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPrecipitationLayerMetadata();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('IMERG_Precipitation_Rate_30min'),
      expect.objectContaining({ method: 'HEAD' })
    );
    expect(result.observedAt).toBe('2026-08-29T20:30:00.000Z');
    expect(result.role).toBe('risk');
    expect(result.spatialResolutionKm).toBe(10);
  });

  it('rejects responses without a valid observation time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));

    await expect(fetchPrecipitationLayerMetadata()).rejects.toThrow('no valid observation time');
  });
});
