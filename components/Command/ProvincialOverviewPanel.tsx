'use client';

import type { ReactNode } from 'react';
import { Activity, AlertTriangle, Clock3, Compass, Database, RadioTower, Wind } from 'lucide-react';
import { Fire, ProvincialOverview } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { getPriorityLabel } from '@/lib/fire-utils';
import { JURISDICTION_NAME } from '@/lib/constants';

interface ProvincialOverviewPanelProps {
  overview?: ProvincialOverview;
  fires: Fire[];
  isLoading?: boolean;
}

export function ProvincialOverviewPanel({ overview, fires, isLoading }: ProvincialOverviewPanelProps) {
  const totals = overview?.totals;
  const freshness = overview?.freshness;
  const activeByPriority = overview?.byPriority;
  const oldestActive = fires
    .filter((fire) => fire.lifecycleStatus === 'active')
    .sort((left, right) => new Date(left.detectedAt).getTime() - new Date(right.detectedAt).getTime())[0];

  return (
    <section className="min-h-[14rem] border-t border-slate-800 bg-[#050b16]">
      <div className="grid h-full grid-cols-1 gap-px bg-slate-800/70 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="bg-[#050b16] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Vista territorial</h2>
              <p className="mt-1 text-xs text-slate-500">Métricas operativas de {JURISDICTION_NAME}, sin incluir archivados ni pruebas.</p>
            </div>
            <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400">
              {isLoading ? 'Actualizando' : overview ? formatRelativeTime(overview.generatedAt) : 'Sin datos'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric icon={<Activity size={16} />} label="Activos" value={totals?.active ?? 0} />
            <Metric icon={<AlertTriangle size={16} />} label="Sin revisar" value={totals?.unreviewedConfirmedOrProbable ?? 0} tone="warning" />
            <Metric icon={<Clock3 size={16} />} label="Nuevos 24h" value={totals?.last24h ?? 0} />
            <Metric icon={<Wind size={16} />} label="Sin clima" value={totals?.missingWeather ?? 0} tone="muted" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400 md:grid-cols-4">
            <InlineStat label="Rev. prom." value={`${Math.round(totals?.avgReviewMinutes ?? 0)} min`} />
            <InlineStat label="Desp. prom." value={`${Math.round(totals?.avgDispatchMinutes ?? 0)} min`} />
            <InlineStat label="Falsos +" value={`${(totals?.falsePositiveRate ?? 0).toFixed(1)}%`} />
            <InlineStat label="Más antiguo" value={oldestActive ? formatRelativeTime(oldestActive.detectedAt) : 'sin activos'} />
          </div>
        </div>

        <div className="bg-[#050b16] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <RadioTower size={16} className="text-cyan-400" />
            Prioridad y zonas
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(['critical', 'high', 'medium', 'low'] as const).map((priority) => (
              <InlineStat
                key={priority}
                label={getPriorityLabel(priority)}
                value={String(activeByPriority?.[priority] ?? 0)}
              />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {(overview?.topZones || []).slice(0, 3).map((zone) => (
              <div key={zone.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{zone.label}</span>
                <span className="font-semibold text-slate-100">{zone.count}</span>
              </div>
            ))}
            {!overview?.topZones?.length ? <div className="text-xs text-slate-500">Sin zonas recurrentes activas.</div> : null}
          </div>
        </div>

        <div className="bg-[#050b16] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Database size={16} className="text-emerald-400" />
            Frescura de datos
          </h3>
          <div className="space-y-2">
            <Freshness label="GOES directo" value={freshness?.goesFdcf || freshness?.goes} />
            <Freshness label="GOES FIRMS" value={freshness?.firmsGeo} />
            <Freshness label="VIIRS" value={freshness?.viirs || freshness?.firmsPolar || freshness?.firms} />
            <Freshness label="MODIS" value={freshness?.modis} />
            <Freshness label="Sentinel-3" value={freshness?.sentinel3} />
            <Freshness label="Termica" value={freshness?.thermal || freshness?.goes || freshness?.firms} />
            <Freshness label="Manual" value={freshness?.manual} />
            <Freshness label="Último cambio" value={freshness?.lastScan} />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-slate-800 px-3 py-2 text-xs text-slate-500">
            <Compass size={14} className="mt-0.5 flex-shrink-0" />
            <span>Capas activas: GOES, FIRMS geo, VIIRS, MODIS, termica, HLS, Sentinel-3 y rayos GLM.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: 'default' | 'warning' | 'muted';
}) {
  const toneClass = tone === 'warning' ? 'text-orange-300' : tone === 'muted' ? 'text-slate-300' : 'text-slate-50';
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-slate-500">
        <span className="text-[11px] uppercase tracking-[0.12em]">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function Freshness({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={value ? 'text-slate-200' : 'text-slate-600'}>
        {value ? formatRelativeTime(value) : 'sin dato'}
      </span>
    </div>
  );
}
