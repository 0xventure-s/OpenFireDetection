'use client';

import { useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  CloudSun,
  Database,
  Flame,
  Gauge,
  Layers3,
  MapPinned,
  RadioTower,
  ShieldAlert,
  Target,
  Truck,
  Wrench,
  Wind,
  Zap,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAnalysisDashboard } from '@/hooks/useFires';
import { formatRelativeTime } from '@/lib/utils';
import type {
  AnalysisDashboardResponse,
  AnalysisIncident,
  AnalysisPeriod,
  AnalysisRiskLevel,
  AnalysisSeverity,
  AnalysisSourceMatrixRow,
  AnalysisZone,
  SourceHealthStatus,
} from '@/types';

const periods: AnalysisPeriod[] = ['24h', '7d', '30d', '90d', 'all'];

const timelineConfig = {
  detected: {
    label: 'Detectados',
    color: 'var(--warning-orange)',
  },
  confirmed: {
    label: 'Confirmados',
    color: 'var(--fire-red)',
  },
  falsePositive: {
    label: 'Falsos positivos',
    color: 'var(--muted-foreground)',
  },
  maxFrp: {
    label: 'FRP max.',
    color: 'var(--info-cyan)',
  },
} satisfies ChartConfig;

export function AnalysisCenter({ onSelectIncident }: { onSelectIncident: (fireId: string) => void }) {
  const [period, setPeriod] = useState<AnalysisPeriod>('30d');
  const { data, error, isError, isLoading } = useAnalysisDashboard(period);

  return (
    <div className="grid gap-4">
      <AnalysisPageHeader period={period} onPeriodChange={setPeriod} data={data} />
      <AnalysisStateBanner isLoading={isLoading} isError={isError} error={error} />

      {isLoading ? (
        <AnalysisLoading />
      ) : !data ? (
        <AnalysisEmpty />
      ) : (
        <>
          <HeadlineGrid data={data} />

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <DriversPanel data={data} onSelectIncident={onSelectIncident} />
            <IncidentPressurePanel incidents={data.incidents} onSelectIncident={onSelectIncident} />
          </section>

          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <TimelinePanel data={data} />
            <ZonesPanel zones={data.zones} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <SourceMatrixPanel rows={data.sourceMatrix} />
            <ReadinessPanel data={data} />
          </section>
        </>
      )}
    </div>
  );
}

function AnalysisPageHeader({
  period,
  onPeriodChange,
  data,
}: {
  period: AnalysisPeriod;
  onPeriodChange: (period: AnalysisPeriod) => void;
  data?: AnalysisDashboardResponse;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/80 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="w-fit">
            <RadioTower className="size-3.5" />
            Inteligencia tactica
          </Badge>
          {data ? <Badge variant={data.headline.riskLevel === 'critical' ? 'destructive' : 'secondary'}>{getRiskLevelLabel(data.headline.riskLevel)}</Badge> : null}
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Centro tactico de analisis</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Riesgo territorial, salud satelital, deuda de guardia y zonas calientes sobre datos reales.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {periods.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={period === item ? 'default' : 'outline'}
            onClick={() => onPeriodChange(item)}
          >
            {getPeriodLabel(item)}
          </Button>
        ))}
      </div>
    </section>
  );
}

function AnalysisStateBanner({
  isLoading,
  isError,
  error,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  if (isError) {
    return (
      <div className="command-data-banner command-data-banner--error">
        <AlertTriangle size={17} />
        <span>No se pudo leer el analisis tactico: {getErrorMessage(error)}</span>
      </div>
    );
  }

  if (!isLoading) return null;

  return (
    <div className="command-data-banner">
      <Activity size={17} />
      <span>Calculando analisis tactico real...</span>
    </div>
  );
}

function AnalysisLoading() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {['Riesgo', 'Confianza', 'Deuda', 'Fuentes'].map((label) => (
        <Card key={label}>
          <CardContent className="p-5">
            <div className="mb-4 h-3 w-28 rounded bg-muted" />
            <div className="h-8 w-20 rounded bg-muted" />
            <div className="mt-4 h-2 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function AnalysisEmpty() {
  return (
    <Card>
      <CardContent>
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Database />
            </EmptyMedia>
            <EmptyTitle>Sin analisis disponible</EmptyTitle>
            <EmptyDescription>No hay datos suficientes para construir la consola tactica.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}

function HeadlineGrid({ data }: { data: AnalysisDashboardResponse }) {
  const staleSources = data.sourceMatrix.filter((row) => row.status !== 'fresh').length;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={<Gauge size={18} />}
        label="Riesgo territorial"
        value={`${data.headline.riskScore}/100`}
        detail={data.headline.topDriver}
        tone={data.headline.riskLevel === 'critical' || data.headline.riskLevel === 'high' ? 'danger' : data.headline.riskLevel === 'moderate' ? 'warning' : 'success'}
      />
      <MetricCard
        icon={<Database size={18} />}
        label="Confianza de datos"
        value={`${data.headline.dataConfidencePct}%`}
        detail={`${staleSources} fuentes no frescas`}
        tone={data.headline.dataConfidencePct < 55 ? 'danger' : data.headline.dataConfidencePct < 80 ? 'warning' : 'success'}
      />
      <MetricCard
        icon={<ShieldAlert size={18} />}
        label="Deuda operativa"
        value={data.headline.operationalDebt}
        detail="sin revisar, sin unidad o sin clima"
        tone={data.headline.operationalDebt > 3 ? 'danger' : data.headline.operationalDebt > 0 ? 'warning' : 'success'}
      />
      <MetricCard
        icon={<Wind size={18} />}
        label="Meteo activa"
        value={getWeatherLevelLabel(data.weather.level)}
        detail={`${formatWind(data.weather.maxWindKmh)} max / ${data.weather.coveragePct}% cobertura`}
        tone={data.weather.level === 'critical' || data.weather.level === 'high' ? 'danger' : data.weather.level === 'moderate' ? 'warning' : 'success'}
      />
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: 'danger' | 'warning' | 'success';
}) {
  return (
    <Card className={`command-kpi-modern command-kpi-modern--${tone}`}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="command-kpi-value mt-3 text-3xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="command-kpi-icon rounded-lg p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}

function DriversPanel({
  data,
  onSelectIncident,
}: {
  data: AnalysisDashboardResponse;
  onSelectIncident: (fireId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Zap size={17} />
          Ahora
        </CardTitle>
        <CardDescription>Factores que estan moviendo el score tactico.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {data.drivers.length === 0 ? (
          <CompactEmpty icon={<CheckCircle2 size={18} />} title="Sin drivers criticos" detail="La consola no detecta presion operativa relevante." />
        ) : (
          data.drivers.map((driver) => (
            <button
              key={driver.id}
              type="button"
              className="group grid min-w-0 gap-2 rounded-lg border bg-background/60 p-3 text-left transition hover:border-primary/40 hover:bg-accent/40"
              onClick={() => {
                const target = driver.affectedFireIds[0];
                if (target) onSelectIncident(target);
              }}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityDot severity={driver.severity} />
                    <span className="truncate text-sm font-semibold">{driver.label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{driver.detail}</p>
                </div>
                <Badge variant={getSeverityBadgeVariant(driver.severity)}>{driver.count}</Badge>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className={getSeverityBarClass(driver.severity)} style={{ width: `${Math.min(100, Math.max(8, driver.score))}%` }} />
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function IncidentPressurePanel({
  incidents,
  onSelectIncident,
}: {
  incidents: AnalysisIncident[];
  onSelectIncident: (fireId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Target size={17} />
          Focos que explican el riesgo
        </CardTitle>
        <CardDescription>{incidents.length} incidentes priorizados por la cola operativa.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {incidents.length === 0 ? (
          <div className="p-4">
            <CompactEmpty icon={<CheckCircle2 size={18} />} title="Sin presion por foco" detail="No hay incidentes activos que requieran lectura inmediata." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foco</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead>FRP / det.</TableHead>
                  <TableHead>Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id} className="cursor-pointer" onClick={() => onSelectIncident(incident.id)}>
                    <TableCell>
                      <div className="font-medium">{incident.lat.toFixed(3)}, {incident.lon.toFixed(3)}</div>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(incident.detectedAt)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{incident.actionReason}</div>
                      <div className="max-w-[28rem] truncate text-xs text-muted-foreground">{incident.nextAction}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={incident.priority === 'critical' ? 'destructive' : incident.priority === 'high' ? 'outline' : 'secondary'}>
                        {incident.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatFrp(incident.maxFrp)}</div>
                      <div className="text-xs text-muted-foreground">{incident.detections} det.</div>
                    </TableCell>
                    <TableCell>{incident.assignedUnit || 'Sin unidad'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelinePanel({ data }: { data: AnalysisDashboardResponse }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 size={17} />
          Timeline tactico
        </CardTitle>
        <CardDescription>Detectados, confirmados, falsos positivos y FRP maximo por bucket.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.timeline.length === 0 ? (
          <CompactEmpty icon={<Clock3 size={18} />} title="Sin serie temporal" detail="No hay focos en el periodo elegido." />
        ) : (
          <ChartContainer config={timelineConfig} className="h-[300px] w-full">
            <ComposedChart data={data.timeline} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis yAxisId="count" tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <YAxis yAxisId="frp" orientation="right" tickLine={false} axisLine={false} width={38} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar yAxisId="count" dataKey="detected" fill="var(--color-detected)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="count" dataKey="confirmed" fill="var(--color-confirmed)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="count" dataKey="falsePositive" fill="var(--color-falsePositive)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="frp" type="monotone" dataKey="maxFrp" stroke="var(--color-maxFrp)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ZonesPanel({ zones }: { zones: AnalysisZone[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MapPinned size={17} />
          Zonas calientes
        </CardTitle>
        <CardDescription>Ranking por riesgo medio, carga y fuente dominante.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {zones.length === 0 ? (
          <CompactEmpty icon={<MapPinned size={18} />} title="Sin zonas activas" detail="No hay sectores con detecciones en el periodo." />
        ) : (
          zones.map((zone) => (
            <div key={zone.label} className="rounded-lg border bg-background/60 p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{zone.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{zone.dominantSource} / {zone.missingWeather} sin clima</div>
                </div>
                <Badge variant={zone.avgRiskScore >= 65 ? 'destructive' : zone.avgRiskScore >= 35 ? 'outline' : 'secondary'}>
                  {zone.avgRiskScore}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <MiniFact label="Focos" value={zone.count} />
                <MiniFact label="Confirm." value={zone.confirmed} />
                <MiniFact label="FRP" value={formatFrp(zone.maxFrp)} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SourceMatrixPanel({ rows }: { rows: AnalysisSourceMatrixRow[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Layers3 size={17} />
          Matriz de fuentes
        </CardTitle>
        <CardDescription>Ultimo chequeo, detecciones y valor de confirmacion por capa.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fuente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ultimo chequeo</TableHead>
                <TableHead>Det.</TableHead>
                <TableHead>Confirma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell><SourceStatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{row.latestAt ? formatRelativeTime(row.latestAt) : 'sin dato'}</TableCell>
                  <TableCell>{row.detections}</TableCell>
                  <TableCell>{row.confirmsFire ? 'Si' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessPanel({ data }: { data: AnalysisDashboardResponse }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Truck size={17} />
          Meteo y recursos
        </CardTitle>
        <CardDescription>Condiciones que afectan respuesta y propagacion.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ReadinessRow icon={<CloudSun size={16} />} label="Cobertura clima" value={`${data.weather.coveragePct}%`} detail={`${data.weather.missingWeather} focos sin clima`} tone={data.weather.missingWeather > 0 ? 'warning' : 'success'} />
        <ReadinessRow icon={<Wind size={16} />} label="Viento maximo" value={formatWind(data.weather.maxWindKmh)} detail={`${data.weather.highWindCount} con viento alto`} tone={data.weather.highWindCount > 0 ? 'warning' : 'success'} />
        <ReadinessRow icon={<Flame size={16} />} label="Hot/dry/wind" value={data.weather.hotDryWindCount} detail="combinacion critica" tone={data.weather.hotDryWindCount > 0 ? 'danger' : 'success'} />
        <ReadinessRow icon={<Truck size={16} />} label="Unidades libres" value={data.resources.noUnitCatalog ? 's/d' : data.resources.unitsAvailable} detail={`${data.resources.unitsAssigned} asignadas / ${data.resources.unitsTotal} total`} tone={data.resources.noUnitCatalog || data.resources.unitsAvailable === 0 ? 'warning' : 'success'} />
        <ReadinessRow icon={<Wrench size={16} />} label="Mantenimiento" value={data.resources.maintenanceOpen} detail={`${data.resources.maintenanceOverdue} vencidos / ${data.resources.maintenanceDueSoon} proximos`} tone={data.resources.maintenanceOverdue > 0 ? 'danger' : data.resources.maintenanceOpen > 0 ? 'warning' : 'success'} />
        <ReadinessRow icon={<Database size={16} />} label="Activos criticos" value={data.resources.assetsTotal} detail={`${data.resources.waterSources} agua / ${data.resources.helipads} helipads`} tone={data.resources.missingWaterSources || data.resources.missingHelipads ? 'warning' : 'success'} />
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: 'danger' | 'warning' | 'success';
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border bg-background/60 p-3">
      <div className={`rounded-md p-2 ${tone === 'danger' ? 'bg-red-500/10 text-red-700' : tone === 'warning' ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
      <div className="text-right text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CompactEmpty({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/60 p-5 text-center">
      <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-card/70 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: AnalysisSeverity }) {
  return <span className={`size-2 rounded-full ${severity === 'critical' ? 'bg-red-600' : severity === 'high' ? 'bg-orange-500' : severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />;
}

function SourceStatusBadge({ status }: { status: SourceHealthStatus }) {
  return (
    <Badge variant={status === 'fresh' ? 'secondary' : status === 'stale' ? 'outline' : 'destructive'}>
      {status === 'fresh' ? 'fresco' : status === 'stale' ? 'atrasado' : 'sin dato'}
    </Badge>
  );
}

function getSeverityBadgeVariant(severity: AnalysisSeverity) {
  if (severity === 'critical') return 'destructive';
  if (severity === 'high' || severity === 'medium') return 'outline';
  return 'secondary';
}

function getSeverityBarClass(severity: AnalysisSeverity) {
  const base = 'h-full rounded-full';
  if (severity === 'critical') return `${base} bg-red-600`;
  if (severity === 'high') return `${base} bg-orange-500`;
  if (severity === 'medium') return `${base} bg-amber-500`;
  return `${base} bg-emerald-500`;
}

function getPeriodLabel(period: AnalysisPeriod) {
  if (period === '24h') return '24 h';
  if (period === '7d') return '7 d';
  if (period === '30d') return '30 d';
  if (period === '90d') return '90 d';
  return 'Todo';
}

function getRiskLevelLabel(level: AnalysisRiskLevel) {
  switch (level) {
    case 'critical':
      return 'Riesgo critico';
    case 'high':
      return 'Riesgo alto';
    case 'moderate':
      return 'Riesgo medio';
    case 'stable':
      return 'Estable';
    default:
      return 'Sin presion';
  }
}

function getWeatherLevelLabel(level: AnalysisDashboardResponse['weather']['level']) {
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

function formatWind(value?: number | null) {
  return typeof value === 'number' ? `${Math.round(value)} km/h` : 's/d';
}

function formatFrp(value: number) {
  return value > 0 ? `${value.toFixed(value >= 10 ? 0 : 1)} MW` : 's/d';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'error desconocido';
}
