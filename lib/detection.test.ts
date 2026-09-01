import { describe, expect, it } from 'vitest';
import { deriveStatusFromSources } from '@/lib/detection';

describe('detection rules', () => {
  it('keeps GOES-only detections as unconfirmed until repeat threshold', () => {
    expect(
      deriveStatusFromSources('unconfirmed', [
        { source: 'GOES', ts: '2026-04-28T10:00:00.000Z', satellite: 'GOES-19' },
      ])
    ).toBe('unconfirmed');

    expect(
      deriveStatusFromSources('unconfirmed', [
        { source: 'GOES', ts: '2026-04-28T10:00:00.000Z', satellite: 'GOES-19' },
        { source: 'GOES', ts: '2026-04-28T10:10:00.000Z', satellite: 'GOES-19' },
      ])
    ).toBe('probable');
  });

  it('confirms when FIRMS reports high confidence and FRP above threshold', () => {
    expect(
      deriveStatusFromSources('probable', [
        { source: 'GOES', ts: '2026-04-28T10:00:00.000Z', satellite: 'GOES-19' },
        { source: 'FIRMS', ts: '2026-04-28T10:15:00.000Z', confidence: 'high', frp: 5.2, satellite: 'N20' },
      ])
    ).toBe('confirmed');
  });

  it('does not confirm with geostationary GOES detections alone', () => {
    expect(
      deriveStatusFromSources('unconfirmed', [
        {
          source: 'GOES',
          layer: 'firms-goes-nrt',
          sourceProduct: 'GOES_NRT',
          ts: '2026-04-28T10:00:00.000Z',
          confidence: 'high',
          frp: 7,
          satellite: 'G19',
        },
        {
          source: 'GOES',
          layer: 'goes-fdcf',
          sourceProduct: 'NOAA/GOES/19/FDCF',
          ts: '2026-04-28T10:10:00.000Z',
          confidence: 'high',
          frp: 8,
          satellite: 'GOES-19',
        },
      ])
    ).toBe('probable');
  });
});
