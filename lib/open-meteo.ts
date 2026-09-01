import { JURISDICTION_BBOX, JURISDICTION_NAME, JURISDICTION_TIMEZONE } from '@/lib/constants';
import { isPointInJurisdiction } from '@/lib/jurisdiction';
import { BBox, ProvinceWeatherForecast, TerrainSnapshot, WeatherSnapshot, WindGridPoint } from '@/types';

interface OpenMeteoForecastResponse {
  latitude?: number;
  longitude?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    cape?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    rain?: number[];
    showers?: number[];
    weather_code?: number[];
    wind_gusts_10m?: number[];
  };
}

interface OpenMeteoElevationResponse {
  elevation?: number[];
}

const OPEN_METEO_TIMEOUT_MS = 5000;
const WIND_GRID_ROWS = 13;
const WIND_GRID_COLS = 12;
const FORECAST_GRID_ROWS = 7;
const FORECAST_GRID_COLS = 6;
const FORECAST_HOURS = 48;

export async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'precipitation',
      'rain',
      'weather_code',
    ].join(','),
    hourly: 'cape',
    timezone: JURISDICTION_TIMEZONE,
    forecast_days: '1',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo weather failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoForecastResponse;
  const current = data.current || {};
  const cape = getNearestCape(data.hourly, current.time);

  return compactJson({
    source: 'Open-Meteo',
    observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    temperatureC: current.temperature_2m,
    humidityPct: current.relative_humidity_2m,
    windSpeedKmh: current.wind_speed_10m,
    windDirectionDeg: current.wind_direction_10m,
    windGustKmh: current.wind_gusts_10m,
    rainMm: current.rain,
    precipitationMm: current.precipitation,
    rainProbabilityPct: current.precipitation && current.precipitation > 0 ? 100 : 0,
    weatherCode: current.weather_code,
    capeJkg: cape,
  }) as WeatherSnapshot;
}

export async function fetchOpenMeteoTerrain(lat: number, lon: number): Promise<Pick<TerrainSnapshot, 'altitudeM' | 'source' | 'observedAt'>> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
  });

  const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params.toString()}`, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo elevation failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoElevationResponse;
  const elevation = data.elevation?.[0];

  return compactJson({
    source: 'Open-Meteo Elevation / Copernicus DEM GLO-90',
    observedAt: new Date().toISOString(),
    altitudeM: typeof elevation === 'number' ? elevation : undefined,
  }) as Pick<TerrainSnapshot, 'altitudeM' | 'source' | 'observedAt'>;
}

export async function fetchOpenMeteoWindGrid(bbox: BBox = JURISDICTION_BBOX): Promise<WindGridPoint[]> {
  const locations = buildWindGridLocations(bbox);
  if (locations.length === 0) return [];

  const params = new URLSearchParams({
    latitude: locations.map((location) => location.lat.toFixed(5)).join(','),
    longitude: locations.map((location) => location.lon.toFixed(5)).join(','),
    current: ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'].join(','),
    timezone: JURISDICTION_TIMEZONE,
    forecast_days: '1',
    wind_speed_unit: 'kmh',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo wind grid failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoForecastResponse | OpenMeteoForecastResponse[];
  const items = Array.isArray(data) ? data : [data];

  return items
    .map((item, index) => mapWindGridPoint(item, locations[index]))
    .filter((point): point is WindGridPoint => Boolean(point));
}

export async function fetchJurisdictionForecast(): Promise<ProvinceWeatherForecast> {
  const locations = buildProvinceGridLocations(FORECAST_GRID_ROWS, FORECAST_GRID_COLS);
  if (locations.length === 0) {
    return buildProvinceForecast([], 0);
  }

  const params = new URLSearchParams({
    latitude: locations.map((location) => location.lat.toFixed(5)).join(','),
    longitude: locations.map((location) => location.lon.toFixed(5)).join(','),
    hourly: [
      'precipitation_probability',
      'precipitation',
      'rain',
      'showers',
      'weather_code',
      'wind_gusts_10m',
      'cape',
    ].join(','),
    timezone: JURISDICTION_TIMEZONE,
    forecast_hours: String(FORECAST_HOURS),
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo province forecast failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoForecastResponse | OpenMeteoForecastResponse[];
  return buildProvinceForecast(Array.isArray(data) ? data : [data], locations.length);
}

function buildWindGridLocations(bbox: BBox) {
  const locations: Array<{ lat: number; lon: number }> = [];

  for (let row = 0; row < WIND_GRID_ROWS; row++) {
    const lat = bbox.south + ((bbox.north - bbox.south) * (row + 0.5)) / WIND_GRID_ROWS;
    for (let col = 0; col < WIND_GRID_COLS; col++) {
      const lon = bbox.west + ((bbox.east - bbox.west) * (col + 0.5)) / WIND_GRID_COLS;
      if (isPointInJurisdiction(lat, lon)) {
        locations.push({ lat, lon });
      }
    }
  }

  return locations;
}

function buildProvinceGridLocations(rows: number, cols: number) {
  const locations: Array<{ lat: number; lon: number }> = [];

  for (let row = 0; row < rows; row++) {
    const lat = JURISDICTION_BBOX.south + ((JURISDICTION_BBOX.north - JURISDICTION_BBOX.south) * (row + 0.5)) / rows;
    for (let col = 0; col < cols; col++) {
      const lon = JURISDICTION_BBOX.west + ((JURISDICTION_BBOX.east - JURISDICTION_BBOX.west) * (col + 0.5)) / cols;
      if (isPointInJurisdiction(lat, lon)) locations.push({ lat, lon });
    }
  }

  return locations;
}

function buildProvinceForecast(items: OpenMeteoForecastResponse[], points: number): ProvinceWeatherForecast {
  const byTime = new Map<string, ForecastConditions>();

  for (const item of items) {
    const hourly = item.hourly;
    if (!hourly?.time) continue;

    hourly.time.forEach((time, index) => {
      const current = byTime.get(time) || createForecastConditions(time);
      const probability = numberAt(hourly.precipitation_probability, index);
      const precipitation = Math.max(
        numberAt(hourly.precipitation, index),
        numberAt(hourly.rain, index),
        numberAt(hourly.showers, index)
      );
      const weatherCode = numberAt(hourly.weather_code, index);
      const gustKmh = numberAt(hourly.wind_gusts_10m, index);
      const capeJkg = numberAt(hourly.cape, index);

      current.probabilityPct = Math.max(current.probabilityPct, probability);
      current.precipitationMm = Math.max(current.precipitationMm, precipitation);
      current.gustKmh = Math.max(current.gustKmh, gustKmh);
      current.capeJkg = Math.max(current.capeJkg, capeJkg);
      if (probability >= 60) current.rainPoints += 1;
      if (isThunderstormCode(weatherCode) || (probability >= 50 && capeJkg >= 1000)) current.stormPoints += 1;
      byTime.set(time, current);
    });
  }

  const alerts = Array.from(byTime.values())
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
    .flatMap((conditions) => toForecastAlerts(conditions, points))
    .filter((alert, index, all) => !all.slice(0, index).some((item) => item.kind === alert.kind && Math.abs(new Date(item.startsAt).getTime() - new Date(alert.startsAt).getTime()) < 3 * 3600000))
    .slice(0, 4);

  return {
    generatedAt: new Date().toISOString(),
    source: 'Open-Meteo Forecast API',
    scope: JURISDICTION_NAME,
    refreshMinutes: 15,
    points,
    alerts,
  };
}

interface ForecastConditions {
  time: string;
  probabilityPct: number;
  precipitationMm: number;
  gustKmh: number;
  capeJkg: number;
  rainPoints: number;
  stormPoints: number;
}

function createForecastConditions(time: string): ForecastConditions {
  return { time, probabilityPct: 0, precipitationMm: 0, gustKmh: 0, capeJkg: 0, rainPoints: 0, stormPoints: 0 };
}

function toForecastAlerts(conditions: ForecastConditions, points: number): ProvinceWeatherForecast['alerts'] {
  const alerts: ProvinceWeatherForecast['alerts'] = [];
  if (conditions.probabilityPct >= 60 && conditions.precipitationMm >= 0.2) {
    alerts.push({
      id: `rain:${conditions.time}`,
      kind: 'rain',
      severity: conditions.precipitationMm >= 5 || conditions.gustKmh >= 55 ? 'warning' : 'info',
      startsAt: toForecastIsoTime(conditions.time),
      probabilityPct: Math.round(conditions.probabilityPct),
      precipitationMm: roundOneDecimal(conditions.precipitationMm),
      gustKmh: Math.round(conditions.gustKmh),
      capeJkg: Math.round(conditions.capeJkg),
      affectedPoints: Math.min(points, conditions.rainPoints),
    });
  }
  if (conditions.stormPoints > 0) {
    alerts.push({
      id: `storm:${conditions.time}`,
      kind: 'storm',
      severity: conditions.stormPoints >= 2 || conditions.gustKmh >= 55 ? 'danger' : 'warning',
      startsAt: toForecastIsoTime(conditions.time),
      probabilityPct: Math.round(conditions.probabilityPct),
      precipitationMm: roundOneDecimal(conditions.precipitationMm),
      gustKmh: Math.round(conditions.gustKmh),
      capeJkg: Math.round(conditions.capeJkg),
      affectedPoints: Math.min(points, conditions.stormPoints),
    });
  }
  return alerts;
}

function numberAt(values: number[] | undefined, index: number) {
  const value = values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isThunderstormCode(code: number) {
  return code === 95 || code === 96 || code === 99;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function toForecastIsoTime(value: string) {
  if (value.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value).toISOString();
  return new Date(`${value}:00-03:00`).toISOString();
}

function mapWindGridPoint(
  item: OpenMeteoForecastResponse,
  fallbackLocation?: { lat: number; lon: number }
): WindGridPoint | null {
  const current = item.current || {};
  const speed = current.wind_speed_10m;
  const direction = current.wind_direction_10m;

  if (typeof speed !== 'number' || typeof direction !== 'number') {
    return null;
  }

  const lat = typeof item.latitude === 'number' ? item.latitude : fallbackLocation?.lat;
  const lon = typeof item.longitude === 'number' ? item.longitude : fallbackLocation?.lon;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  return compactJson({
    id: `${lat.toFixed(3)}:${lon.toFixed(3)}`,
    source: 'Open-Meteo',
    observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    lat,
    lon,
    windSpeedKmh: speed,
    windDirectionDeg: direction,
    windGustKmh: current.wind_gusts_10m,
  }) as unknown as WindGridPoint;
}

function getNearestCape(hourly?: OpenMeteoForecastResponse['hourly'], currentTime?: string) {
  if (!hourly?.time?.length || !hourly.cape?.length || !currentTime) return undefined;
  const current = new Date(currentTime).getTime();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  hourly.time.forEach((time, index) => {
    const distance = Math.abs(new Date(time).getTime() - current);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return hourly.cape[bestIndex];
}

function compactJson<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}
