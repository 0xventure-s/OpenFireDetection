import { Fire, OperationalContextSnapshot, ProjectionSnapshot, TerrainSnapshot, WeatherSnapshot } from '@/types';
import { derivePriority, deriveRiskScore, deriveWeatherRiskScore, getMaxFrp } from '@/lib/fire-utils';
import { fetchOpenMeteoTerrain, fetchOpenMeteoWeather } from '@/lib/open-meteo';

const WEATHER_REFRESH_MS = 30 * 60 * 1000;

type IncidentContextInput = Pick<Fire, 'lat' | 'lon'> &
  Partial<Pick<Fire, 'sources' | 'weatherSnapshot' | 'terrainSnapshot' | 'projectionSnapshot'>>;
type OperationalIncidentInput = IncidentContextInput &
  Partial<Pick<Fire, 'status' | 'payload' | 'detectedAt' | 'priority' | 'riskScore'>>;

export interface ExternalIncidentSnapshots {
  weatherSnapshot?: WeatherSnapshot;
  terrainSnapshot?: TerrainSnapshot;
  projectionSnapshot?: ProjectionSnapshot;
}

export async function fetchOpenMeteoIncidentSnapshots(fire: IncidentContextInput): Promise<ExternalIncidentSnapshots> {
  const [weatherResult, terrainResult] = await Promise.allSettled([
    fetchOpenMeteoWeather(fire.lat, fire.lon),
    fetchOpenMeteoTerrain(fire.lat, fire.lon),
  ]);

  const weatherSnapshot = weatherResult.status === 'fulfilled' ? weatherResult.value : undefined;
  const terrainSnapshot =
    terrainResult.status === 'fulfilled' ? estimateTerrain(fire, terrainResult.value) : undefined;
  const projectionSnapshot = weatherSnapshot
    ? estimateProjection(fire, weatherSnapshot, terrainSnapshot || estimateTerrain(fire))
    : undefined;

  return compactUndefined({
    weatherSnapshot,
    terrainSnapshot,
    projectionSnapshot,
  });
}

export async function buildIncidentContext(fire: IncidentContextInput) {
  const external = await fetchOpenMeteoIncidentSnapshots(fire);
  const weather = fire.weatherSnapshot || external.weatherSnapshot || estimateWeather(fire);
  const terrain = fire.terrainSnapshot || external.terrainSnapshot || estimateTerrain(fire);
  const projection = fire.projectionSnapshot || external.projectionSnapshot || estimateProjection(fire, weather, terrain);
  const operations = buildOperationalContext(fire, weather, terrain);

  return {
    weather,
    terrain,
    projection,
    operations,
    external,
  };
}

export function shouldRefreshWeatherSnapshot(weather?: WeatherSnapshot | null, now = Date.now()) {
  if (!weather?.observedAt || weather.source !== 'Open-Meteo') return true;
  const observedAt = new Date(weather.observedAt).getTime();
  if (Number.isNaN(observedAt)) return true;
  return now - observedAt >= WEATHER_REFRESH_MS;
}

export function estimateWeather(fire: Pick<Fire, 'lat' | 'lon'>): WeatherSnapshot {
  return {
    source: 'estimado-local',
    observedAt: new Date().toISOString(),
    note: `Sin integracion meteorologica para ${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}.`,
  };
}

export function estimateTerrain(
  fire: Pick<Fire, 'lat' | 'lon'>,
  openMeteoTerrain?: Pick<TerrainSnapshot, 'altitudeM' | 'source' | 'observedAt'>
): TerrainSnapshot {
  const west = fire.lon < -67.1;
  const puna = fire.lat > -27.2;
  return {
    source: openMeteoTerrain?.source || 'estimado-local',
    observedAt: openMeteoTerrain?.observedAt || new Date().toISOString(),
    ...(typeof openMeteoTerrain?.altitudeM === 'number'
      ? { altitudeM: openMeteoTerrain.altitudeM }
      : west || puna
        ? { altitudeM: 1800 }
        : {}),
    slopeDeg: deriveApproxSlope(fire),
    aspectDeg: deriveApproxAspect(fire),
    fuelType: west || puna ? 'arbustal / pastizal de altura' : 'pastizal / monte bajo',
    fuelDensity: west || puna ? 'media' : 'media-alta',
  };
}

export function estimateProjection(
  fire: IncidentContextInput,
  weather: WeatherSnapshot,
  terrain: TerrainSnapshot
): ProjectionSnapshot {
  const frp = getMaxFrp({ sources: fire.sources || [] });
  const windSpeed = typeof weather.windSpeedKmh === 'number' ? weather.windSpeedKmh : 0;
  const windGust = typeof weather.windGustKmh === 'number' ? weather.windGustKmh : windSpeed;
  const effectiveWind = Math.max(windSpeed, windGust * 0.7);
  const distanceKm1h = Number((Math.max(0.2, effectiveWind * 0.08 + frp * 0.03)).toFixed(2));
  const directionDeg = typeof weather.windDirectionDeg === 'number' ? weather.windDirectionDeg : terrain.aspectDeg;

  return {
    generatedAt: new Date().toISOString(),
    ...(typeof directionDeg === 'number' ? { directionDeg } : {}),
    distanceKm1h,
    distanceKm3h: Number((distanceKm1h * 3).toFixed(2)),
    confidence: weather.windSpeedKmh ? 'nominal' : 'low',
    summary: weather.windSpeedKmh
      ? 'Proyeccion simple basada en viento, rachas, FRP y terreno disponible.'
      : 'Proyeccion preliminar: faltan viento y pendiente para estimar propagacion con precision.',
  };
}

export function buildOperationalContext(
  fire: OperationalIncidentInput,
  weather?: WeatherSnapshot | null,
  terrain?: TerrainSnapshot | null
): OperationalContextSnapshot {
  const effectiveTerrain = terrain || estimateTerrain(fire);
  const slope = typeof effectiveTerrain.slopeDeg === 'number' ? effectiveTerrain.slopeDeg : deriveApproxSlope(fire);
  const altitude = typeof effectiveTerrain.altitudeM === 'number' ? effectiveTerrain.altitudeM : 0;
  const remoteSector = isRemoteSector(fire);
  const restrictedTerrain = slope >= 8 || altitude >= 1800;
  const accessCondition = remoteSector ? 'remote' : restrictedTerrain ? 'restricted' : 'direct';
  const weatherRisk = deriveWeatherRiskScore(weather);
  const riskInput = {
    status: fire.status || 'unconfirmed',
    sources: fire.sources || [],
    payload: fire.payload || {},
    detectedAt: fire.detectedAt || new Date().toISOString(),
    weatherSnapshot: weather || undefined,
  };
  const priority = fire.priority || derivePriority(riskInput);
  const riskScore = typeof fire.riskScore === 'number' ? fire.riskScore : deriveRiskScore(riskInput);
  const estimatedResponseMinutes = estimateResponseMinutes(accessCondition, weatherRisk, riskScore);
  const resourceLevel = deriveResourceLevel(priority, riskScore, weather);
  const recommendedResources = deriveRecommendedResources(resourceLevel, accessCondition, weather);

  return {
    source: 'heuristica-operativa-local',
    generatedAt: new Date().toISOString(),
    accessCondition,
    accessSummary: formatAccessSummary(accessCondition, estimatedResponseMinutes),
    estimatedResponseMinutes,
    resourceLevel,
    resourceSummary: formatResourceSummary(resourceLevel),
    recommendedResources,
  };
}

function deriveApproxSlope(fire: Pick<Fire, 'lat' | 'lon'>) {
  if (fire.lon < -67.1 || fire.lat > -27.2) return 9;
  if (fire.lat < -28.3) return 5;
  return 3;
}

function deriveApproxAspect(fire: Pick<Fire, 'lat' | 'lon'>) {
  if (fire.lon < -67.1) return 90;
  if (fire.lat > -27.2) return 180;
  return 270;
}

function isRemoteSector(fire: Pick<Fire, 'lat' | 'lon'>) {
  return fire.lon < -67.1 || fire.lat > -27.2 || (fire.lat < -28.3 && fire.lon < -66.7);
}

function estimateResponseMinutes(
  accessCondition: OperationalContextSnapshot['accessCondition'],
  weatherRisk: number,
  riskScore: number
) {
  const base = accessCondition === 'remote' ? 95 : accessCondition === 'restricted' ? 65 : 35;
  const weatherDelay = weatherRisk >= 60 ? 10 : 0;
  const priorityCompression = riskScore >= 75 ? -10 : riskScore >= 55 ? -5 : 0;
  return Math.max(25, Math.min(150, base + weatherDelay + priorityCompression));
}

function deriveResourceLevel(
  priority: NonNullable<Fire['priority']>,
  riskScore: number,
  weather?: WeatherSnapshot | null
): NonNullable<OperationalContextSnapshot['resourceLevel']> {
  const highWind = getEffectiveWindKmh(weather) >= 40;
  if (priority === 'critical' || riskScore >= 80 || (priority === 'high' && highWind)) return 'reinforced';
  if (priority === 'high' || riskScore >= 55) return 'dispatch';
  if (priority === 'medium' || riskScore >= 30) return 'verify';
  return 'monitor';
}

function deriveRecommendedResources(
  resourceLevel: OperationalContextSnapshot['resourceLevel'],
  accessCondition: OperationalContextSnapshot['accessCondition'],
  weather?: WeatherSnapshot | null
) {
  const resources =
    resourceLevel === 'reinforced'
      ? ['brigada de ataque inicial', 'unidad cisterna o apoyo hidrico', 'coordinacion con Defensa Civil']
      : resourceLevel === 'dispatch'
        ? ['unidad liviana de ataque inicial', 'equipo de comunicaciones', 'enlace con base local']
        : resourceLevel === 'verify'
          ? ['patrulla de verificacion', 'contacto municipal o destacamento cercano']
          : ['monitoreo satelital', 'contacto preventivo con base local'];

  if (accessCondition === 'remote') resources.push('comunicaciones VHF/satelital');
  if (getEffectiveWindKmh(weather) >= 35) resources.push('observador de viento y columna');
  return Array.from(new Set(resources));
}

function getEffectiveWindKmh(weather?: WeatherSnapshot | null) {
  if (!weather) return 0;
  const wind = typeof weather.windSpeedKmh === 'number' ? weather.windSpeedKmh : 0;
  const gust = typeof weather.windGustKmh === 'number' ? weather.windGustKmh : wind;
  return Math.max(wind, gust * 0.7);
}

function formatAccessSummary(accessCondition: OperationalContextSnapshot['accessCondition'], minutes: number) {
  if (accessCondition === 'remote') return `sector remoto, ETA operativo ${minutes} min`;
  if (accessCondition === 'restricted') return `acceso condicionado por terreno, ETA operativo ${minutes} min`;
  return `acceso directo estimado, ETA operativo ${minutes} min`;
}

function formatResourceSummary(resourceLevel: OperationalContextSnapshot['resourceLevel']) {
  if (resourceLevel === 'reinforced') return 'despacho reforzado recomendado';
  if (resourceLevel === 'dispatch') return 'despacho inicial recomendado';
  if (resourceLevel === 'verify') return 'verificacion en terreno recomendada';
  return 'monitoreo operativo recomendado';
}

function compactUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
