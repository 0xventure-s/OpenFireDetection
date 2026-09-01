import {
  AnalysisDashboardResponse,
  AnalysisDriver,
  AnalysisIncident,
  AnalysisPeriod,
  AnalysisRiskLevel,
  AnalysisSeverity,
  AnalysisSourceMatrixRow,
  AnalysisTimelineBucket,
  AnalysisZone,
  CommandIncident,
  DetectionLayerKind,
  Fire,
  FireSource,
  FireSourceKind,
  FireStation,
  IncidentAssignment,
  IncidentPriority,
  OperationalAsset,
  OperationalUnit,
  SourceHealth,
  SourceHealthStatus,
} from '@/types';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { buildCommandDashboard } from '@/lib/command-dashboard';
import {
  derivePriority,
  deriveRiskScore,
  deriveWeatherRiskScore,
  enrichFires,
  getDetectionCount,
  getMaxFrp,
} from '@/lib/fire-utils';
import { SATELLITE_LAYERS } from '@/lib/satellite-layers';

const analysisPeriods: AnalysisPeriod[] = ['24h', '7d', '30d', '90d', 'all'];
const confirmsFireLayers = new Set(
  SATELLITE_LAYERS.filter((layer) => layer.confirmsFire).map((layer) => layer.key)
);

const sourceRows: Array<{
  key: SourceHealth['key'];
  label: string;
  staleAfterMinutes: number;
  confirmsFire: boolean;
}> = [
  { key: 'GOES', label: 'GOES combinado', staleAfterMinutes: 45, confirmsFire: false },
  { key: 'goes-fdcf', label: 'GOES-19 FDCF', staleAfterMinutes: 30, confirmsFire: false },
  { key: 'firms-goes-nrt', label: 'FIRMS GOES_NRT', staleAfterMinutes: 45, confirmsFire: false },
  { key: 'FIRMS', label: 'FIRMS polar', staleAfterMinutes: 480, confirmsFire: true },
  { key: 'viirs-noaa21', label: 'VIIRS NOAA-21', staleAfterMinutes: 480, confirmsFire: true },
  { key: 'viirs-noaa20', label: 'VIIRS NOAA-20', staleAfterMinutes: 480, confirmsFire: true },
  { key: 'viirs-snpp', label: 'VIIRS S-NPP', staleAfterMinutes: 480, confirmsFire: true },
  { key: 'modis', label: 'MODIS', staleAfterMinutes: 720, confirmsFire: true },
  { key: 'sentinel3-slstr', label: 'Sentinel-3 SLSTR', staleAfterMinutes: 240, confirmsFire: true },
  { key: 'thermal-anomaly', label: 'Capa termica', staleAfterMinutes: 60, confirmsFire: false },
  { key: 'sentinel2-hls', label: 'Sentinel-2 HLS', staleAfterMinutes: 4320, confirmsFire: false },
  { key: 'landsat-hls', label: 'Landsat HLS', staleAfterMinutes: 4320, confirmsFire: false },
  { key: 'goes-glm-lightning', label: 'GOES-19 GLM rayos', staleAfterMinutes: 20, confirmsFire: false },
  { key: 'weather', label: 'Clima tactico', staleAfterMinutes: 75, confirmsFire: false },
  { key: 'scan', label: 'Escaneo/DB', staleAfterMinutes: 20, confirmsFire: false },
];

const priorityWeight: Record<IncidentPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

type SourceFreshnessScan = {
  status: string;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  summary: string | null;
};

export function normalizeAnalysisPeriod(period?: string | null): AnalysisPeriod {
  return analysisPeriods.includes(period as AnalysisPeriod) ? (period as AnalysisPeriod) : '30d';
}

export function buildAnalysisDashboard(input: {
  fires: Fire[];
  assignments?: IncidentAssignment[];
  stations?: FireStation[];
  units?: OperationalUnit[];
  assets?: OperationalAsset[];
  latestScan?: SourceFreshnessScan | null;
  period?: AnalysisPeriod;
  now?: number;
}): AnalysisDashboardResponse {
  const now = input.now ?? Date.now();
  const period = input.period ?? '30d';
  const enriched = enrichFires(input.fires as never) as Fire[];
  const command = buildCommandDashboard({
    fires: enriched,
    assignments: input.assignments || [],
    stations: input.stations || [],
    units: input.units || [],
    assets: input.assets || [],
    now,
  });
  const periodStart = getPeriodStart(period, now);
  const scopeFires = enriched.filter((fire) => isInAnalysisScope(fire, periodStart));
  const activeFires = command.activeFires;
  const operationalDebt = buildOperationalDebt(activeFires, command.actionQueue);
  const sourceMatrix = buildSourceMatrix(scopeFires, command.sourceHealth, now, input.latestScan || null);
  const drivers = buildDrivers(activeFires, command.actionQueue, sourceMatrix);
  const headline = buildHeadline(activeFires, command.actionQueue, command.sourceHealth, command.weatherRisk.coveragePct, operationalDebt, drivers);

  return {
    generatedAt: new Date(now).toISOString(),
    period,
    headline,
    drivers,
    timeline: buildTimeline(scopeFires, period, periodStart),
    zones: buildZones(scopeFires),
    sourceMatrix,
    weather: {
      ...command.weatherRisk,
      withoutWeatherFireIds: activeFires.filter((fire) => !fire.weatherSnapshot).map((fire) => fire.id),
    },
    resources: {
      unitsTotal: command.unitStatus.total,
      unitsAvailable: command.unitStatus.available,
      unitsAssigned: command.unitStatus.assigned,
      unitsUnavailable: command.unitStatus.unavailable,
      unitsMaintenance: command.unitStatus.maintenance,
      noUnitCatalog: command.unitStatus.noCatalog,
      maintenanceOpen: command.maintenanceStatus.totalOpen,
      maintenanceOverdue: command.maintenanceStatus.overdue,
      maintenanceDueSoon: command.maintenanceStatus.dueSoon,
      assetsTotal: command.assetCoverage.total,
      waterSources: command.assetCoverage.byType.water_source || 0,
      stations: command.stations.length || command.assetCoverage.byType.station || 0,
      helipads: command.assetCoverage.byType.helipad || 0,
      missingWaterSources: command.assetCoverage.missingWaterSources,
      missingStations: command.assetCoverage.missingStations,
      missingHelipads: command.assetCoverage.missingHelipads,
      noAssetCatalog: command.assetCoverage.noCatalog,
    },
    incidents: command.actionQueue.slice(0, 10).map(toAnalysisIncident),
  };
}

function getPeriodStart(period: AnalysisPeriod, now: number) {
  if (period === 'all') return null;
  const hoursByPeriod: Record<Exclude<AnalysisPeriod, 'all'>, number> = {
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24,
    '90d': 90 * 24,
  };
  return now - hoursByPeriod[period] * 3600000;
}

function isInAnalysisScope(fire: Fire, periodStart: number | null) {
  if (periodStart === null) return true;
  const detectedAt = new Date(fire.detectedAt).getTime();
  return detectedAt >= periodStart || isOperationallyActive(fire);
}

function isOperationallyActive(fire: Fire) {
  return fire.lifecycleStatus === 'active' && fire.status !== 'false_positive' && fire.status !== 'extinguished';
}

function buildOperationalDebt(activeFires: Fire[], actionQueue: CommandIncident[]) {
  const noUnitIds = new Set(actionQueue.filter((fire) => fire.actionReason === 'sin unidad').map((fire) => fire.id));
  const unreviewed = activeFires.filter((fire) => !fire.reviewedAt || fire.operationalStatus === 'unreviewed').length;
  const missingWeather = activeFires.filter((fire) => !fire.weatherSnapshot).length;
  return unreviewed + noUnitIds.size + missingWeather;
}

function buildHeadline(
  activeFires: Fire[],
  actionQueue: CommandIncident[],
  sourceHealth: SourceHealth[],
  weatherCoveragePct: number,
  operationalDebt: number,
  drivers: AnalysisDriver[]
): AnalysisDashboardResponse['headline'] {
  const activeScores = activeFires.map((fire) => fire.riskScore || deriveRiskScore(fire));
  const maxRisk = activeScores.length ? Math.max(...activeScores) : 0;
  const topQueuePressure = actionQueue.slice(0, 5).reduce((sum, incident) => {
    const priority = incident.priority || derivePriority(incident);
    return sum + priorityWeight[priority] * 5;
  }, 0);
  const staleSources = sourceHealth.filter((source) => source.status === 'stale' || source.status === 'missing').length;
  const riskScore = clamp(
    Math.round(maxRisk * 0.72 + Math.min(24, topQueuePressure) + Math.min(18, operationalDebt * 4) + Math.min(16, staleSources * 3)),
    0,
    100
  );
  const freshSourcePct =
    sourceHealth.length > 0
      ? (sourceHealth.filter((source) => source.status === 'fresh').length / sourceHealth.length) * 100
      : 0;
  const catalogPct = 100;
  const dataConfidencePct = clamp(Math.round(freshSourcePct * 0.65 + weatherCoveragePct * 0.25 + catalogPct * 0.1), 0, 100);

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore, activeFires.length),
    dataConfidencePct,
    operationalDebt,
    topDriver: drivers[0]?.label || (activeFires.length > 0 ? 'Monitoreo activo' : 'Sin presion operativa'),
  };
}

function getRiskLevel(score: number, activeCount: number): AnalysisRiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 35) return 'moderate';
  if (activeCount > 0 || score > 0) return 'stable';
  return 'quiet';
}

function buildDrivers(
  activeFires: Fire[],
  actionQueue: CommandIncident[],
  sourceMatrix: AnalysisSourceMatrixRow[]
): AnalysisDriver[] {
  const drivers: AnalysisDriver[] = [];
  addActionDriver(drivers, actionQueue, 'meteo critica', 'Meteo critica', 'Viento, calor o sequedad elevan propagacion.', 'critical');
  addActionDriver(drivers, actionQueue, 'sin unidad', 'Incidentes sin unidad', 'Focos confirmados/probables o altos sin recurso asignado.', 'critical');
  addActionDriver(drivers, actionQueue, 'sin revisar', 'Focos sin revisar', 'Eventos activos pendientes de lectura de guardia.', 'high');
  addActionDriver(drivers, actionQueue, 'sin clima tactico', 'Sin clima tactico', 'Activos sin snapshot meteorologico util.', 'medium');
  addActionDriver(drivers, actionQueue, 'fuente atrasada', 'Fuente atrasada', 'Detecciones con evidencia satelital vieja.', 'medium');

  const staleSources = sourceMatrix.filter((source) => source.status === 'stale' || source.status === 'missing');
  if (staleSources.length > 0) {
    drivers.push({
      id: 'source-health',
      label: 'Frescura degradada',
      detail: `${staleSources.length} fuentes atrasadas o sin dato.`,
      count: staleSources.length,
      severity: staleSources.some((source) => source.status === 'stale') ? 'high' : 'medium',
      score: staleSources.length * 8,
      affectedFireIds: [],
    });
  }

  const hotDryWind = activeFires.filter((fire) => deriveWeatherRiskScore(fire.weatherSnapshot) >= 60);
  if (hotDryWind.length > 0) {
    drivers.push({
      id: 'weather-pressure',
      label: 'Presion meteorologica',
      detail: `${hotDryWind.length} focos con riesgo meteo alto.`,
      count: hotDryWind.length,
      severity: 'high',
      score: hotDryWind.length * 12,
      affectedFireIds: hotDryWind.map((fire) => fire.id),
    });
  }

  return drivers
    .sort((left, right) => getSeverityWeight(right.severity) - getSeverityWeight(left.severity) || right.score - left.score)
    .slice(0, 6);
}

function addActionDriver(
  drivers: AnalysisDriver[],
  actionQueue: CommandIncident[],
  reason: string,
  label: string,
  detail: string,
  severity: AnalysisSeverity
) {
  const affected = actionQueue.filter((fire) => fire.actionReason === reason);
  if (affected.length === 0) return;
  drivers.push({
    id: reason.replaceAll(' ', '-'),
    label,
    detail,
    count: affected.length,
    severity,
    score: affected.reduce((sum, fire) => sum + (fire.riskScore || deriveRiskScore(fire)), 0),
    affectedFireIds: affected.map((fire) => fire.id),
  });
}

function getSeverityWeight(severity: AnalysisSeverity) {
  if (severity === 'critical') return 100;
  if (severity === 'high') return 70;
  if (severity === 'medium') return 40;
  return 20;
}

function buildTimeline(fires: Fire[], period: AnalysisPeriod, periodStart: number | null): AnalysisTimelineBucket[] {
  const buckets = new Map<string, AnalysisTimelineBucket & { time: number; totalRisk: number }>();

  for (const fire of fires) {
    const detectedAt = new Date(fire.detectedAt).getTime();
    if (!Number.isFinite(detectedAt)) continue;
    const key = getTimelineKey(detectedAt, period, periodStart);
    const current = buckets.get(key.key) || {
      label: key.label,
      detected: 0,
      confirmed: 0,
      falsePositive: 0,
      avgRiskScore: 0,
      maxFrp: 0,
      time: key.time,
      totalRisk: 0,
    };
    current.detected += 1;
    current.confirmed += fire.status === 'confirmed' ? 1 : 0;
    current.falsePositive += fire.status === 'false_positive' ? 1 : 0;
    current.totalRisk += fire.riskScore || deriveRiskScore(fire);
    current.avgRiskScore = Math.round(current.totalRisk / current.detected);
    current.maxFrp = Math.max(current.maxFrp, getMaxFrp(fire));
    buckets.set(key.key, current);
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.time - right.time)
    .slice(period === '24h' ? -14 : -18)
    .map((bucket) => ({
      label: bucket.label,
      detected: bucket.detected,
      confirmed: bucket.confirmed,
      falsePositive: bucket.falsePositive,
      avgRiskScore: bucket.avgRiskScore,
      maxFrp: bucket.maxFrp,
    }));
}

function getTimelineKey(timestamp: number, period: AnalysisPeriod, periodStart: number | null) {
  if (periodStart !== null && timestamp < periodStart) {
    return { key: 'carry', label: 'Activos previos', time: periodStart - 1 };
  }

  const date = new Date(timestamp);
  if (period === '24h') {
    const hour = date.getHours().toString().padStart(2, '0');
    return { key: date.toISOString().slice(0, 13), label: `${hour}h`, time: timestamp };
  }
  if (period === 'all') {
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      time: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
    };
  }
  return {
    key: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    time: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
  };
}

function buildZones(fires: Fire[]): AnalysisZone[] {
  const zones = new Map<string, {
    fires: Fire[];
    sourceCounts: Map<string, number>;
  }>();

  for (const fire of fires) {
    const label = getApproxZone(fire.lat, fire.lon);
    const current = zones.get(label) || { fires: [], sourceCounts: new Map<string, number>() };
    current.fires.push(fire);
    const source = getFireSourceLabel(fire);
    current.sourceCounts.set(source, (current.sourceCounts.get(source) || 0) + 1);
    zones.set(label, current);
  }

  return Array.from(zones.entries())
    .map(([label, zone]) => {
      const totalRisk = zone.fires.reduce((sum, fire) => sum + (fire.riskScore || deriveRiskScore(fire)), 0);
      return {
        label,
        count: zone.fires.length,
        confirmed: zone.fires.filter((fire) => fire.status === 'confirmed').length,
        avgRiskScore: zone.fires.length ? Math.round(totalRisk / zone.fires.length) : 0,
        maxFrp: zone.fires.reduce((max, fire) => Math.max(max, getMaxFrp(fire)), 0),
        missingWeather: zone.fires.filter((fire) => !fire.weatherSnapshot).length,
        dominantSource: getDominantSource(zone.sourceCounts),
      };
    })
    .sort((left, right) => right.avgRiskScore - left.avgRiskScore || right.count - left.count)
    .slice(0, 8);
}

function buildSourceMatrix(
  fires: Fire[],
  health: SourceHealth[],
  now: number,
  latestScan: SourceFreshnessScan | null
): AnalysisSourceMatrixRow[] {
  const healthByKey = new Map(health.map((source) => [source.key, source]));

  return sourceRows.map((row) => {
    const matchingSources = fires.flatMap((fire) => fire.sources || []).filter((source) => sourceMatchesKey(source, row.key));
    const latestScanAt = getLatestScanTimeForSource(latestScan, row.key);
    const latestAt = latestScanAt || getLatestSourceTime(matchingSources) || getLatestSyntheticTime(fires, row.key);
    const ageMinutes = latestAt ? Math.max(0, Math.round((now - new Date(latestAt).getTime()) / 60000)) : undefined;
    const status = latestAt ? getSourceStatus(ageMinutes || 0, row.staleAfterMinutes) : 'missing';

    return {
      key: row.key,
      label: healthByKey.get(row.key)?.label || row.label,
      status,
      latestAt,
      ageMinutes,
      detections: row.key === 'weather' ? fires.filter((fire) => fire.weatherSnapshot).length : matchingSources.length,
      confirmsFire: row.confirmsFire || confirmsFireLayers.has(row.key as DetectionLayerKind),
    };
  });
}

function getLatestScanTimeForSource(
  latestScan: SourceFreshnessScan | null,
  key: SourceHealth['key']
) {
  if (!latestScan || latestScan.status !== 'success' || !wasSourceCheckedInScan(latestScan.summary, key)) return undefined;
  return new Date(latestScan.finishedAt || latestScan.startedAt).toISOString();
}

function wasSourceCheckedInScan(summary: string | null, key: SourceHealth['key']) {
  if (key === 'scan') return true;
  if (!summary) return false;

  if (key === 'GOES') return summary.includes('GOES directo:') || summary.includes('GOES FIRMS:');
  if (key === 'goes-fdcf') return summary.includes('GOES directo:');
  if (key === 'firms-goes-nrt') return summary.includes('GOES FIRMS:');
  if (key === 'FIRMS' || key === 'viirs-noaa21' || key === 'viirs-noaa20' || key === 'viirs-snpp' || key === 'modis') {
    return summary.includes('FIRMS polar:');
  }
  if (key === 'sentinel3-slstr') return summary.includes('Sentinel-3:');
  if (key === 'weather') return summary.includes('meteo:');
  return false;
}

function getLatestSourceTime(sources: FireSource[]) {
  return sources
    .map((source) => source.ts)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function getLatestSyntheticTime(fires: Fire[], key: SourceHealth['key']) {
  if (key === 'weather') {
    return fires
      .map((fire) => fire.weatherSnapshot?.observedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  }
  if (key === 'scan') {
    return fires
      .map((fire) => new Date(fire.updatedAt).toISOString())
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
  }
  return undefined;
}

function sourceMatchesKey(source: FireSource, key: SourceHealth['key']) {
  if (source.layer === key) return true;
  if (source.source === key) return true;
  if (key === 'thermal-anomaly') return source.source === 'THERMAL';
  if (key === 'sentinel2-hls') return source.layer === 'sentinel2-hls' || source.source === 'HLS';
  if (key === 'landsat-hls') return source.layer === 'landsat-hls';
  return false;
}

function getSourceStatus(ageMinutes: number, staleAfterMinutes: number): SourceHealthStatus {
  return ageMinutes <= staleAfterMinutes ? 'fresh' : 'stale';
}

function toAnalysisIncident(incident: CommandIncident): AnalysisIncident {
  return {
    id: incident.id,
    lat: incident.lat,
    lon: incident.lon,
    detectedAt: incident.detectedAt,
    status: incident.status,
    priority: incident.priority || derivePriority(incident),
    actionReason: incident.actionReason,
    nextAction: incident.nextAction,
    tacticalSummary: incident.tacticalSummary,
    riskScore: incident.riskScore || deriveRiskScore(incident),
    maxFrp: getMaxFrp(incident),
    detections: getDetectionCount(incident),
    missingWeather: !incident.weatherSnapshot,
    assignedUnit: incident.assignment?.unit?.name || incident.assignment?.unitName || incident.assignedUnit || null,
  };
}

function getFireSourceLabel(fire: Fire) {
  const primary = fire.sources?.[0];
  if (!primary) return fire.manual ? 'Manual' : 'Sin fuente';
  if (primary.layer === 'firms-goes-nrt') return 'FIRMS GOES';
  if (primary.layer === 'goes-fdcf') return 'GOES-19';
  if (primary.layer?.startsWith('viirs')) return 'VIIRS';
  if (primary.layer === 'modis') return 'MODIS';
  if (primary.layer === 'sentinel3-slstr') return 'Sentinel-3';
  if (primary.layer === 'thermal-anomaly') return 'Termica';
  return getSourceKindLabel(primary.source);
}

function getSourceKindLabel(source: FireSourceKind) {
  if (source === 'SENTINEL3') return 'Sentinel-3';
  if (source === 'THERMAL') return 'Termica';
  return source;
}

function getDominantSource(sourceCounts: Map<string, number>) {
  return Array.from(sourceCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || 'Sin fuente';
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
