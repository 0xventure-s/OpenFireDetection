import { describe, expect, it } from 'vitest';
import {
  buildVisibleWindVectors,
  getWindColor,
  getWindDestination,
  getWindFlowDirection,
  getWindVectorLimit,
  shouldLabelWindVector,
  summarizeWindLayer,
} from './wind-layer';
import type { WindGridPoint } from '@/types';

const points: WindGridPoint[] = [
  { id: 'a', lat: -28.5, lon: -65.9, windSpeedKmh: 8, windDirectionDeg: 0, windGustKmh: 12, observedAt: '2026-05-25T10:00:00.000Z' },
  { id: 'b', lat: -28.4, lon: -65.7, windSpeedKmh: 22, windDirectionDeg: 20, windGustKmh: 32, observedAt: '2026-05-25T10:05:00.000Z' },
  { id: 'c', lat: -28.3, lon: -65.8, windSpeedKmh: 44, windDirectionDeg: 40, windGustKmh: 55, observedAt: '2026-05-25T09:55:00.000Z' },
  { id: 'd', lat: -28.6, lon: -65.6, windSpeedKmh: 18, windDirectionDeg: 60, windGustKmh: 24, observedAt: '2026-05-25T09:50:00.000Z' },
];

describe('wind layer helpers', () => {
  it('summarizes tactical wind values', () => {
    const summary = summarizeWindLayer(points);

    expect(Math.round(summary.averageSpeedKmh || 0)).toBe(23);
    expect(summary.maxSpeedKmh).toBe(44);
    expect(summary.maxGustKmh).toBe(55);
    expect(summary.observedAt).toBe('2026-05-25T10:05:00.000Z');
  });

  it('uses color thresholds and flow direction consistently', () => {
    expect(getWindColor(6)).toBe('#67e8f9');
    expect(getWindColor(18)).toBe('#86efac');
    expect(getWindColor(28)).toBe('#fde047');
    expect(getWindColor(38)).toBe('#fb923c');
    expect(getWindColor(50)).toBe('#f87171');
    expect(getWindFlowDirection(270)).toBe(90);
  });

  it('names the destination of the wind instead of its origin', () => {
    expect(getWindDestination(0)).toEqual({ label: 'Sur', abbreviation: 'S' });
    expect(getWindDestination(90)).toEqual({ label: 'Oeste', abbreviation: 'O' });
    expect(getWindDestination(180)).toEqual({ label: 'Norte', abbreviation: 'N' });
    expect(getWindDestination(225)).toEqual({ label: 'Noreste', abbreviation: 'NE' });
    expect(getWindDestination(315)).toEqual({ label: 'Sureste', abbreviation: 'SE' });
  });

  it('limits visible vectors to a readable density', () => {
    const vectors = buildVisibleWindVectors(points, -65.78, -28.47, 12);

    expect(vectors.length).toBeGreaterThan(0);
    expect(vectors.length).toBeLessThanOrEqual(getWindVectorLimit(12));
  });

  it('labels only high-risk or close zoom wind vectors', () => {
    expect(shouldLabelWindVector(points[0], 8)).toBe(false);
    expect(shouldLabelWindVector(points[2], 8)).toBe(true);
    expect(shouldLabelWindVector(points[0], 11)).toBe(true);
  });
});
