'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BarChart3,
  BookOpenText,
  ChevronDown,
  ChevronUp,
  Download,
  Flame,
  History,
  Keyboard,
  LogOut,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { MapView } from '@/components/Map/MapView';
import { RightSidebar } from '@/components/Layout/RightSidebar';
import { AddFireModal } from '@/components/Modal/AddFireModal';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { AdvancedFilters, AdvancedFilterValues } from '@/components/AdvancedFilters';
import { IncidentPriorityBadge } from '@/components/Command/IncidentPriorityBadge';
import { EnvironmentalWatchPanel } from '@/components/Command/EnvironmentalWatchPanel';
import { useAssets, useFires, useStations, useTriggerScan, useUnits } from '@/hooks/useFires';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { requestNotificationPermission, useFireNotifications } from '@/hooks/useFireNotifications';
import { useAutoScan } from '@/hooks/useAutoScan';
import { MAP_CENTER } from '@/lib/constants';
import { authClient } from '@/lib/auth-client';
import { exportToCSV } from '@/lib/export';
import {
  buildCommandAlerts,
  compareByPriorityAndTime,
  enrichFires,
  getDetectionCount,
  getMaxFrp,
  getStatusLabel,
} from '@/lib/fire-utils';
import { formatRelativeTime } from '@/lib/utils';
import { Fire, FireFilters, FireStatus } from '@/types';

const statusOptions: Array<{ value: FireStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'unconfirmed', label: 'Sin confirmar' },
  { value: 'probable', label: 'Probable' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'extinguished', label: 'Extinguido' },
];

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const triggerScan = useTriggerScan();
  const { data: stations = [] } = useStations();
  const { data: units = [] } = useUnits();
  const { data: assets = [] } = useAssets();
  const [filters, setFilters] = useState<FireFilters>({ lifecycle: 'active', timeframe: 'all', period: 'all', limit: 200 });
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [isIncidentPanelCollapsed, setIsIncidentPanelCollapsed] = useState(true);
  const [historyCursor, setHistoryCursor] = useState(100);
  const [selectedFireId, setSelectedFireId] = useState<string | null>(null);
  const [showAddFireModal, setShowAddFireModal] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterValues>({});
  const [search, setSearch] = useState('');
  const [modalCoords, setModalCoords] = useState<{ lat: number; lon: number }>({
    lat: MAP_CENTER.lat,
    lon: MAP_CENTER.lon,
  });
  const fireQueryFilters = useMemo<FireFilters>(
    () =>
      isHistoricalMode
        ? { ...filters, lifecycle: 'all', timeframe: 'all', period: '90d', limit: 200 }
        : filters,
    [filters, isHistoricalMode]
  );
  const { data: firesData, isLoading } = useFires(fireQueryFilters, { fetchAllPages: isHistoricalMode });

  useAutoScan(true);

  const fires = useMemo(() => {
    const rawFires = enrichFires((firesData?.items || []) as never);
    return rawFires.filter((fire) => {
      const maxFrp = getMaxFrp(fire);
      const detections = getDetectionCount(fire);
      const detectedAt = new Date(fire.detectedAt);

      if (advancedFilters.minFRP && maxFrp < advancedFilters.minFRP) return false;
      if (advancedFilters.maxFRP && maxFrp > advancedFilters.maxFRP) return false;
      if (advancedFilters.minDetections && detections < advancedFilters.minDetections) return false;
      if (advancedFilters.dateFrom && detectedAt < new Date(advancedFilters.dateFrom)) return false;
      if (advancedFilters.dateTo && detectedAt > new Date(advancedFilters.dateTo)) return false;

      return true;
    });
  }, [advancedFilters, firesData?.items]);

  const visibleFires = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fires;
    return fires.filter(
      (fire) =>
        fire.id.toLowerCase().includes(query) ||
        fire.lat.toString().includes(query) ||
        fire.lon.toString().includes(query) ||
        (fire.assignedUnit || '').toLowerCase().includes(query)
    );
  }, [fires, search]);

  const historyBounds = useMemo(() => getHistoryBounds(visibleFires), [visibleFires]);
  const historyCursorTime = useMemo(() => {
    if (!isHistoricalMode || !historyBounds) return null;
    if (historyBounds.start === historyBounds.end) return historyBounds.end;
    return Math.round(historyBounds.start + ((historyBounds.end - historyBounds.start) * historyCursor) / 100);
  }, [historyBounds, historyCursor, isHistoricalMode]);
  const mapFires = useMemo(() => {
    if (!isHistoricalMode || historyCursorTime === null) return visibleFires;
    return visibleFires
      .filter((fire) => getFireTimestamp(fire) <= historyCursorTime)
      .sort(compareByDetectedAtDesc);
  }, [historyCursorTime, isHistoricalMode, visibleFires]);
  const historicalWindowCount = useMemo(() => {
    if (!isHistoricalMode || historyCursorTime === null) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    return visibleFires.filter((fire) => {
      const timestamp = getFireTimestamp(fire);
      return timestamp <= historyCursorTime && timestamp > historyCursorTime - dayMs;
    }).length;
  }, [historyCursorTime, isHistoricalMode, visibleFires]);

  useFireNotifications(fires, !isHistoricalMode);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const selectedFire = mapFires.find((fire) => fire.id === selectedFireId) || null;
  const alerts = useMemo(() => buildCommandAlerts(fires), [fires]);
  const priorityQueue = useMemo(
    () =>
      isHistoricalMode
        ? [...mapFires].sort(compareByDetectedAtDesc).slice(0, 6)
        : [...visibleFires].sort(compareByPriorityAndTime).slice(0, 6),
    [isHistoricalMode, mapFires, visibleFires]
  );

  useKeyboardShortcuts([
    {
      key: 'r',
      action: () => setShowAddFireModal(true),
      description: 'Reportar nuevo incendio',
    },
    {
      key: 'c',
      action: () => {
        if (selectedFire && selectedFire.status !== 'confirmed') {
          toast.info('Usa el panel derecho para confirmar');
        }
      },
      description: 'Confirmar incidente seleccionado',
    },
    {
      key: 'Escape',
      action: () => {
        if (showAddFireModal) setShowAddFireModal(false);
        else if (showShortcutsHelp) setShowShortcutsHelp(false);
        else if (showAdvancedFilters) setShowAdvancedFilters(false);
        else if (selectedFireId) setSelectedFireId(null);
      },
      description: 'Cerrar modales o deseleccionar',
    },
    {
      key: '?',
      action: () => setShowShortcutsHelp(true),
      description: 'Mostrar ayuda de atajos',
    },
  ]);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[#020617] text-white">
      <main className="absolute inset-0">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950 text-slate-400">
            Cargando mapa operativo...
          </div>
        ) : (
          <MapView
            fires={mapFires}
            selectedFireId={selectedFireId}
            onFireSelect={setSelectedFireId}
            chrome="minimal"
            markerMode={isHistoricalMode ? 'historical' : 'live'}
            operationalUnits={units}
            stations={stations}
            operationalAssets={assets}
            onAddFire={(lat, lon) => {
              setModalCoords({ lat, lon });
              setShowAddFireModal(true);
            }}
            toolsSlot={
              <>
                <button
                  onClick={() => {
                    exportToCSV(fires);
                    toast.success('CSV exportado');
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <Download size={16} />
                  Exportar CSV
                </button>
                <button
                  onClick={() => {
                    setIsHistoricalMode((value) => !value);
                    setHistoryCursor(100);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isHistoricalMode ? 'bg-orange-600 text-white' : 'text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <History size={16} />
                  Modo histórico
                </button>
                <button
                  onClick={() => setShowAdvancedFilters(true)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <SlidersHorizontal size={16} />
                  Filtros avanzados
                </button>
                <button
                  onClick={() => setShowShortcutsHelp(true)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <Keyboard size={16} />
                  Atajos
                </button>
                <Link
                  href="/dashboard"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <BarChart3 size={16} />
                  Dashboard
                </Link>
                <Link
                  href="/manual"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <BookOpenText size={16} />
                  Manual operativo
                </Link>
                <button
                  onClick={async () => {
                    await authClient.signOut();
                    router.replace('/login');
                    router.refresh();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </>
            }
          />
        )}
      </main>

      {isHistoricalMode ? (
        <HistoricalTimeline
          bounds={historyBounds}
          cursor={historyCursor}
          isLoading={isLoading}
          selectedTime={historyCursorTime}
          total={visibleFires.length}
          visible={mapFires.length}
          windowCount={historicalWindowCount}
          onCursorChange={setHistoryCursor}
          onExit={() => setIsHistoricalMode(false)}
        />
      ) : null}

      {!isHistoricalMode ? (
        <div className="absolute left-4 top-4 z-50">
          <EnvironmentalWatchPanel />
        </div>
      ) : null}

      <section className="absolute bottom-4 left-4 z-50 w-[min(26rem,calc(100vw-2rem))] rounded-md border border-slate-800/90 bg-slate-950/90 p-3 shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className={`flex items-center justify-between gap-3 ${isIncidentPanelCollapsed ? '' : 'mb-3'}`}>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              {isHistoricalMode ? 'Historico' : 'Incidentes clave'}
            </h2>
            <p className="text-xs text-slate-500">
              {isHistoricalMode ? `${mapFires.length}/${visibleFires.length} focos hasta el cursor` : `${alerts.length} alertas priorizadas`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsIncidentPanelCollapsed((value) => !value)}
              aria-controls="incident-panel-body"
              aria-expanded={!isIncidentPanelCollapsed}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title={isIncidentPanelCollapsed ? 'Expandir incidentes' : 'Colapsar incidentes'}
            >
              {isIncidentPanelCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={() => triggerScan.mutate({ triggerType: 'manual' })}
              disabled={triggerScan.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-600 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-700"
              title="Escanear ahora"
            >
              <RefreshCw size={16} className={triggerScan.isPending ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {!isIncidentPanelCollapsed ? (
          <div id="incident-panel-body">
            <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
              <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                <Search size={15} className="text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar ID, coordenadas o unidad"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </label>
              <select
                value={filters.status?.[0] || 'all'}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    status: event.target.value === 'all' ? undefined : [event.target.value as FireStatus],
                  })
                }
                className="w-36 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[34svh] space-y-2 overflow-y-auto pr-1">
              {priorityQueue.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
                  {isHistoricalMode ? 'No hay focos para mostrar en este momento del historico.' : 'No hay incidentes para mostrar.'}
                </div>
              ) : (
                priorityQueue.map((fire) => (
                  <IncidentRow
                    key={fire.id}
                    fire={fire}
                    selected={selectedFireId === fire.id}
                    onSelect={() => setSelectedFireId(fire.id)}
                  />
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      {selectedFire ? (
        <div className="absolute inset-y-0 right-0 z-[70] w-[min(30rem,100vw)] shadow-[0_0_60px_rgba(2,6,23,0.55)]">
          <RightSidebar fire={selectedFire} onClose={() => setSelectedFireId(null)} />
        </div>
      ) : null}

      {showAddFireModal ? (
        <AddFireModal
          initialLat={modalCoords.lat}
          initialLon={modalCoords.lon}
          onClose={() => setShowAddFireModal(false)}
          onSuccess={() => {
            setShowAddFireModal(false);
            queryClient.invalidateQueries({ queryKey: ['fires'] });
            queryClient.invalidateQueries({ queryKey: ['stats'] });
            queryClient.invalidateQueries({ queryKey: ['overview'] });
          }}
        />
      ) : null}

      {showShortcutsHelp ? <KeyboardShortcutsHelp onClose={() => setShowShortcutsHelp(false)} /> : null}

      {showAdvancedFilters ? (
        <AdvancedFilters
          currentFilters={advancedFilters}
          onClose={() => setShowAdvancedFilters(false)}
          onApply={(newFilters) => {
            setAdvancedFilters(newFilters);
            toast.success('Filtros aplicados');
          }}
        />
      ) : null}
    </div>
  );
}

function HistoricalTimeline({
  bounds,
  cursor,
  isLoading,
  selectedTime,
  total,
  visible,
  windowCount,
  onCursorChange,
  onExit,
}: {
  bounds: { start: number; end: number } | null;
  cursor: number;
  isLoading: boolean;
  selectedTime: number | null;
  total: number;
  visible: number;
  windowCount: number;
  onCursorChange: (value: number) => void;
  onExit: () => void;
}) {
  const hasRange = !!bounds && bounds.start !== bounds.end;

  return (
    <section className="absolute left-4 top-16 z-[60] w-[min(34rem,calc(100vw-2rem))] rounded-md border border-orange-500/40 bg-slate-950/92 p-3 text-white shadow-[0_18px_50px_rgba(2,6,23,0.5)] backdrop-blur md:top-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
            <History size={14} />
            Modo historico
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-100">
            {selectedTime ? formatHistoryTimestamp(selectedTime) : isLoading ? 'Cargando focos...' : 'Sin focos en los filtros'}
          </div>
        </div>
        <button
          onClick={onExit}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          title="Volver al modo en vivo"
        >
          <X size={15} />
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={cursor}
        disabled={!hasRange}
        onChange={(event) => onCursorChange(Number(event.target.value))}
        className="h-2 w-full accent-orange-500 disabled:opacity-40"
      />

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span>{bounds ? formatHistoryTick(bounds.start) : 'sin inicio'}</span>
        <span>{bounds ? formatHistoryTick(bounds.end) : 'sin fin'}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <HistoryMetric label="Mostrando" value={`${visible}/${total}`} />
        <HistoryMetric label="24h previas" value={windowCount} />
        <HistoryMetric label="Rango" value="90 días" />
      </div>
    </section>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-2">
      <div className="truncate text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function IncidentRow({ fire, selected, onSelect }: { fire: Fire; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
        selected ? 'border-orange-500 bg-orange-950/40' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
      }`}
    >
      <Flame size={18} className="flex-shrink-0 text-orange-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">
            {fire.lat.toFixed(3)}, {fire.lon.toFixed(3)}
          </span>
          <IncidentPriorityBadge priority={fire.priority || 'low'} compact />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{getStatusLabel(fire.status)}</span>
          <span>{formatRelativeTime(fire.detectedAt)}</span>
          <span>{getDetectionCount(fire)} det.</span>
          {getMaxFrp(fire) > 0 ? <span>{getMaxFrp(fire).toFixed(1)} MW</span> : null}
        </div>
      </div>
    </button>
  );
}

function getHistoryBounds(fires: Fire[]) {
  const timestamps = fires
    .map((fire) => getFireTimestamp(fire))
    .filter((timestamp) => timestamp > 0)
    .sort((left, right) => left - right);

  if (timestamps.length === 0) return null;
  return {
    start: timestamps[0],
    end: timestamps[timestamps.length - 1],
  };
}

function getFireTimestamp(fire: Pick<Fire, 'detectedAt'>) {
  const timestamp = new Date(fire.detectedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareByDetectedAtDesc(left: Fire, right: Fire) {
  return getFireTimestamp(right) - getFireTimestamp(left);
}

function formatHistoryTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatHistoryTick(timestamp: number) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(timestamp));
}
