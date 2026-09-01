'use client';

import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CloudRain,
  Compass,
  ExternalLink,
  Flame,
  Map as MapIcon,
  PieChart,
  Search,
  ShieldAlert,
  Truck,
  Wrench,
} from 'lucide-react';
import { IncidentPriorityBadge } from '@/components/Command/IncidentPriorityBadge';
import { MapView } from '@/components/Map/MapView';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JURISDICTION_NAME } from '@/lib/constants';
import {
  derivePriority,
  getDetectionCount,
  getLifecycleStatusLabel,
  getMaxFrp,
  getOperationalStatusLabel,
  getPrimarySourceLabel,
  getPriorityLabel,
  getStatusLabel,
} from '@/lib/fire-utils';
import { SMN_RADAR_URL } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import type { CommandDashboardResponse, CommandIncident, Fire, FireStation, FireStatus, IncidentPriority, OperationalAsset, OperationalUnit } from '@/types';

type Tone = 'default' | 'warning' | 'danger' | 'success';
type ChartRow = { label: string; value: number; detail?: string; tone?: Tone };

export function DashboardDataBanner({
  command,
  error,
  isError,
  isLoading,
}: {
  command?: CommandDashboardResponse;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isError) {
    return (
      <div className="command-data-banner command-data-banner--error">
        <AlertTriangle size={17} />
        <span>No se pudo leer el comando real: {getDashboardErrorMessage(error)}</span>
      </div>
    );
  }

  if (!isLoading && command) return null;

  return (
    <div className="command-data-banner">
      <Activity size={17} />
      <span>Leyendo datos reales de la base...</span>
    </div>
  );
}

export function CommandOverview({ command, isLoading }: { command?: CommandDashboardResponse; isLoading: boolean }) {
  const totals = command?.overview.totals;
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <KpiCard
        icon={<Flame size={18} />}
        label="Focos activos"
        value={isLoading ? '...' : totals?.active ?? 0}
        detail={`${totals?.confirmedOrProbable ?? 0} confirmados/probables`}
        tone={(totals?.active || 0) > 0 ? 'danger' : 'success'}
      />
      <KpiCard
        icon={<Truck size={18} />}
        label="Unidades disponibles"
        value={isLoading ? '...' : command?.unitStatus.noCatalog ? 's/d' : command?.unitStatus.available ?? 0}
        detail={command?.unitStatus.noCatalog ? 'catalogo pendiente' : `${command?.unitStatus.assigned ?? 0} asignadas / ${command?.unitStatus.total ?? 0} registradas`}
        tone={command?.unitStatus.noCatalog ? 'warning' : 'success'}
      />
      <KpiCard
        icon={<Wrench size={18} />}
        label="Mantenimiento"
        value={isLoading ? '...' : command?.maintenanceStatus.totalOpen ?? 0}
        detail={`${command?.maintenanceStatus.overdue ?? 0} vencidos / ${command?.unitStatus.maintenance ?? 0} moviles en taller`}
        tone={(command?.unitStatus.maintenance || command?.maintenanceStatus.overdue || 0) > 0 ? 'warning' : 'success'}
      />
    </section>
  );
}

export function MapCommandCenter({
  fires,
  selectedFireId,
  onSelect,
  units,
  stations,
  assets,
}: {
  fires: Fire[];
  selectedFireId: string | null;
  onSelect: (fireId: string) => void;
  units: OperationalUnit[];
  stations: FireStation[];
  assets: OperationalAsset[];
}) {
  return (
    <section className="min-w-0 overflow-hidden">
      <Card className="command-map-surface h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MapIcon size={17} />
            Mapa táctico
          </CardTitle>
          <CardDescription>Focos activos, tormentas, límite territorial y recursos operativos.</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Badge variant="outline" className="hidden w-fit sm:inline-flex">
              <Compass size={15} />
              {JURISDICTION_NAME}
            </Badge>
            <a
              href={SMN_RADAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir el radar oficial del SMN en una nueva pestaña"
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-950 transition-colors hover:border-sky-300 hover:bg-sky-100"
            >
              <CloudRain size={15} />
              Radar oficial
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <div className="command-map-canvas">
            <MapView
              fires={fires}
              selectedFireId={selectedFireId}
              onFireSelect={onSelect}
              chrome="minimal"
              markerMode="live"
              operationalUnits={units}
              stations={stations}
              operationalAssets={assets}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function DecisionQueue({
  fires,
  total,
  isLoading,
  selectedFireId,
  search,
  onSearchChange,
  onSelect,
}: {
  fires: CommandIncident[];
  total: number;
  isLoading: boolean;
  selectedFireId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (fireId: string) => void;
}) {
  return (
    <Card className="command-queue-surface min-h-[560px]">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Incidentes operativos</CardTitle>
            <CardDescription>{total} incidentes requieren lectura y posible despacho.</CardDescription>
          </div>
          <Badge variant="outline">{fires.length}</Badge>
        </div>
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-8"
            placeholder="Buscar foco, unidad o motivo"
          />
        </label>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <QueueEmpty icon={<Activity size={20} />} title="Cargando cola" detail="Leyendo incidentes activos y contexto operativo." />
        ) : fires.length === 0 ? (
          <QueueEmpty icon={<ShieldAlert size={20} />} title="Sin decisiones urgentes" detail="No hay incidentes activos filtrados para atender ahora." />
        ) : (
          <div className="command-queue-list">
            {fires.map((fire) => (
              <QueueItem key={fire.id} fire={fire} selected={selectedFireId === fire.id} onSelect={() => onSelect(fire.id)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FireHistoryPanel({
  command,
  isLoading,
  onSelect,
}: {
  command?: CommandDashboardResponse;
  isLoading: boolean;
  onSelect: (fireId: string) => void;
}) {
  const fires = command?.overview.recent || [];

  return (
    <Panel title="Historial general" subtitle="Ultimos registros reales de la base, incluyendo activos, cerrados y archivados.">
      {isLoading ? (
        <div className="command-panel-empty">Leyendo historial...</div>
      ) : fires.length === 0 ? (
        <QueueEmpty icon={<Activity size={20} />} title="Sin historial" detail="No hay registros historicos para mostrar." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Ubicacion</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead>FRP / det.</TableHead>
              <TableHead>Ciclo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {fires.map((fire) => (
            <TableRow
              key={fire.id}
              className="cursor-pointer"
              onClick={() => onSelect(fire.id)}
            >
              <TableCell>
                <div className="font-medium">{formatHistoryDate(fire.detectedAt)}</div>
                <div className="text-xs text-muted-foreground">{formatRelativeTime(fire.detectedAt)}</div>
              </TableCell>
              <TableCell>{getStatusLabel(fire.status)}</TableCell>
              <TableCell>{getPriorityLabel(fire.priority || derivePriority(fire))}</TableCell>
              <TableCell>
                {fire.lat.toFixed(3)}, {fire.lon.toFixed(3)}
              </TableCell>
              <TableCell>{getFireSourceLabel(fire)}</TableCell>
              <TableCell>
                <div className="font-medium">{getMaxFrp(fire) > 0 ? `${getMaxFrp(fire).toFixed(1)} MW` : 's/d'}</div>
                <div className="text-xs text-muted-foreground">{getDetectionCount(fire)} det.</div>
              </TableCell>
              <TableCell>{getLifecycleStatusLabel(fire.lifecycleStatus)}</TableCell>
            </TableRow>
          ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

export function ChartsDashboard({ command, isLoading }: { command?: CommandDashboardResponse; isLoading: boolean }) {
  const overview = command?.overview;
  const staleSources = command?.sourceHealth.filter((source) => source.status === 'stale' || source.status === 'missing').length ?? 0;
  const statusBars = buildStatusBars(overview?.byStatus);
  const priorityBars = buildPriorityBars(overview?.byPriority);
  const zoneBars = (overview?.topZones || []).map((zone) => ({
    label: zone.label,
    value: zone.count,
    detail: formatFireCount(zone.count),
    tone: 'default' as Tone,
  }));
  const trend = buildRecentTrend(overview?.recent || []);
  const analysisMetrics = [
    {
      label: 'Revision media',
      value: formatMinutes(overview?.totals.avgReviewMinutes),
      detail: 'deteccion a revision',
    },
    {
      label: 'Despacho medio',
      value: formatMinutes(overview?.totals.avgDispatchMinutes),
      detail: 'deteccion a despacho',
    },
    {
      label: 'Calidad de datos',
      value: staleSources,
      detail: `${command?.weatherRisk.missingWeather ?? 0} sin clima / ${formatPercent(overview?.totals.falsePositiveRate)} falsos`,
    },
  ];

  return (
    <Panel title="Analisis operativo" subtitle="Sistema de lectura: estado, prioridad, zonas, tendencia y salud de datos reales." className="command-card--charts">
      {isLoading ? (
        <div className="command-panel-empty">Calculando analisis...</div>
      ) : (
        <div className="command-analysis-system">
          <div className="command-analysis-strip" aria-label="Indicadores del sistema de analisis">
            {analysisMetrics.map((metric) => (
              <AnalysisMetric key={metric.label} {...metric} />
            ))}
          </div>

          <Tabs defaultValue="operativo" className="gap-4">
            <TabsList variant="line">
              <TabsTrigger value="operativo">Operativo</TabsTrigger>
              <TabsTrigger value="fuentes">Fuentes</TabsTrigger>
              <TabsTrigger value="meteo">Meteo</TabsTrigger>
            </TabsList>
            <TabsContent value="operativo">
              <div className="command-charts-dashboard">
                <div className="command-chart-section">
                  <ChartTitle icon={<PieChart size={15} />} title="Ciclo operativo" detail="Estado real de cada registro dentro del flujo de guardia." />
                  <ChartBars rows={statusBars} />
                </div>

                <div className="command-chart-section">
                  <ChartTitle icon={<ShieldAlert size={15} />} title="Prioridad calculada" detail="Urgencia derivada de evidencia, meteo y ciclo operativo." />
                  <ChartBars rows={priorityBars} />
                </div>

                <div className="command-chart-section">
                  <ChartTitle icon={<MapIcon size={15} />} title="Zonas calientes" detail="Sectores con más detecciones reales acumuladas." />
                  <ChartBars rows={zoneBars} emptyLabel="Sin zonas calculadas" />
                </div>

                <div className="command-chart-section">
                  <ChartTitle icon={<BarChart3 size={15} />} title="Tendencia reciente" detail="Ultimos dias del historial y cantidad detectada." />
                  <TrendBars rows={trend} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="fuentes">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(command?.sourceHealth || []).map((source) => (
                    <TableRow key={source.key}>
                      <TableCell className="font-medium">{source.label}</TableCell>
                      <TableCell><Badge variant={source.status === 'fresh' ? 'secondary' : source.status === 'stale' ? 'outline' : 'destructive'}>{source.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{source.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="meteo">
              <div className="grid gap-3 md:grid-cols-4">
                <Card size="sm"><CardContent><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Riesgo</p><p className="mt-2 text-2xl font-semibold">{getWeatherLevelLabel(command?.weatherRisk.level || 'missing')}</p></CardContent></Card>
                <Card size="sm"><CardContent><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Cobertura</p><p className="mt-2 text-2xl font-semibold">{command?.weatherRisk.coveragePct ?? 0}%</p></CardContent></Card>
                <Card size="sm"><CardContent><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Sin clima</p><p className="mt-2 text-2xl font-semibold">{command?.weatherRisk.missingWeather ?? 0}</p></CardContent></Card>
                <Card size="sm"><CardContent><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Viento max.</p><p className="mt-2 text-2xl font-semibold">{formatWind(command?.weatherRisk.maxWindKmh)}</p></CardContent></Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Panel>
  );
}

function QueueItem({ fire, selected, onSelect }: { fire: CommandIncident; selected: boolean; onSelect: () => void }) {
  const assignment = fire.assignment?.unit?.name || fire.assignment?.unitName || fire.assignedUnit || 'Sin unidad';
  const maxFrp = getMaxFrp(fire);

  return (
    <button onClick={onSelect} className={`command-queue-item${selected ? ' command-queue-item--selected' : ''}`}>
      <div className="command-queue-item__top">
        <div>
          <strong>
            {fire.lat.toFixed(3)}, {fire.lon.toFixed(3)}
          </strong>
          <span>
            {getStatusLabel(fire.status)} / {getOperationalStatusLabel(fire.operationalStatus || 'unreviewed')}
          </span>
        </div>
        <IncidentPriorityBadge priority={fire.priority || 'low'} compact />
      </div>

      <div className={getActionReasonClass(fire.actionReason)}>{fire.actionReason}</div>

      <div className="command-queue-facts">
        <QueueFact label="Antig." value={formatRelativeTime(fire.detectedAt)} />
        <QueueFact label="FRP" value={maxFrp > 0 ? `${maxFrp.toFixed(1)} MW` : 's/d'} />
        <QueueFact label="Det." value={`${getDetectionCount(fire)}`} />
        <QueueFact label="Unidad" value={assignment} />
      </div>

      <div className="command-next-action">{fire.nextAction}</div>
    </button>
  );
}

function Panel({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`command-card-modern ${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}) {
  return (
    <Card className={`command-kpi-modern command-kpi-modern--${tone}`}>
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="command-kpi-value mt-3 text-3xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="command-kpi-icon rounded-lg p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}

function AnalysisMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="command-analysis-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function QueueFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="command-queue-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QueueEmpty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <Empty className="min-h-72">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ChartTitle({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="command-chart-title">
      <h3>
        {icon}
        {title}
      </h3>
      <p>{detail}</p>
    </div>
  );
}

function ChartBars({ rows, emptyLabel = 'Sin datos' }: { rows: ChartRow[]; emptyLabel?: string }) {
  const total = Math.max(1, ...rows.map((row) => row.value));
  const visibleRows = rows.filter((row) => row.value > 0);

  if (visibleRows.length === 0) {
    return <div className="command-chart-empty">{emptyLabel}</div>;
  }

  return (
    <div className="command-chart-bars">
      {visibleRows.map((row) => (
        <div key={row.label} className={`command-chart-bar command-chart-bar--${row.tone || 'default'}`}>
          <div>
            <span>{row.label}</span>
            <strong>{row.detail || formatFireCount(row.value)}</strong>
          </div>
          <i>
            <b style={{ width: `${Math.max(4, Math.round((row.value / total) * 100))}%` }} />
          </i>
        </div>
      ))}
    </div>
  );
}

function TrendBars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return <div className="command-chart-empty">Sin registros recientes</div>;
  }

  return (
    <div className="command-trend-bars">
      {rows.map((row) => (
        <div key={row.label}>
          <i style={{ height: `${Math.max(10, Math.round((row.value / max) * 90))}%` }} />
          <strong>{formatFireCount(row.value)}</strong>
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function buildStatusBars(byStatus?: Record<FireStatus, number>): ChartRow[] {
  return [
    { label: 'Sin confirmar', value: byStatus?.unconfirmed ?? 0, detail: formatFireCount(byStatus?.unconfirmed ?? 0), tone: 'warning' },
    { label: 'Probable', value: byStatus?.probable ?? 0, detail: formatFireCount(byStatus?.probable ?? 0), tone: 'warning' },
    { label: 'Confirmado', value: byStatus?.confirmed ?? 0, detail: formatFireCount(byStatus?.confirmed ?? 0), tone: 'danger' },
    { label: 'Extinguido', value: byStatus?.extinguished ?? 0, detail: formatFireCount(byStatus?.extinguished ?? 0), tone: 'success' },
    { label: 'Falso positivo', value: byStatus?.false_positive ?? 0, detail: formatFireCount(byStatus?.false_positive ?? 0), tone: 'default' },
  ];
}

function buildPriorityBars(byPriority?: Record<IncidentPriority, number>): ChartRow[] {
  return [
    { label: 'Critica', value: byPriority?.critical ?? 0, detail: formatFireCount(byPriority?.critical ?? 0), tone: 'danger' },
    { label: 'Alta', value: byPriority?.high ?? 0, detail: formatFireCount(byPriority?.high ?? 0), tone: 'warning' },
    { label: 'Media', value: byPriority?.medium ?? 0, detail: formatFireCount(byPriority?.medium ?? 0), tone: 'warning' },
    { label: 'Baja', value: byPriority?.low ?? 0, detail: formatFireCount(byPriority?.low ?? 0), tone: 'success' },
  ];
}

function buildRecentTrend(fires: Fire[]) {
  const buckets = new Map<string, { label: string; value: number; time: number }>();

  for (const fire of fires) {
    const date = new Date(fire.detectedAt);
    if (!Number.isFinite(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    const current = buckets.get(key);
    buckets.set(key, { label, value: (current?.value || 0) + 1, time: date.getTime() });
  }

  return [...buckets.values()]
    .sort((left, right) => left.time - right.time)
    .slice(-8)
    .map(({ label, value }) => ({ label, value }));
}

function getFireSourceLabel(fire: Fire) {
  const primary = fire.sources?.[0];
  if (primary?.layer === 'firms-goes-nrt') return 'FIRMS GOES';
  if (primary?.layer === 'goes-fdcf') return 'GOES-19';
  if (primary?.layer === 'viirs-noaa21') return 'VIIRS NOAA-21';
  if (primary?.layer === 'viirs-noaa20') return 'VIIRS NOAA-20';
  if (primary?.layer === 'viirs-snpp') return 'VIIRS S-NPP';
  if (primary?.layer === 'modis') return 'MODIS';
  if (primary?.layer === 'sentinel3-slstr') return 'Sentinel-3';
  if (primary?.layer === 'thermal-anomaly') return 'Termica';
  const source = primary?.source;
  if (source === 'GOES') return 'GOES';
  if (source === 'FIRMS') return 'FIRMS';
  if (source === 'SENTINEL3') return 'Sentinel-3';
  if (source === 'HLS') return 'HLS';
  if (source === 'THERMAL') return 'Termica';
  if (source === 'MANUAL') return 'Manual';
  return getPrimarySourceLabel(fire.confirmedBy);
}

function formatHistoryDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 's/d';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFireCount(value: number) {
  return `${value} ${value === 1 ? 'fuego' : 'fuegos'}`;
}

function formatMinutes(value?: number) {
  if (!value || value <= 0) return 's/d';
  if (value < 60) return `${Math.round(value)} min`;
  const hours = value / 60;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)} h`;
}

function formatPercent(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 's/d';
  return `${Math.round(value)}%`;
}

function formatWind(value?: number | null) {
  return typeof value === 'number' ? `${Math.round(value)} km/h` : 's/d';
}

function getDashboardErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'error desconocido';
}

function getActionReasonClass(reason: string) {
  if (reason === 'meteo critica' || reason === 'sin unidad') return 'command-action-reason command-action-reason--danger';
  if (reason === 'sin revisar' || reason === 'fuente atrasada' || reason === 'sin clima tactico') return 'command-action-reason command-action-reason--warning';
  return 'command-action-reason';
}

function getWeatherLevelLabel(level: string) {
  switch (level) {
    case 'critical':
      return 'Critico';
    case 'high':
      return 'Alto';
    case 'moderate':
      return 'Moderado';
    case 'stable':
      return 'Estable';
    default:
      return 'Sin datos';
  }
}
