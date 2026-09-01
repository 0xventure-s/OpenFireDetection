'use client';

import { useMemo, useState } from 'react';
import { Archive, Filter, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Fire, FireFilters, FireStatus, LifecycleStatus } from '@/types';
import { useTriggerScan } from '@/hooks/useFires';
import { IncidentQueue } from '@/components/Command/IncidentQueue';
import { AlertFeed } from '@/components/Command/AlertFeed';
import { buildCommandAlerts } from '@/lib/fire-utils';

interface LeftSidebarProps {
  fires: Fire[];
  selectedFireId: string | null;
  onFireSelect: (fireId: string) => void;
  filters: FireFilters;
  onFiltersChange: (filters: FireFilters) => void;
}

const statusOptions: Array<{ value: FireStatus; label: string }> = [
  { value: 'unconfirmed', label: 'Sin confirmar' },
  { value: 'probable', label: 'Probable' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'extinguished', label: 'Extinguido' },
  { value: 'false_positive', label: 'Falso positivo' },
];

const lifecycleOptions: Array<{ value: LifecycleStatus; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'closed', label: 'Cerrados' },
  { value: 'archived', label: 'Archivados' },
  { value: 'test', label: 'Prueba' },
];

export function LeftSidebar({
  fires,
  selectedFireId,
  onFireSelect,
  filters,
  onFiltersChange,
}: LeftSidebarProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const triggerScan = useTriggerScan();

  const filteredFires = useMemo(() => {
    if (!search) return fires;
    const query = search.toLowerCase();
    return fires.filter(
      (fire) =>
        fire.id.toLowerCase().includes(query) ||
        fire.lat.toString().includes(query) ||
        fire.lon.toString().includes(query) ||
        (fire.assignedUnit || '').toLowerCase().includes(query)
    );
  }, [fires, search]);

  const alerts = useMemo(() => buildCommandAlerts(filteredFires), [filteredFires]);

  return (
    <aside className="flex h-full w-[24rem] flex-shrink-0 flex-col gap-3 border-r border-slate-800 bg-[#020617] px-3 py-3 text-white">
      <div className="rounded-md border border-slate-800 bg-slate-950/80 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={16} className="text-orange-400" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Control rapido</h2>
            <p className="text-xs text-slate-500">Busqueda, filtros y escaneo manual.</p>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
          <Search size={15} className="text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ID, coordenadas o unidad"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400"
          >
            <SlidersHorizontal size={14} />
            Filtros
          </button>
          <button
            onClick={() => triggerScan.mutate({ triggerType: 'manual' })}
            disabled={triggerScan.isPending}
            className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            <RefreshCw size={15} className={triggerScan.isPending ? 'animate-spin' : ''} />
            {triggerScan.isPending ? 'Escaneando...' : 'Escanear'}
          </button>
        </div>

        {showFilters ? (
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.lifecycle || 'active'}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  lifecycle: event.target.value as LifecycleStatus,
                })
              }
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              {lifecycleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.timeframe || 'all'}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  timeframe: event.target.value as FireFilters['timeframe'],
                })
              }
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="all">Todo</option>
              <option value="30m">30 min</option>
              <option value="1h">1 hora</option>
              <option value="3h">3 horas</option>
              <option value="24h">24 horas</option>
            </select>

            <select
              value={filters.status?.[0] || ''}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  status: event.target.value ? [event.target.value as FireStatus] : undefined,
                })
              }
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={filters.period || 'all'}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  period: event.target.value as FireFilters['period'],
                })
              }
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="all">Historico</option>
              <option value="24h">24 horas</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
            </select>
          </div>
        ) : null}
      </div>

      <AlertFeed alerts={alerts} onSelect={onFireSelect} />
      {filters.lifecycle !== 'active' ? (
        <div className="flex items-start gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-500">
          <Archive size={14} className="mt-0.5 flex-shrink-0" />
          <span>Estas vistas son historicas. La operacion diaria usa incidentes activos por defecto.</span>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <IncidentQueue fires={filteredFires} selectedFireId={selectedFireId} onSelect={onFireSelect} />
      </div>
    </aside>
  );
}
