import { FIRE_STATUS, LIFECYCLE_LABELS, STATUS_LABELS } from '@/lib/constants';
import {
  CommandAlert,
  Fire,
  FireAudit,
  FirePayload,
  FireSource,
  FireStatus,
  IncidentPriority,
  LifecycleStatus,
  OperationalStatus,
  WeatherSnapshot,
} from '@/types';

type RiskInput = Pick<Fire, 'status' | 'sources' | 'payload' | 'detectedAt'> & {
  weatherSnapshot?: WeatherSnapshot | null;
};

const operationalStatusLabels: Record<OperationalStatus, string> = {
  unreviewed: 'Sin revisar',
  evaluating: 'En evaluacion',
  dispatched: 'Despachado',
  monitoring: 'En seguimiento',
  closed: 'Cerrado',
};

const priorityLabels: Record<IncidentPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const priorityWeight: Record<IncidentPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function getDetectionCount(fire: Pick<Fire, 'sources'>): number {
  return Array.isArray(fire.sources) ? fire.sources.length : 0;
}

export function getMaxFrp(fire: Pick<Fire, 'sources'>): number {
  return (fire.sources || []).reduce((max, source) => Math.max(max, source.frp || 0), 0);
}

export function getPrimarySourceLabel(actor: string | null | undefined): string {
  switch (actor) {
    case 'system:firms':
      return 'NASA FIRMS';
    case 'system:goes':
      return 'GOES-19';
    case 'system:firms-goes':
      return 'FIRMS GOES';
    case 'system:sentinel3':
      return 'Sentinel-3 SLSTR';
    case 'system:hls':
      return 'HLS';
    case 'system:thermal':
      return 'Capa termica';
    case 'system:manual':
    case 'manual':
      return 'Operador';
    default:
      return actor || 'Desconocida';
  }
}

export function getStatusLabel(status: FireStatus): string {
  return STATUS_LABELS[status];
}

export function getLifecycleStatusLabel(status: LifecycleStatus): string {
  return LIFECYCLE_LABELS[status];
}

export function getThreatLevel(fire: Pick<Fire, 'sources'>): 'low' | 'medium' | 'high' {
  const frp = getMaxFrp(fire);
  if (frp > 10) return 'high';
  if (frp > 5) return 'medium';
  return 'low';
}

export function getOperationalStatusLabel(status: OperationalStatus): string {
  return operationalStatusLabels[status];
}

export function getPriorityLabel(priority: IncidentPriority): string {
  return priorityLabels[priority];
}

export function getPriorityColor(priority: IncidentPriority): string {
  switch (priority) {
    case 'critical':
      return '#ef4444';
    case 'high':
      return '#f97316';
    case 'medium':
      return '#f59e0b';
    case 'low':
    default:
      return '#06b6d4';
  }
}

export function isFireConfirmed(status: FireStatus): boolean {
  return status === FIRE_STATUS.CONFIRMED;
}

export function dedupeSources(sources: FireSource[]): FireSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = [
      source.source,
      source.layer || 'n/a',
      source.sourceProduct || 'n/a',
      source.satellite || 'n/a',
      source.ts,
    ].join(':');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function filterVisibleHistory(entries: FireAudit[]): FireAudit[] {
  return entries.filter((entry) => !entry.actor.startsWith('system:'));
}

export function deriveOperationalStatus(fire: Pick<Fire, 'status' | 'payload'>): OperationalStatus {
  const payload = normalizePayload(fire.payload);
  if (payload.operationalStatus) return payload.operationalStatus;
  if (fire.status === 'extinguished' || fire.status === 'false_positive') return 'closed';
  return 'unreviewed';
}

export function derivePriority(fire: RiskInput): IncidentPriority {
  const payload = normalizePayload(fire.payload);
  if (payload.priority) return payload.priority;

  const frp = getMaxFrp(fire);
  const detections = getDetectionCount(fire);
  const ageHours = Math.max(0, (Date.now() - new Date(fire.detectedAt).getTime()) / 3600000);
  const weatherRisk = deriveWeatherRiskScore(fire.weatherSnapshot);

  if (fire.status === 'confirmed' && (frp >= 10 || weatherRisk >= 75)) return 'critical';
  if ((fire.status === 'confirmed' || fire.status === 'probable') && weatherRisk >= 85) return 'critical';
  if (fire.status === 'confirmed' || frp >= 6 || detections >= 3 || weatherRisk >= 60) return 'high';
  if (fire.status === 'probable' || frp >= 2 || ageHours <= 2 || weatherRisk >= 35) return 'medium';
  return 'low';
}

export function deriveRiskScore(fire: RiskInput): number {
  const payload = normalizePayload(fire.payload);
  if (typeof payload.riskScore === 'number') return payload.riskScore;

  const frp = getMaxFrp(fire);
  const detections = getDetectionCount(fire);
  let score = Math.min(100, frp * 6 + detections * 12);
  if (fire.status === 'confirmed') score += 20;
  if (fire.status === 'probable') score += 10;
  score += Math.min(34, deriveWeatherRiskScore(fire.weatherSnapshot) * 0.35);
  return Math.min(100, Math.round(score));
}

export function deriveWeatherRiskScore(weather?: WeatherSnapshot | null): number {
  if (!weather) return 0;

  const temp = typeof weather.temperatureC === 'number' ? weather.temperatureC : 20;
  const humidity = typeof weather.humidityPct === 'number' ? weather.humidityPct : 50;
  const wind = typeof weather.windSpeedKmh === 'number' ? weather.windSpeedKmh : 0;
  const gust = typeof weather.windGustKmh === 'number' ? weather.windGustKmh : wind;
  const cape = typeof weather.capeJkg === 'number' ? weather.capeJkg : 0;
  const rainPenalty = getWeatherRainMm(weather) > 0 ? 14 : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.min(45, wind * 1.05 + Math.max(0, gust - wind) * 0.5) +
        Math.max(0, temp - 24) * 1.45 +
        Math.max(0, 38 - humidity) * 1.15 +
        Math.min(12, cape / 220) -
        rainPenalty
    )
  );
}

export function deriveRiskSummary(fire: RiskInput): string {
  const payload = normalizePayload(fire.payload);
  if (payload.riskSummary) return payload.riskSummary;

  const priority = derivePriority(fire);
  const score = deriveRiskScore(fire);
  const detections = getDetectionCount(fire);
  const weatherRisk = deriveWeatherRiskScore(fire.weatherSnapshot);

  if (priority === 'critical' && weatherRisk >= 75) return `Incidente critico: confirmacion fuerte y meteo adversa, ${detections} detecciones, score ${score}.`;
  if (priority === 'critical') return `Incidente critico: confirmacion fuerte, ${detections} detecciones, score ${score}.`;
  if (weatherRisk >= 60) return `Incidente alto: viento, sequedad o calor elevan la propagacion probable. Score ${score}.`;
  if (priority === 'high') return `Incidente alto: evidencia relevante y posible necesidad de despacho.`;
  if (priority === 'medium') return `Incidente medio: requiere evaluacion operativa.`;
  return `Incidente bajo: seguimiento recomendado antes de escalar.`;
}

export function enrichFire<T extends Fire>(fire: T): T {
  const payload = normalizePayload(fire.payload);
  const lifecycleStatus =
    fire.lifecycleStatus ||
    (payload.test ? 'test' : fire.status === 'extinguished' || fire.status === 'false_positive' ? 'closed' : 'active');
  return {
    ...fire,
    lifecycleStatus,
    payload,
    operationalStatus: deriveOperationalStatus(fire),
    priority: derivePriority(fire),
    assignedUnit: asNullableString(payload.assignedUnit),
    assignedTeam: asNullableString(payload.assignedTeam),
    reviewedAt: fire.reviewedAt || asNullableString(payload.reviewedAt),
    reviewedBy: fire.reviewedBy || asNullableString(payload.reviewedBy),
    dispatchAt: fire.dispatchedAt || asNullableString(payload.dispatchAt),
    dispatchBy: fire.dispatchedBy || asNullableString(payload.dispatchBy),
    riskScore: deriveRiskScore(fire),
    riskSummary: deriveRiskSummary(fire),
  };
}

export function enrichFires<T extends Fire>(fires: T[]): T[] {
  return fires.map((fire) => enrichFire(fire));
}

export function compareByPriorityAndTime(left: Fire, right: Fire): number {
  const priorityDelta = priorityWeight[derivePriority(right)] - priorityWeight[derivePriority(left)];
  if (priorityDelta !== 0) return priorityDelta;
  const scoreDelta = deriveRiskScore(right) - deriveRiskScore(left);
  if (scoreDelta !== 0) return scoreDelta;
  return new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime();
}

export function buildCommandAlerts(fires: Fire[]): CommandAlert[] {
  const sorted = [...fires].sort(compareByPriorityAndTime);
  return sorted.slice(0, 5).map((fire) => {
    const priority = derivePriority(fire);
    const frp = getMaxFrp(fire);
    const kind =
      priority === 'critical'
        ? 'critical'
        : fire.status === 'confirmed'
          ? 'confirmed'
          : getDetectionCount(fire) > 1
            ? 'updated'
            : 'new';

    return {
      id: `${fire.id}:${kind}`,
      fireId: fire.id,
      title:
        kind === 'critical'
          ? 'Incidente critico'
          : kind === 'confirmed'
            ? 'Foco confirmado'
            : kind === 'updated'
              ? 'Incidente actualizado'
              : 'Nuevo incidente',
      detail: `${getStatusLabel(fire.status)} | ${frp > 0 ? `${frp.toFixed(1)} MW` : 'sin FRP'} | ${getDetectionCount(fire)} detecciones`,
      kind,
      createdAt: new Date(fire.detectedAt).toISOString(),
      priority,
    };
  });
}

export function normalizePayload(payload: unknown): FirePayload {
  if (!payload || typeof payload !== 'object') return {};
  return payload as FirePayload;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getWeatherRainMm(weather: WeatherSnapshot) {
  const rain = typeof weather.rainMm === 'number' ? weather.rainMm : 0;
  const precipitation = typeof weather.precipitationMm === 'number' ? weather.precipitationMm : 0;
  return Math.max(rain, precipitation);
}
