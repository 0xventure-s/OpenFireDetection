import { JURISDICTION_BBOX } from './constants';

type Coordinate = readonly [number, number];

export const JURISDICTION_RING: readonly Coordinate[] = [
  [JURISDICTION_BBOX.west, JURISDICTION_BBOX.south],
  [JURISDICTION_BBOX.east, JURISDICTION_BBOX.south],
  [JURISDICTION_BBOX.east, JURISDICTION_BBOX.north],
  [JURISDICTION_BBOX.west, JURISDICTION_BBOX.north],
  [JURISDICTION_BBOX.west, JURISDICTION_BBOX.south],
];

export const JURISDICTION_GEOJSON = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [JURISDICTION_RING],
  },
} as const;

export function isPointInJurisdiction(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= JURISDICTION_BBOX.south &&
    lat <= JURISDICTION_BBOX.north &&
    lon >= JURISDICTION_BBOX.west &&
    lon <= JURISDICTION_BBOX.east
  );
}
