import { describe, expect, it } from 'vitest';
import { buildNearbyDetectionTimeWindow } from '@/lib/db';

describe('nearby fire matching', () => {
  it('builds the matching window around the satellite acquisition time', () => {
    const referenceTime = new Date('2026-05-12T10:42:00.000Z');
    const window = buildNearbyDetectionTimeWindow(referenceTime, 30);

    expect(window.since.toISOString()).toBe('2026-05-12T10:12:00.000Z');
    expect(window.until.toISOString()).toBe('2026-05-12T11:12:00.000Z');
  });
});
