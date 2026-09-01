import {
  CommandDashboardResponse,
  CommandIncident,
  DataFreshness,
  FireStation,
  Fire,
  FireStatus,
  IncidentAssignment,
  IncidentPriority,
  LifecycleStatus,
  MaintenanceRecord,
  OperationalAsset,
  OperationalUnit,
  ProvincialOverview,
  SourceHealth,
  WeatherSnapshot,
} from '@/types';
import { JURISDICTION_BBOX } from '@/lib/constants';
import {
  compareByPriorityAndTime,
  derivePriority,
  deriveRiskScore,
  deriveWeatherRiskScore,
  enrichFires,
  getDetectionCount,
  getMaxFrp,
  getOperationalStatusLabel,
  getStatusLabel,
} from '@/lib/fire-utils';

const fireStatuses: FireStatus[] = ['unconfirmed', 'probable', 'confirmed', 'false_positive', 'extinguished'];
const priorities: IncidentPriority[] = ['low', 'medium', 'high', 'critical'];
const lifecycles: LifecycleStatus[] = ['active', 'closed', 'archived', 'test'];

const priorityWeight: Record<IncidentPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const actionReasonWeight: Record<string, number> = {
  'meteo critica': 50,
  'sin unidad': 45,
  'sin revisar': 40,
  'fuente atrasada': 32,
  'requiere seguimiento': 24,
  'sin clima tactico': 18,
  monitorear: 8,
};

export function buildCommandDashboard(input: {
  fires: Fire[];
  assignments?: IncidentAssignment[];
  stations?: FireStation[];
  units?: OperationalUnit[];
  assets?: OperationalAsset[];
  now?: number;
}): CommandDashboardResponse {
  const now = input.now ?? Date.now();
  const allFires = enrichFires(input.fires as never) as Fire[];
  const activeFires = allFires.filter(isOperationallyActive);
  const assignments = input.assignments || [];
  const stations = input.stations || [];
  const units = input.units || [];
  const assets = input.assets || [];
  const maintenanceRecords = units.flatMap((unit) => unit.maintenanceRecords || []);

  return {
    generatedAt: new Date(now).toISOString(),
    actionQueue: buildActionQueue(activeFires, assignments, now),
    activeFires,
    sourceHealth: buildSourceHealth(activeFires, now),
    weatherRisk: buildWeatherRisk(activeFires),
    unitStatus: buildUnitStatus(units, assignments),
    maintenanceStatus: buildMaintenanceStatus(maintenanceRecords, now),
    assetCoverage: buildAssetCoverage(assets),
    overview: buildProvincialOverview(allFires, now),
    stations,
    units,
    assets,
  };
}

export function buildActionQueue(
  fires: Fire[],
  assignments: IncidentAssignment[] = [],
  now = Date.now()
): CommandIncident[] {
  const activeAssignmentsByFire = new Map<string, IncidentAssignment>();
  for (const assignment of assignments) {
    if (!isActiveAssignment(assignment)) continue;
    if (!activeAssignmentsByFire.has(assignment.fireId)) {
      activeAssignmentsByFire.set(assignment.fireId, assignment);
    }
  }

  return fires
    .filter(isOperationallyActive)
    .map((fire) => toCommandIncident(fire, activeAssignmentsByFire.get(fire.id) || null, now))
    .filter((incident) => shouldShowInActionQueue(incident))
    .sort(compareCommandIncidents)
    .slice(0, 25);
}

export function buildSourceHealth(fires: Fire[], now = Date.now()): SourceHealth[] {
  const latest: DataFreshness = {};
  const assignLatest = (key: keyof DataFreshness, value?: string) => {
    if (!value) return;
    if (!latest[key] || new Date(value).getTime() > new Date(String(latest[key])).getTime()) {
      latest[key] = value;
    }
  };

  for (const fire of fires) {
    assignLatest('scan', new Date(fire.updatedAt).toISOString());
    assignLatest('lastScan', new Date(fire.updatedAt).toISOString());
    if (fire.manual) assignLatest('manual', new Date(fire.createdAt).toISOString());
    assignLatest('weather', fire.weatherSnapshot?.observedAt);
    for (const source of fire.sources || []) {
      if (source.source === 'FIRMS') {
        assignLatest('firms', source.ts);
        assignLatest('firmsPolar', source.ts);
      }
      if (source.source === 'GOES') assignLatest('goes', source.ts);
      if (source.layer === 'goes-fdcf') assignLatest('goesFdcf', source.ts);
      if (source.layer === 'firms-goes-nrt') assignLatest('firmsGeo', source.ts);
      if (source.layer === 'viirs-noaa21' || source.layer === 'viirs-noaa20' || source.layer === 'viirs-snpp') {
        assignLatest('viirs', source.ts);
      }
      if (source.layer === 'modis') assignLatest('modis', source.ts);
      if (source.source === 'SENTINEL3' || source.layer === 'sentinel3-slstr') assignLatest('sentinel3', source.ts);
      if (source.source === 'HLS' || source.layer === 'sentinel2-hls' || source.layer === 'landsat-hls') assignLatest('hls', source.ts);
      if (source.source === 'THERMAL' || source.layer === 'thermal-anomaly') assignLatest('thermal', source.ts);
      if (source.source === 'MANUAL') assignLatest('manual', source.ts);
    }
  }

  return [
    toSourceHealth('GOES', 'GOES combinado', latest.goes, 45, now),
    toSourceHealth('goes-fdcf', 'GOES-19 FDCF', latest.goesFdcf, 30, now),
    toSourceHealth('firms-goes-nrt', 'FIRMS GOES_NRT', latest.firmsGeo, 45, now),
    toSourceHealth('FIRMS', 'FIRMS polar', latest.firms, 480, now),
    toSourceHealth('viirs-noaa21', 'VIIRS/NOAA-21', latest.viirs, 480, now),
    toSourceHealth('modis', 'MODIS', latest.modis, 720, now),
    toSourceHealth('sentinel3-slstr', 'Sentinel-3 SLSTR', latest.sentinel3, 240, now),
    toSourceHealth('thermal-anomaly', 'Capa termica', latest.thermal || latest.goes || latest.firms, 60, now),
    toSourceHealth('scan', 'Escaneo/DB', latest.scan || latest.lastScan, 20, now),
    toSourceHealth('weather', 'Clima', latest.weather, 75, now),
    toSourceHealth('MANUAL', 'Manual', latest.manual, 1440, now),
  ];
}

export function buildWeatherRisk(fires: Fire[]): CommandDashboardResponse['weatherRisk'] {
  const relevant = fires.filter(isOperationallyActive);
  const withWeather = relevant.filter((fire) => fire.weatherSnapshot);
  const windValues = withWeather
    .map((fire) => fire.weatherSnapshot?.windSpeedKmh)
    .filter((value): value is number => typeof value === 'number');
  const maxWindKmh = windValues.length > 0 ? Math.max(...windValues) : null;
  const hotDryWindCount = withWeather.filter((fire) => hasHotDryWind(fire.weatherSnapshot)).length;
  const highWindCount = withWeather.filter((fire) => getEffectiveWindKmh(fire.weatherSnapshot) >= 35).length;
  const coveragePct = relevant.length ? Math.round((withWeather.length / relevant.length) * 100) : 0;
  const missingWeather = Math.max(0, relevant.length - withWeather.length);

  const level =
    relevant.length === 0 || withWeather.length === 0
      ? 'missing'
      : hotDryWindCount > 0 || highWindCount >= 2 || (maxWindKmh || 0) >= 45
        ? 'critical'
        : highWindCount > 0 || (maxWindKmh || 0) >= 30
          ? 'high'
          : withWeather.some((fire) => deriveWeatherRiskScore(fire.weatherSnapshot) >= 35)
            ? 'moderate'
            : 'stable';

  return {
    level,
    coveragePct,
    missingWeather,
    highWindCount,
    hotDryWindCount,
    maxWindKmh,
  };
}

export function buildUnitStatus(
  units: OperationalUnit[],
  assignments: IncidentAssignment[] = []
): CommandDashboardResponse['unitStatus'] {
  const activeUnitIds = new Set(
    assignments
      .filter(isActiveAssignment)
      .map((assignment) => assignment.unitId)
      .filter((value): value is string => Boolean(value))
  );

  return {
    total: units.length,
    available: units.filter((unit) => unit.status === 'available' && !activeUnitIds.has(unit.id)).length,
    assigned: units.filter((unit) => unit.status === 'assigned' || activeUnitIds.has(unit.id)).length,
    unavailable: units.filter((unit) => unit.status === 'unavailable').length,
    maintenance: units.filter((unit) => unit.status === 'maintenance').length,
    noCatalog: units.length === 0,
  };
}

export function buildAssetCoverage(assets: OperationalAsset[]): CommandDashboardResponse['assetCoverage'] {
  const byType = assets.reduce<Record<string, number>>((result, asset) => {
    result[asset.type] = (result[asset.type] || 0) + 1;
    return result;
  }, {});

  return {
    total: assets.length,
    byType,
    missingWaterSources: !byType.water_source,
    missingStations: !byType.station,
    missingHelipads: !byType.helipad,
    noCatalog: assets.length === 0,
  };
}

export function buildMaintenanceStatus(
  records: MaintenanceRecord[],
  now = Date.now()
): CommandDashboardResponse['maintenanceStatus'] {
  const today = startOfDay(now);
  const soon = today + 7 * 86400000;
  const open = records.filter((record) => record.status === 'scheduled' || record.status === 'in_progress');
  const dueTimes = open
    .map((record) => (record.dueAt ? new Date(record.dueAt).getTime() : null))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    totalOpen: open.length,
    overdue: dueTimes.filter((time) => time < today).length,
    dueSoon: dueTimes.filter((time) => time >= today && time <= soon).length,
    inProgress: open.filter((record) => record.status === 'in_progress').length,
  };
}

export function buildProvincialOverview(fires: Fire[], now = Date.now()): ProvincialOverview {
  const enriched = enrichFires(fires as never) as Fire[];
  const active = enriched.filter((fire) => fire.lifecycleStatus === 'active');
  const recent = enriched
    .sort((left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime())
    .slice(0, 25);
  const totalsByLifecycle = Object.fromEntries(lifecycles.map((status) => [status, 0])) as Record<LifecycleStatus, number>;
  for (const fire of enriched) {
    totalsByLifecycle[fire.lifecycleStatus] += 1;
  }

  const byStatus = Object.fromEntries(fireStatuses.map((status) => [status, 0])) as Record<FireStatus, number>;
  const byPriority = Object.fromEntries(priorities.map((priority) => [priority, 0])) as Record<IncidentPriority, number>;
  for (const fire of active) {
    byStatus[fire.status] += 1;
    byPriority[derivePriority(fire)] += 1;
  }

  const confirmedOrProbable = active.filter((fire) => fire.status === 'confirmed' || fire.status === 'probable');
  const reviewed = active.filter((fire) => fire.reviewedAt);
  const dispatched = active.filter((fire) => fire.dispatchedAt || fire.dispatchAt);
  const falsePositive = active.filter((fire) => fire.status === 'false_positive').length;

  return {
    generatedAt: new Date(now).toISOString(),
    totals: {
      ...totalsByLifecycle,
      last24h: recent.length,
      confirmedOrProbable: confirmedOrProbable.length,
      unreviewedConfirmedOrProbable: confirmedOrProbable.filter((fire) => !fire.reviewedAt).length,
      missingWeather: active.filter((fire) => !fire.weatherSnapshot).length,
      falsePositiveRate: active.length ? (falsePositive / active.length) * 100 : 0,
      avgReviewMinutes: averageMinutesFromDetection(reviewed, 'reviewedAt'),
      avgDispatchMinutes: averageMinutesFromDetection(dispatched, 'dispatchedAt'),
    },
    byPriority,
    byStatus,
    freshness: buildFreshness(active),
    topZones: buildTopZones(active),
    recent,
  };
}

export function isActiveAssignment(assignment: IncidentAssignment) {
  return assignment.status !== 'released' && !assignment.releasedAt;
}

function toCommandIncident(fire: Fire, assignment: IncidentAssignment | null, now: number): CommandIncident {
  const actionReason = getActionReason(fire, assignment, now);
  return {
    ...fire,
    actionReason,
    nextAction: getNextAction(actionReason, fire, assignment),
    tacticalSummary: getTacticalSummary(fire, assignment),
    weatherWarning: getWeatherWarningLabel(fire),
    assignment,
    responseEtaMinutes: getResponseEtaMinutes(fire),
    recommendedResources: getRecommendedResources(fire),
  };
}

function shouldShowInActionQueue(incident: CommandIncident) {
  return (
    incident.actionReason !== 'monitorear' ||
    incident.priority === 'critical' ||
    incident.priority === 'high' ||
    incident.status === 'confirmed' ||
    incident.status === 'probable'
  );
}

function compareCommandIncidents(left: CommandIncident, right: CommandIncident) {
  const leftScore = getCommandScore(left);
  const rightScore = getCommandScore(right);
  if (rightScore !== leftScore) return rightScore - leftScore;
  const basePriority = compareByPriorityAndTime(left, right);
  if (basePriority !== 0) return basePriority;
  return new Date(left.detectedAt).getTime() - new Date(right.detectedAt).getTime();
}

function getCommandScore(incident: CommandIncident) {
  return (
    priorityWeight[incident.priority || derivePriority(incident)] * 100 +
    (actionReasonWeight[incident.actionReason] || 0) +
    (incident.riskScore || deriveRiskScore(incident))
  );
}

function getActionReason(fire: Fire, assignment: IncidentAssignment | null, now: number) {
  const priority = fire.priority || derivePriority(fire);
  const weatherRisk = deriveWeatherRiskScore(fire.weatherSnapshot);
  const sourceStale = isAnyDetectionStale(fire, now);

  if (priority === 'critical' || weatherRisk >= 75 || hasHotDryWind(fire.weatherSnapshot)) return 'meteo critica';
  if ((fire.status === 'confirmed' || fire.status === 'probable' || priority === 'high') && !assignment) return 'sin unidad';
  if (!fire.reviewedAt || fire.operationalStatus === 'unreviewed') return 'sin revisar';
  if (sourceStale) return 'fuente atrasada';
  if (!fire.weatherSnapshot) return 'sin clima tactico';
  if (priority === 'high' || fire.operationalStatus === 'dispatched' || fire.operationalStatus === 'monitoring') return 'requiere seguimiento';
  return 'monitorear';
}

function getNextAction(actionReason: string, fire: Fire, assignment: IncidentAssignment | null) {
  if (actionReason === 'meteo critica') return assignment ? 'Controlar seguridad y viento' : 'Asignar unidad y controlar viento';
  if (actionReason === 'sin unidad') return 'Asignar unidad';
  if (actionReason === 'sin revisar') return fire.status === 'unconfirmed' ? 'Revisar evidencia' : 'Marcar revisado';
  if (actionReason === 'fuente atrasada') return 'Revisar frescura';
  if (actionReason === 'sin clima tactico') return 'Completar clima';
  if (actionReason === 'requiere seguimiento') return 'Actualizar seguimiento';
  return 'Mantener monitoreo';
}

function getTacticalSummary(fire: Fire, assignment: IncidentAssignment | null) {
  const status = getStatusLabel(fire.status);
  const opStatus = getOperationalStatusLabel(fire.operationalStatus || 'unreviewed');
  const frp = getMaxFrp(fire);
  const detections = getDetectionCount(fire);
  const resource = assignment?.unit?.name || assignment?.unitName || fire.assignedUnit || 'sin unidad';
  const weather = getWeatherWarningLabel(fire);
  return `${status} / ${opStatus} / ${detections} det. / ${frp > 0 ? `${frp.toFixed(1)} MW` : 'sin FRP'} / ${weather} / ${resource}`;
}

function getWeatherWarningLabel(fire: Fire) {
  const weather = fire.weatherSnapshot;
  if (!weather) return 'requiere clima';
  if (hasHotDryWind(weather)) return 'propagacion rapida';
  if (getEffectiveWindKmh(weather) >= 35) return 'viento fuerte';
  if (typeof weather.humidityPct === 'number' && weather.humidityPct <= 25) return 'combustible seco';
  if (typeof weather.capeJkg === 'number' && weather.capeJkg >= 1000) return 'inestabilidad';
  if (getRainMm(weather) > 0) return 'precipitacion';
  return 'sin alerta meteo';
}

function hasHotDryWind(weather?: WeatherSnapshot | null) {
  return (
    typeof weather?.temperatureC === 'number' &&
    typeof weather.humidityPct === 'number' &&
    typeof weather.windSpeedKmh === 'number' &&
    weather.temperatureC >= 30 &&
    weather.humidityPct <= 25 &&
    weather.windSpeedKmh >= 20
  );
}

function getEffectiveWindKmh(weather?: WeatherSnapshot | null) {
  if (!weather) return 0;
  const wind = typeof weather.windSpeedKmh === 'number' ? weather.windSpeedKmh : 0;
  const gust = typeof weather.windGustKmh === 'number' ? weather.windGustKmh : wind;
  return Math.max(wind, gust * 0.7);
}

function getRainMm(weather?: WeatherSnapshot | null) {
  if (!weather) return 0;
  const rain = typeof weather.rainMm === 'number' ? weather.rainMm : 0;
  const precipitation = typeof weather.precipitationMm === 'number' ? weather.precipitationMm : 0;
  return Math.max(rain, precipitation);
}

function getResponseEtaMinutes(fire: Fire) {
  const payloadEta = fire.payload?.estimatedResponseMinutes;
  if (typeof payloadEta === 'number') return payloadEta;
  return null;
}

function getRecommendedResources(fire: Fire) {
  const priority = fire.priority || derivePriority(fire);
  const weatherRisk = deriveWeatherRiskScore(fire.weatherSnapshot);
  if (priority === 'critical' || weatherRisk >= 75) {
    return ['brigada de ataque inicial', 'apoyo hidrico', 'coordinacion con Defensa Civil'];
  }
  if (priority === 'high' || weatherRisk >= 45) {
    return ['unidad liviana', 'equipo de comunicaciones'];
  }
  if (priority === 'medium') {
    return ['patrulla de verificacion'];
  }
  return ['monitoreo satelital'];
}

function isAnyDetectionStale(fire: Fire, now = Date.now()) {
  if (!fire.sources?.length) return false;
  const latest = fire.sources
    .map((source) => new Date(source.ts).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((left, right) => right - left)[0];
  if (!latest) return false;
  return now - latest > 12 * 3600000;
}

function toSourceHealth(
  key: SourceHealth['key'],
  label: string,
  latestAt: string | undefined,
  staleAfterMinutes: number,
  now: number
): SourceHealth {
  if (!latestAt) {
    return {
      key,
      label,
      status: 'missing',
      detail: 'sin dato cargado',
    };
  }

  const ageMinutes = Math.max(0, Math.round((now - new Date(latestAt).getTime()) / 60000));
  const status = ageMinutes <= staleAfterMinutes ? 'fresh' : 'stale';
  return {
    key,
    label,
    latestAt,
    ageMinutes,
    status,
    detail: status === 'fresh' ? `actualizado hace ${ageMinutes} min` : `atrasado hace ${ageMinutes} min`,
  };
}

function isOperationallyActive(fire: Fire) {
  return fire.lifecycleStatus === 'active' && fire.status !== 'false_positive' && fire.status !== 'extinguished';
}

function averageMinutesFromDetection(fires: Fire[], field: 'reviewedAt' | 'dispatchedAt') {
  if (fires.length === 0) return 0;
  const total = fires.reduce((sum, fire) => {
    const endValue = field === 'dispatchedAt' ? fire.dispatchedAt || fire.dispatchAt : fire.reviewedAt;
    if (!endValue) return sum;
    return sum + (new Date(endValue).getTime() - new Date(fire.detectedAt).getTime()) / 60000;
  }, 0);
  return Math.max(0, total / fires.length);
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function buildFreshness(fires: Fire[]): DataFreshness {
  const freshness: DataFreshness = {};
  const assignLatest = (key: keyof DataFreshness, value?: string) => {
    if (!value) return;
    if (!freshness[key] || new Date(value).getTime() > new Date(String(freshness[key])).getTime()) {
      freshness[key] = value;
    }
  };

  for (const fire of fires) {
    assignLatest('scan', new Date(fire.updatedAt).toISOString());
    assignLatest('lastScan', new Date(fire.updatedAt).toISOString());
    if (fire.manual) assignLatest('manual', new Date(fire.createdAt).toISOString());
    assignLatest('weather', fire.weatherSnapshot?.observedAt);
    for (const source of fire.sources || []) {
      if (source.source === 'FIRMS') {
        assignLatest('firms', source.ts);
        assignLatest('firmsPolar', source.ts);
      }
      if (source.source === 'GOES') assignLatest('goes', source.ts);
      if (source.layer === 'goes-fdcf') assignLatest('goesFdcf', source.ts);
      if (source.layer === 'firms-goes-nrt') assignLatest('firmsGeo', source.ts);
      if (source.layer === 'viirs-noaa21' || source.layer === 'viirs-noaa20' || source.layer === 'viirs-snpp') {
        assignLatest('viirs', source.ts);
      }
      if (source.layer === 'modis') assignLatest('modis', source.ts);
      if (source.source === 'SENTINEL3' || source.layer === 'sentinel3-slstr') assignLatest('sentinel3', source.ts);
      if (source.source === 'HLS' || source.layer === 'sentinel2-hls' || source.layer === 'landsat-hls') assignLatest('hls', source.ts);
      if (source.source === 'THERMAL' || source.layer === 'thermal-anomaly') assignLatest('thermal', source.ts);
      if (source.source === 'MANUAL') assignLatest('manual', source.ts);
    }
  }

  return freshness;
}

function buildTopZones(fires: Fire[]) {
  const zones = new Map<string, number>();
  for (const fire of fires) {
    const label = getApproxZone(fire.lat, fire.lon);
    zones.set(label, (zones.get(label) || 0) + getDetectionCount(fire));
  }
  return Array.from(zones.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function getApproxZone(lat: number, lon: number) {
  const width = JURISDICTION_BBOX.east - JURISDICTION_BBOX.west;
  const height = JURISDICTION_BBOX.north - JURISDICTION_BBOX.south;
  if (lon < JURISDICTION_BBOX.west + width / 3) return 'Oeste';
  if (lon > JURISDICTION_BBOX.east - width / 3) return 'Este';
  if (lat > JURISDICTION_BBOX.north - height / 3) return 'Norte';
  if (lat < JURISDICTION_BBOX.south + height / 3) return 'Sur';
  return 'Centro';
}
