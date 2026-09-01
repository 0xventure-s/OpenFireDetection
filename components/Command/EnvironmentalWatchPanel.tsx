'use client';

import Image from 'next/image';
import { Activity, CloudRain, CloudLightning, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEarthquakes, useLightningLayer, useProvinceWeatherForecast } from '@/hooks/useEnvironmentalLayers';
import { JURISDICTION_NAME } from '@/lib/constants';

export function EnvironmentalWatchPanel() {
  const forecast = useProvinceWeatherForecast();
  const lightning = useLightningLayer();
  const earthquakes = useEarthquakes();
  const nextForecastAlert = forecast.data?.alerts[0];
  const latestEarthquake = earthquakes.data?.events[0];

  return (
    <section className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-slate-700/80 bg-slate-950/92 text-slate-100 shadow-[0_18px_50px_rgba(2,6,23,0.5)] backdrop-blur">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative size-8 overflow-hidden rounded-md bg-white ring-1 ring-slate-700">
            <Image
              src="/openfire-mark.svg"
              alt=""
              fill
              sizes="32px"
              className="object-cover"
              priority
            />
          </span>
          <div>
            <div className="text-[11px] font-semibold text-slate-100">OpenFireDetection</div>
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Vigilancia ambiental</h2>
          </div>
        </div>
        <span className="max-w-32 truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">{JURISDICTION_NAME}</span>
      </header>

      <div className="divide-y divide-slate-800/80">
        <WatchRow icon={<CloudRain size={16} />} accent="text-sky-300" label="Pronóstico operativo" loading={forecast.isLoading}>
          {forecast.isError ? (
            'Pronóstico no disponible'
          ) : nextForecastAlert ? (
            <>
              <span className={nextForecastAlert.kind === 'storm' ? 'text-amber-200' : 'text-slate-100'}>
                {nextForecastAlert.kind === 'storm' ? 'Tormenta probable' : 'Lluvia probable'} {formatHour(nextForecastAlert.startsAt)}
              </span>
              <span className="block text-[11px] text-slate-400">
                {nextForecastAlert.probabilityPct}% · hasta {formatMillimeters(nextForecastAlert.precipitationMm)} · rachas {nextForecastAlert.gustKmh} km/h
              </span>
            </>
          ) : (
            'Sin lluvia ni tormenta prevista en 48 h'
          )}
        </WatchRow>

        <WatchRow icon={<CloudLightning size={16} />} accent="text-amber-300" label="Rayos GOES-19" loading={lightning.isLoading}>
          {lightning.isError || lightning.data?.status === 'disabled' ? (
            'Capa de rayos no disponible'
          ) : lightning.data?.status === 'stale' ? (
            'Sin lectura reciente de rayos'
          ) : (
            <>
              <span className="text-slate-100">{lightning.data?.count || 0} destellos dentro de {JURISDICTION_NAME}</span>
              <span className="block text-[11px] text-slate-400">Últimos {lightning.data?.maxFallbackMinutes || 30} min · riesgo de ignición</span>
            </>
          )}
        </WatchRow>

        <WatchRow icon={<Activity size={16} />} accent="text-violet-300" label="Actividad sísmica" loading={earthquakes.isLoading}>
          {earthquakes.isError ? (
            'Actividad sísmica no disponible'
          ) : latestEarthquake ? (
            <>
              <span className="text-slate-100">M {formatMagnitude(latestEarthquake.magnitude)} · {formatHour(latestEarthquake.occurredAt)}</span>
              <span className="block truncate text-[11px] text-slate-400">{latestEarthquake.place} · {formatDepth(latestEarthquake.depthKm)}</span>
            </>
          ) : (
            `Sin sismos registrados en ${JURISDICTION_NAME} en 7 días`
          )}
        </WatchRow>
      </div>

      <footer className="border-t border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-slate-500">
        Pronóstico, rayos y sismos son fuentes de riesgo independientes de los focos.
      </footer>
    </section>
  );
}

function WatchRow({
  icon,
  accent,
  label,
  loading,
  children,
}: {
  icon: ReactNode;
  accent: string;
  label: string;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3 px-3 py-3">
      <div className={`mt-0.5 ${accent}`}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : icon}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <div className="text-xs leading-5">{loading ? <span className="text-slate-500">Actualizando…</span> : children}</div>
      </div>
    </div>
  );
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatMillimeters(value: number) {
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} mm`;
}

function formatMagnitude(value: number | null) {
  return value === null ? 's/d' : value.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

function formatDepth(value: number | null) {
  return value === null ? 'profundidad s/d' : `${Math.round(value)} km de profundidad`;
}
