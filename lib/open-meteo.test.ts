import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJurisdictionForecast } from './open-meteo';
import { JURISDICTION_NAME } from './constants';

describe('jurisdiction weather forecast', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns jurisdiction rain and thunderstorm conditions into operational alerts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(
        JSON.stringify([
          {
            hourly: {
              time: ['2026-08-19T13:00', '2026-08-19T14:00'],
              precipitation_probability: [75, 85],
              precipitation: [1.2, 6.4],
              rain: [1.2, 6.4],
              showers: [0, 0],
              weather_code: [61, 95],
              wind_gusts_10m: [24, 61],
              cape: [120, 1400],
            },
          },
        ])
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJurisdictionForecast();

    expect(String(fetchMock.mock.calls[0][0])).toContain('forecast_hours=48');
    expect(result.scope).toBe(JURISDICTION_NAME);
    expect(result.points).toBeGreaterThan(0);
    expect(result.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'rain', probabilityPct: 75, precipitationMm: 1.2 }),
        expect.objectContaining({ kind: 'storm', severity: 'danger', gustKmh: 61, capeJkg: 1400 }),
      ])
    );
  });
});
