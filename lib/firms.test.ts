import { describe, expect, it } from 'vitest';
import { parseCSV, parseFirmsDateTime } from '@/lib/firms';

describe('FIRMS utilities', () => {
  it('parses CSV rows into typed points', () => {
    const csv = [
      'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight',
      '-27.5,-67.0,320.1,0.5,0.6,2026-04-28,1345,N21,VIIRS,high,1.0,290.0,12.4,D',
    ].join('\n');

    const points = parseCSV(csv, 'VIIRS_NOAA21_NRT');
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      latitude: -27.5,
      longitude: -67,
      brightness: 320.1,
      confidence: 'high',
      frp: 12.4,
      sourceProduct: 'VIIRS_NOAA21_NRT',
      sourceLayer: 'viirs-noaa21',
      sourceFamily: 'polar',
    });
  });

  it('normalizes geostationary FIRMS rows as a GOES layer', () => {
    const csv = [
      'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight',
      '-27.5,-67.0,315.0,2,2,2026-04-28,1340,G19,ABI,82,1.0,0,4.2,D',
    ].join('\n');

    const points = parseCSV(csv, 'GOES_NRT');
    expect(points[0]).toMatchObject({
      satellite: 'G19',
      confidence: 'high',
      confidenceRaw: '82',
      sourceProduct: 'GOES_NRT',
      sourceLayer: 'firms-goes-nrt',
      sourceFamily: 'geostationary',
    });
  });

  it('parses FIRMS timestamps in UTC', () => {
    const value = parseFirmsDateTime('2026-04-28', '1345');
    expect(value.toISOString()).toBe('2026-04-28T13:45:00.000Z');
  });
});
