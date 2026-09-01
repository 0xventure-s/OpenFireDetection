import { isPointInJurisdiction } from './jurisdiction';
import { WindGridPoint, WindLayerSummary } from '@/types';

export const WIND_LEGEND_STEPS = [
  { label: '0-10', color: '#67e8f9' },
  { label: '10-20', color: '#86efac' },
  { label: '20-30', color: '#fde047' },
  { label: '30-45', color: '#fb923c' },
  { label: '45+', color: '#f87171' },
] as const;

const WIND_DESTINATIONS = [
  { label: 'Norte', abbreviation: 'N' },
  { label: 'Noreste', abbreviation: 'NE' },
  { label: 'Este', abbreviation: 'E' },
  { label: 'Sureste', abbreviation: 'SE' },
  { label: 'Sur', abbreviation: 'S' },
  { label: 'Suroeste', abbreviation: 'SO' },
  { label: 'Oeste', abbreviation: 'O' },
  { label: 'Noroeste', abbreviation: 'NO' },
] as const;

export function summarizeWindLayer(points: WindGridPoint[]): WindLayerSummary {
  if (points.length === 0) {
    return {
      averageSpeedKmh: null,
      maxSpeedKmh: null,
      maxGustKmh: null,
      dominantDirectionDeg: null,
    };
  }

  let speedTotal = 0;
  let maxSpeedKmh = 0;
  let maxGustKmh = 0;
  let sinTotal = 0;
  let cosTotal = 0;
  let observedAt = points[0]?.observedAt;

  for (const point of points) {
    speedTotal += point.windSpeedKmh;
    maxSpeedKmh = Math.max(maxSpeedKmh, point.windSpeedKmh);
    maxGustKmh = Math.max(maxGustKmh, point.windGustKmh || point.windSpeedKmh);
    sinTotal += Math.sin(toRad(point.windDirectionDeg));
    cosTotal += Math.cos(toRad(point.windDirectionDeg));
    if (point.observedAt && (!observedAt || new Date(point.observedAt).getTime() > new Date(observedAt).getTime())) {
      observedAt = point.observedAt;
    }
  }

  const direction = (Math.atan2(sinTotal / points.length, cosTotal / points.length) * 180) / Math.PI;

  return {
    averageSpeedKmh: speedTotal / points.length,
    maxSpeedKmh,
    maxGustKmh,
    dominantDirectionDeg: (direction + 360) % 360,
    observedAt,
  };
}

export function buildVisibleWindVectors(points: WindGridPoint[], centerLon: number, centerLat: number, zoom: number) {
  if (points.length < 3) return points;

  const span = getWindViewportSpan(zoom);
  const west = centerLon - span.lon / 2;
  const east = centerLon + span.lon / 2;
  const south = centerLat - span.lat / 2;
  const north = centerLat + span.lat / 2;
  const step = getWindVectorStep(zoom);
  const vectors: WindGridPoint[] = [];
  const startLon = Math.floor(west / step.lon) * step.lon;
  const startLat = Math.floor(south / step.lat) * step.lat;
  const maxVectors = getWindVectorLimit(zoom);

  for (let lat = startLat; lat <= north; lat += step.lat) {
    for (let lon = startLon; lon <= east; lon += step.lon) {
      if (lon < west || lat < south || !isPointInJurisdiction(lat, lon)) continue;
      const vector = interpolateWindVector(points, lat, lon);
      if (!vector) continue;
      vectors.push(vector);
      if (vectors.length >= maxVectors) return vectors;
    }
  }

  return vectors.length > 0 ? vectors : points.slice(0, maxVectors);
}

export function getWindColor(speedKmh: number) {
  if (speedKmh >= 45) return '#f87171';
  if (speedKmh >= 30) return '#fb923c';
  if (speedKmh >= 20) return '#fde047';
  if (speedKmh >= 10) return '#86efac';
  return '#67e8f9';
}

export function getWindFlowDirection(directionFromDeg: number) {
  return (directionFromDeg + 180) % 360;
}

export function getWindDestination(directionFromDeg: number) {
  const directionToDeg = getWindFlowDirection(directionFromDeg);
  return WIND_DESTINATIONS[Math.round(directionToDeg / 45) % WIND_DESTINATIONS.length];
}

export function getWindVectorLimit(zoom: number) {
  if (zoom >= 11) return 220;
  if (zoom >= 9) return 180;
  if (zoom >= 7) return 130;
  return 90;
}

export function shouldLabelWindVector(point: WindGridPoint, zoom: number) {
  return zoom >= 10.5 || point.windSpeedKmh >= 35 || (point.windGustKmh || 0) >= 45;
}

function getWindViewportSpan(zoom: number) {
  if (zoom >= 12) return { lon: 0.62, lat: 0.82 };
  if (zoom >= 11) return { lon: 0.92, lat: 1.2 };
  if (zoom >= 10) return { lon: 1.32, lat: 1.7 };
  if (zoom >= 9) return { lon: 2, lat: 2.55 };
  if (zoom >= 8) return { lon: 3, lat: 3.9 };
  if (zoom >= 7) return { lon: 4.25, lat: 5.4 };
  return { lon: 5.5, lat: 7 };
}

function getWindVectorStep(zoom: number) {
  if (zoom >= 12) return { lon: 0.07, lat: 0.07 };
  if (zoom >= 11) return { lon: 0.09, lat: 0.09 };
  if (zoom >= 10) return { lon: 0.13, lat: 0.13 };
  if (zoom >= 9) return { lon: 0.18, lat: 0.18 };
  if (zoom >= 8) return { lon: 0.26, lat: 0.26 };
  if (zoom >= 7) return { lon: 0.36, lat: 0.36 };
  return { lon: 0.52, lat: 0.52 };
}

function interpolateWindVector(points: WindGridPoint[], lat: number, lon: number): WindGridPoint | null {
  const nearest = points
    .map((point) => ({
      point,
      distance: Math.max(0.001, Math.hypot((point.lat - lat) * 1.15, point.lon - lon)),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 5);

  if (nearest.length === 0) return null;

  let weightTotal = 0;
  let speedTotal = 0;
  let gustTotal = 0;
  let sinTotal = 0;
  let cosTotal = 0;

  nearest.forEach(({ point, distance }) => {
    const weight = 1 / distance ** 2;
    const directionRad = toRad(point.windDirectionDeg);
    weightTotal += weight;
    speedTotal += point.windSpeedKmh * weight;
    gustTotal += (point.windGustKmh || point.windSpeedKmh) * weight;
    sinTotal += Math.sin(directionRad) * weight;
    cosTotal += Math.cos(directionRad) * weight;
  });

  const direction = (Math.atan2(sinTotal / weightTotal, cosTotal / weightTotal) * 180) / Math.PI;

  return {
    id: `wind:${lat.toFixed(4)}:${lon.toFixed(4)}`,
    lat,
    lon,
    source: 'Open-Meteo interpolado',
    observedAt: nearest[0]?.point.observedAt,
    windSpeedKmh: speedTotal / weightTotal,
    windDirectionDeg: (direction + 360) % 360,
    windGustKmh: gustTotal / weightTotal,
  };
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}
