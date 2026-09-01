import { describe, expect, it } from 'vitest';
import { JURISDICTION_RING, isPointInJurisdiction } from './jurisdiction';

describe('configured jurisdiction boundary', () => {
  it('accepts points inside the configured bounding box', () => {
    expect(isPointInJurisdiction(-30, -65)).toBe(true);
    expect(isPointInJurisdiction(-31.5, -66.5)).toBe(true);
  });

  it('rejects points outside the configured bounding box', () => {
    expect(isPointInJurisdiction(-27.5, -65)).toBe(false);
    expect(isPointInJurisdiction(-30, -62.5)).toBe(false);
  });

  it('accepts points on the configured boundary', () => {
    const [lon, lat] = JURISDICTION_RING[0];
    expect(isPointInJurisdiction(lat, lon)).toBe(true);
  });
});
