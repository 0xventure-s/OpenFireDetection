import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJurisdictionEarthquakes } from './earthquakes';
import { JURISDICTION_NAME } from './constants';

describe('jurisdiction earthquake feed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps only events inside the configured jurisdiction', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          features: [
            {
              id: 'inside',
              properties: { mag: 3.4, place: 'Dentro del área', time: Date.parse('2026-08-19T10:00:00.000Z') },
              geometry: { coordinates: [-65, -30, 12] },
            },
            {
              id: 'outside',
              properties: { mag: 4.1, place: 'Fuera de la jurisdicción', time: Date.parse('2026-08-19T11:00:00.000Z') },
              geometry: { coordinates: [-62.8, -28.5, 8] },
            },
          ],
        })
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJurisdictionEarthquakes(new Date('2026-08-19T12:00:00.000Z'));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain('minlatitude=-32');
    expect(result.scope).toBe(JURISDICTION_NAME);
    expect(result.events).toEqual([
      expect.objectContaining({ id: 'inside', magnitude: 3.4, depthKm: 12, source: 'USGS' }),
    ]);
  });
});
