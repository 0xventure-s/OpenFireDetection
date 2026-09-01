'use client';

import { AlertOctagon, CloudSun, MapPinned } from 'lucide-react';
import { Fire, FireContextResponse, OperationalContextSnapshot } from '@/types';
import { deriveWeatherRiskScore, getPriorityColor, getPriorityLabel } from '@/lib/fire-utils';

interface RiskPanelProps {
  fire: Fire;
  context?: FireContextResponse | null;
}

export function RiskPanel({ fire, context }: RiskPanelProps) {
  const riskScore = Math.max(0, Math.min(100, fire.riskScore || 0));
  const priority = fire.priority || 'low';
  const priorityColor = getPriorityColor(priority);
  const weatherRisk = Math.round(deriveWeatherRiskScore(fire.weatherSnapshot));

  return (
    <section className="border-b border-slate-200 px-4 py-3">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <AlertOctagon size={18} className="text-red-600" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Riesgo</h3>
          </div>
          <p className="text-sm leading-snug text-slate-800">{fire.riskSummary || 'Sin resumen de riesgo.'}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-semibold leading-none" style={{ color: priorityColor }}>
            {riskScore}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">/100</div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${riskScore}%`, backgroundColor: priorityColor }} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-600">
        <span>
          Prioridad <strong className="font-semibold" style={{ color: priorityColor }}>{getPriorityLabel(priority)}</strong>
        </span>
        <span>Meteo {weatherRisk > 0 ? `${weatherRisk}/100` : 's/d'}</span>
      </div>

      <div className="mt-4 space-y-3">
        <ContextLine icon={<CloudSun size={14} />} label="Meteo" value={formatWeatherContext(fire)} />
        <ContextLine icon={<MapPinned size={14} />} label="Acceso" value={formatOperationsContext(context?.operations)} />
      </div>
    </section>
  );
}

function formatWeatherContext(fire: Fire) {
  const weather = fire.weatherSnapshot;
  if (!weather) return 'sin snapshot Open-Meteo';

  const temp = typeof weather.temperatureC === 'number' ? `${Math.round(weather.temperatureC)} C` : 'temp s/d';
  const wind = typeof weather.windSpeedKmh === 'number' ? `${Math.round(weather.windSpeedKmh)} km/h` : 'viento s/d';
  const gust = typeof weather.windGustKmh === 'number' ? `rachas ${Math.round(weather.windGustKmh)} km/h` : 'rachas s/d';
  return `${weather.source || 'meteo'} ${temp}, ${wind}, ${gust}`;
}

function formatOperationsContext(operations?: OperationalContextSnapshot | null) {
  if (!operations) return 'listo para integrarse en panel operativo';
  const access = operations.accessSummary || 'acceso operativo estimado';
  const resources = operations.resourceSummary || 'recursos a definir por operador';
  return `${access}; ${resources}`;
}

function ContextLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_4.5rem_1fr] items-start gap-2">
      <div className="mt-0.5 text-slate-500">{icon}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="min-w-0 break-words text-sm leading-snug text-slate-800">{value}</div>
    </div>
  );
}
