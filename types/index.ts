export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type FireStatus =
  | 'unconfirmed'
  | 'probable'
  | 'confirmed'
  | 'false_positive'
  | 'extinguished';

export type OperationalStatus =
  | 'unreviewed'
  | 'evaluating'
  | 'dispatched'
  | 'monitoring'
  | 'closed';

export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';

export type LifecycleStatus = 'active' | 'closed' | 'archived' | 'test';
export type LifecycleFilter = LifecycleStatus | 'all';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'confirmed'
  | 'rejected'
  | 'manual_add'
  | 'note_added'
  | 'extinguished'
  | 'deleted'
  | 'operational_update';

export type FireSourceKind = 'FIRMS' | 'GOES' | 'SENTINEL3' | 'HLS' | 'THERMAL' | 'MANUAL';
export type DetectionLayerKind =
  | 'goes-fdcf'
  | 'firms-goes-nrt'
  | 'viirs-noaa21'
  | 'viirs-noaa20'
  | 'viirs-snpp'
  | 'modis'
  | 'sentinel3-slstr'
  | 'sentinel2-hls'
  | 'landsat-hls'
  | 'landsat-nrt'
  | 'thermal-anomaly'
  | 'goes-glm-lightning'
  | 'camera-ai'
  | 'manual';
export type FireConfidence = 'low' | 'nominal' | 'high';
export type AccessCondition = 'direct' | 'restricted' | 'remote';
export type ResourceLevel = 'monitor' | 'verify' | 'dispatch' | 'reinforced';
export type OperationalUnitStatus = 'available' | 'assigned' | 'unavailable' | 'maintenance';
export type OperationalUnitType = 'engine' | 'tanker' | 'brush_truck' | 'pickup' | 'machinery' | 'support' | 'brigade' | 'other';
export type OperationalAssetType = 'water_tank' | 'water_source' | 'helipad' | 'station' | 'staging' | 'access_point' | 'other';
export type OperationalAssetStatus = 'available' | 'unavailable' | 'unknown';
export type IncidentAssignmentStatus = 'assigned' | 'en_route' | 'on_scene' | 'released';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type SourceHealthStatus = 'fresh' | 'stale' | 'missing';
export type ScanTriggerType = 'manual' | 'polling';
export type ScanStatus = 'running' | 'success' | 'failed' | 'idle';
export type ResourceCategory = 'vehicle' | 'machinery' | 'water_asset' | 'station';
export type MapLayerKey =
  | 'fires'
  | 'lightning'
  | 'earthquakes'
  | 'stations'
  | 'available_units'
  | 'assigned_units'
  | 'machinery'
  | 'water_assets';

export interface FireSource {
  source: FireSourceKind;
  layer?: DetectionLayerKind;
  sourceProduct?: string;
  confidence?: FireConfidence;
  prob?: number;
  ts: string;
  satellite?: string;
  brightness?: number;
  frp?: number;
  heat?: number;
  maskCode?: number;
  areaM2?: number;
}

export type DataFreshness = JsonObject & {
  firms?: string;
  firmsPolar?: string;
  firmsGeo?: string;
  viirs?: string;
  modis?: string;
  goes?: string;
  goesFdcf?: string;
  lightning?: string;
  sentinel3?: string;
  hls?: string;
  thermal?: string;
  manual?: string;
  weather?: string;
  terrain?: string;
  scan?: string;
  lastScan?: string;
  lastError?: string;
};

export type WeatherSnapshot = JsonObject & {
  temperatureC?: number;
  humidityPct?: number;
  windSpeedKmh?: number;
  windDirectionDeg?: number;
  windGustKmh?: number;
  rainMm?: number;
  precipitationMm?: number;
  rainProbabilityPct?: number;
  weatherCode?: number;
  capeJkg?: number;
  source?: string;
  observedAt?: string;
};

export type EnvironmentalAlertKind = 'rain' | 'storm';
export type EnvironmentalAlertSeverity = 'info' | 'warning' | 'danger';

export interface EnvironmentalForecastAlert {
  id: string;
  kind: EnvironmentalAlertKind;
  severity: EnvironmentalAlertSeverity;
  startsAt: string;
  probabilityPct: number;
  precipitationMm: number;
  gustKmh: number;
  capeJkg: number;
  affectedPoints: number;
}

export interface ProvinceWeatherForecast {
  generatedAt: string;
  source: string;
  scope: string;
  refreshMinutes: number;
  points: number;
  alerts: EnvironmentalForecastAlert[];
}

export interface PrecipitationLayerMetadata {
  generatedAt: string;
  observedAt: string;
  source: string;
  product: 'IMERG_Precipitation_Rate_30min';
  intervalMinutes: 30;
  spatialResolutionKm: 10;
  approximateLatencyHours: 4;
  role: 'risk';
}

export interface WindGridPoint {
  id: string;
  lat: number;
  lon: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustKmh?: number;
  observedAt?: string;
  source?: string;
}

export interface WindLayerResponse {
  generatedAt: string;
  source: string;
  refreshMinutes: number;
  summary: WindLayerSummary;
  bbox: BBox;
  count: number;
  points: WindGridPoint[];
}

export interface WindLayerSummary {
  averageSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  maxGustKmh: number | null;
  dominantDirectionDeg: number | null;
  observedAt?: string;
}

export type TerrainSnapshot = JsonObject & {
  altitudeM?: number;
  slopeDeg?: number;
  aspectDeg?: number;
  fuelType?: string;
  fuelDensity?: string;
  ndwi?: number;
  source?: string;
  observedAt?: string;
};

export type ProjectionSnapshot = JsonObject & {
  directionDeg?: number;
  distanceKm1h?: number;
  distanceKm3h?: number;
  confidence?: FireConfidence;
  summary?: string;
  generatedAt?: string;
};

export type OperationalContextSnapshot = JsonObject & {
  source?: string;
  generatedAt?: string;
  accessCondition?: AccessCondition;
  accessSummary?: string;
  estimatedResponseMinutes?: number;
  resourceLevel?: ResourceLevel;
  resourceSummary?: string;
  recommendedResources?: string[];
};

export type FirePayload = JsonObject & {
  notes?: string;
  reportedBy?: string;
  manual?: boolean;
  detectionSource?: FireSourceKind;
  operationalStatus?: OperationalStatus;
  priority?: IncidentPriority;
  assignedUnit?: string;
  assignedTeam?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  dispatchAt?: string;
  dispatchBy?: string;
  riskScore?: number;
  riskSummary?: string;
};

export interface Fire {
  id: string;
  lat: number;
  lon: number;
  geom: string;
  detectedAt: Date | string;
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: Date | string | null;
  status: FireStatus;
  lifecycleStatus: LifecycleStatus;
  extinguishedBy?: string | null;
  extinguishedAt?: Date | string | null;
  closedAt?: Date | string | null;
  dataFreshness?: DataFreshness;
  weatherSnapshot?: WeatherSnapshot | null;
  terrainSnapshot?: TerrainSnapshot | null;
  projectionSnapshot?: ProjectionSnapshot | null;
  sources: FireSource[];
  payload: FirePayload;
  manual: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  operationalStatus?: OperationalStatus;
  priority?: IncidentPriority;
  assignedUnit?: string | null;
  assignedTeam?: string | null;
  reviewedAt?: Date | string | null;
  reviewedBy?: string | null;
  dispatchedAt?: Date | string | null;
  dispatchedBy?: string | null;
  dispatchAt?: Date | string | null;
  dispatchBy?: string | null;
  riskScore?: number | null;
  riskSummary?: string | null;
}

export interface FireAudit {
  id: string;
  fireId: string;
  action: AuditAction;
  actor: string;
  reason: string | null;
  payload: JsonValue | null;
  createdAt: Date | string;
}

export interface FireStation {
  id: string;
  code: string | null;
  name: string;
  locality: string | null;
  address: string | null;
  contact: string | null;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  payload: JsonValue;
  createdAt: Date | string;
  updatedAt: Date | string;
  units?: OperationalUnit[];
  audits?: OperationalAudit[];
}

export interface OperationalUnit {
  id: string;
  code: string;
  name: string;
  type: OperationalUnitType | string;
  stationId: string | null;
  baseName: string | null;
  status: OperationalUnitStatus | string;
  contact: string | null;
  licensePlate: string | null;
  capacityLiters: number | null;
  crewCapacity: number | null;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  payload: JsonValue;
  createdAt: Date | string;
  updatedAt: Date | string;
  station?: FireStation | null;
  maintenanceRecords?: MaintenanceRecord[];
  assignments?: IncidentAssignment[];
  audits?: OperationalAudit[];
}

export interface OperationalAsset {
  id: string;
  name: string;
  type: OperationalAssetType | string;
  status: OperationalAssetStatus | string;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  payload: JsonValue;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignments?: IncidentAssignment[];
  audits?: OperationalAudit[];
}

export interface IncidentAssignment {
  id: string;
  fireId: string;
  unitId: string | null;
  assetId: string | null;
  unitName: string | null;
  role: string;
  status: IncidentAssignmentStatus | string;
  assignedAt: Date | string;
  assignedBy: string;
  releasedAt: Date | string | null;
  notes: string | null;
  payload: JsonValue;
  createdAt: Date | string;
  updatedAt: Date | string;
  unit?: OperationalUnit | null;
  asset?: OperationalAsset | null;
}

export interface MaintenanceRecord {
  id: string;
  unitId: string;
  title: string;
  status: MaintenanceStatus | string;
  dueAt: Date | string | null;
  scheduledAt: Date | string | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  odometerKm: number | null;
  performedBy: string | null;
  notes: string | null;
  payload: JsonValue;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  unit?: OperationalUnit | null;
}

export interface OperationalAudit {
  id: string;
  stationId: string | null;
  unitId: string | null;
  assetId: string | null;
  maintenanceId: string | null;
  action: string;
  actor: string;
  reason: string | null;
  payload: JsonValue | null;
  createdAt: Date | string;
  station?: FireStation | null;
  unit?: OperationalUnit | null;
  asset?: OperationalAsset | null;
  maintenance?: MaintenanceRecord | null;
}

export interface AuditEvent {
  id: string;
  type: 'incident' | 'resource' | 'maintenance' | 'asset' | 'station';
  entityId: string;
  entityLabel: string;
  action: string;
  actor: string;
  reason: string | null;
  payload: JsonValue | null;
  createdAt: Date | string;
}

export interface ResourceDetail {
  id: string;
  category: ResourceCategory;
  label: string;
  code: string | null;
  type: string;
  status: string;
  location: {
    lat: number | null;
    lon: number | null;
    label: string;
  };
  contact: string | null;
  base: string | null;
  notes: string | null;
  payload: JsonValue;
  maintenance: MaintenanceRecord[];
  assignments: IncidentAssignment[];
  audits: AuditEvent[];
  raw: OperationalUnit | OperationalAsset | FireStation;
}

export interface ResourceImportPreviewRow {
  index: number;
  category: ResourceCategory;
  valid: boolean;
  errors: string[];
  data: JsonObject;
}

export interface ResourceImportPreview {
  mode: 'validateOnly' | 'commit';
  total: number;
  valid: number;
  invalid: number;
  created: number;
  rows: ResourceImportPreviewRow[];
}

export interface CommandIncident extends Fire {
  actionReason: string;
  nextAction: string;
  tacticalSummary: string;
  weatherWarning: string;
  assignment: IncidentAssignment | null;
  responseEtaMinutes?: number | null;
  recommendedResources?: string[];
}

export interface SourceHealth {
  key: FireSourceKind | DetectionLayerKind | 'scan' | 'weather' | 'firms-polar';
  label: string;
  latestAt?: string;
  ageMinutes?: number;
  status: SourceHealthStatus;
  detail: string;
}

export interface ScanRun {
  id: string;
  triggerType: ScanTriggerType;
  triggeredBy: string | null;
  status: Exclude<ScanStatus, 'idle'>;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  durationMs: number | null;
  newCount: number;
  updatedCount: number;
  confirmedCount: number;
  closedCount: number;
  summary: string | null;
  error: string | null;
  createdAt: Date | string;
}

export interface ScanStatusResponse {
  latest: ScanRun | null;
  latestSuccess: ScanRun | null;
  latestFailure: ScanRun | null;
  nextClientPollAt: string;
  pollIntervalMinutes: number;
  lockTtlSeconds: number;
  status: ScanStatus;
}

export type AnalysisPeriod = '24h' | '7d' | '30d' | '90d' | 'all';
export type AnalysisRiskLevel = 'critical' | 'high' | 'moderate' | 'stable' | 'quiet';
export type AnalysisSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AnalysisHeadline {
  riskScore: number;
  riskLevel: AnalysisRiskLevel;
  dataConfidencePct: number;
  operationalDebt: number;
  topDriver: string;
}

export interface AnalysisDriver {
  id: string;
  label: string;
  detail: string;
  count: number;
  severity: AnalysisSeverity;
  score: number;
  affectedFireIds: string[];
}

export interface AnalysisTimelineBucket {
  label: string;
  detected: number;
  confirmed: number;
  falsePositive: number;
  avgRiskScore: number;
  maxFrp: number;
}

export interface AnalysisZone {
  label: string;
  count: number;
  confirmed: number;
  avgRiskScore: number;
  maxFrp: number;
  missingWeather: number;
  dominantSource: string;
}

export interface AnalysisSourceMatrixRow {
  key: SourceHealth['key'];
  label: string;
  status: SourceHealthStatus;
  latestAt?: string;
  ageMinutes?: number;
  detections: number;
  confirmsFire: boolean;
}

export interface AnalysisWeatherSummary {
  level: CommandDashboardResponse['weatherRisk']['level'];
  coveragePct: number;
  missingWeather: number;
  highWindCount: number;
  hotDryWindCount: number;
  maxWindKmh: number | null;
  withoutWeatherFireIds: string[];
}

export interface AnalysisResourceSummary {
  unitsTotal: number;
  unitsAvailable: number;
  unitsAssigned: number;
  unitsUnavailable: number;
  unitsMaintenance: number;
  noUnitCatalog: boolean;
  maintenanceOpen: number;
  maintenanceOverdue: number;
  maintenanceDueSoon: number;
  assetsTotal: number;
  waterSources: number;
  stations: number;
  helipads: number;
  missingWaterSources: boolean;
  missingStations: boolean;
  missingHelipads: boolean;
  noAssetCatalog: boolean;
}

export interface AnalysisIncident {
  id: string;
  lat: number;
  lon: number;
  detectedAt: Date | string;
  status: FireStatus;
  priority: IncidentPriority;
  actionReason: string;
  nextAction: string;
  tacticalSummary: string;
  riskScore: number;
  maxFrp: number;
  detections: number;
  missingWeather: boolean;
  assignedUnit: string | null;
}

export interface AnalysisDashboardResponse {
  generatedAt: string;
  period: AnalysisPeriod;
  headline: AnalysisHeadline;
  drivers: AnalysisDriver[];
  timeline: AnalysisTimelineBucket[];
  zones: AnalysisZone[];
  sourceMatrix: AnalysisSourceMatrixRow[];
  weather: AnalysisWeatherSummary;
  resources: AnalysisResourceSummary;
  incidents: AnalysisIncident[];
}

export interface CommandDashboardResponse {
  generatedAt: string;
  actionQueue: CommandIncident[];
  activeFires: Fire[];
  sourceHealth: SourceHealth[];
  weatherRisk: {
    level: 'critical' | 'high' | 'moderate' | 'stable' | 'missing';
    coveragePct: number;
    missingWeather: number;
    highWindCount: number;
    hotDryWindCount: number;
    maxWindKmh: number | null;
  };
  unitStatus: {
    total: number;
    available: number;
    assigned: number;
    unavailable: number;
    maintenance: number;
    noCatalog: boolean;
  };
  maintenanceStatus: {
    totalOpen: number;
    overdue: number;
    dueSoon: number;
    inProgress: number;
  };
  assetCoverage: {
    total: number;
    byType: Record<string, number>;
    missingWaterSources: boolean;
    missingStations: boolean;
    missingHelipads: boolean;
    noCatalog: boolean;
  };
  overview: ProvincialOverview;
  stations: FireStation[];
  units: OperationalUnit[];
  assets: OperationalAsset[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FireListResponse = PaginatedResponse<Fire>;

export interface ProvincialOverview {
  generatedAt: string;
  totals: {
    active: number;
    closed: number;
    archived: number;
    test: number;
    last24h: number;
    confirmedOrProbable: number;
    unreviewedConfirmedOrProbable: number;
    missingWeather: number;
    falsePositiveRate: number;
    avgReviewMinutes: number;
    avgDispatchMinutes: number;
  };
  byPriority: Record<IncidentPriority, number>;
  byStatus: Record<FireStatus, number>;
  freshness: DataFreshness;
  topZones: Array<{
    label: string;
    count: number;
  }>;
  recent: Fire[];
}

export interface FireContextResponse {
  fireId: string;
  weather: WeatherSnapshot;
  terrain: TerrainSnapshot;
  projection: ProjectionSnapshot;
  operations: OperationalContextSnapshot;
  layers: {
    available: string[];
    planned: string[];
  };
}

// FIRMS types
export interface FirmsPoint {
  latitude: number;
  longitude: number;
  brightness: number;
  bright_ti4?: number;
  bright_ti5?: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  instrument?: string;
  confidence: 'low' | 'nominal' | 'high';
  confidenceRaw?: string;
  version: string;
  bright_t31: number;
  frp: number;
  daynight: 'D' | 'N';
  sourceProduct?: string;
  sourceLayer?: DetectionLayerKind;
  sourceFamily?: 'polar' | 'geostationary';
}

export interface FirmsGeoJSON {
  type: 'FeatureCollection';
  features: FirmsFeature[];
}

export interface FirmsFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: FirmsPoint;
}

// GOES types
export interface GoesHotspot {
  lat: number;
  lon: number;
  heat: number;
  ts: string;
  satellite: string;
  layer?: DetectionLayerKind;
  sourceProduct?: string;
  confidence?: number;
  frp?: number;
  maskCode?: number;
  areaM2?: number;
}

export interface LightningFlash {
  lat: number;
  lon: number;
  ts: string;
  satellite: string;
  energyJ?: number;
  areaM2?: number;
}

export interface EarthquakeEvent {
  id: string;
  lat: number;
  lon: number;
  magnitude: number | null;
  depthKm: number | null;
  place: string;
  occurredAt: string;
  updatedAt?: string;
  source: 'USGS';
  detailUrl?: string;
}

export interface EarthquakeFeedResponse {
  generatedAt: string;
  source: string;
  scope: string;
  lookbackHours: number;
  events: EarthquakeEvent[];
}

export interface ThermalAnomaly {
  id: string;
  lat: number;
  lon: number;
  ts: string;
  source: FireSourceKind;
  layer: DetectionLayerKind;
  satellite: string;
  sourceProduct?: string;
  temperatureK?: number;
  brightnessK?: number;
  frp?: number;
  confidence?: FireConfidence;
  intensity: number;
}

export interface Sentinel3FrpHotspot {
  id: string;
  lat: number;
  lon: number;
  ts: string;
  satellite: string;
  frp?: number;
  confidence?: FireConfidence;
  sourceProduct?: string;
}

export interface HlsScene {
  id: string;
  provider: string;
  platform?: string;
  instrument?: string;
  collection: 'HLSS30' | 'HLSL30';
  startTime: string;
  cloudCoverPct?: number;
  browseUrl?: string;
  downloadUrl?: string;
}

// Detection types
export interface DetectionResult {
  scannedAt?: string;
  new: number;
  updated: number;
  confirmed: number;
  closed?: number;
  fires: Fire[];
  summary: string;
}

// Map types
export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

// Filter types
export interface FireFilters {
  status?: FireStatus[];
  lifecycle?: LifecycleFilter;
  timeframe?: '30m' | '1h' | '3h' | '24h' | 'all';
  period?: '24h' | '7d' | '30d' | '90d' | 'all';
  minConfidence?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

// Form types
export interface AddFireForm {
  lat: number;
  lon: number;
  detectedAt: Date;
  notes?: string;
  reportedBy?: string;
}

export interface ConfirmFireForm {
  confirmed: boolean;
  actor: string;
  reason?: string;
}

export interface OperatorSession {
  id: string;
}

export interface CommandAlert {
  id: string;
  fireId: string;
  title: string;
  detail: string;
  kind: 'new' | 'updated' | 'confirmed' | 'critical';
  createdAt: string;
  priority: IncidentPriority;
}
