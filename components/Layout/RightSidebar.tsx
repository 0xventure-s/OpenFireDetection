'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle,
  ClipboardList,
  CloudSun,
  FileText,
  Flame,
  MapPin,
  Mountain,
  Radio,
  RotateCcw,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DispatchPanel } from '@/components/Command/DispatchPanel';
import { IncidentPriorityBadge } from '@/components/Command/IncidentPriorityBadge';
import { IncidentTimeline } from '@/components/Command/IncidentTimeline';
import { RiskPanel } from '@/components/Command/RiskPanel';
import { ExtinguishModal } from '@/components/Modal/ExtinguishModal';
import { NotesModal } from '@/components/Modal/NotesModal';
import {
  useAssets,
  useConfirmFire,
  useDeleteFire,
  useExtinguishFire,
  useFireContext,
  useFireHistory,
  useOperateFire,
  useStations,
  useUnits,
  useUpdateLifecycle,
} from '@/hooks/useFires';
import {
  filterVisibleHistory,
  getDetectionCount,
  getMaxFrp,
  getOperationalStatusLabel,
  getPrimarySourceLabel,
  getStatusLabel,
} from '@/lib/fire-utils';
import { reverseGeocode } from '@/lib/geocoding';
import { getAssetStatusLabel, getResourceTypeLabel, getUnitStatusLabel } from '@/lib/resource-helpers';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import type {
  CommandIncident,
  Fire,
  FireAudit,
  FireContextResponse,
  IncidentAssignment,
  OperationalAsset,
  OperationalContextSnapshot,
  OperationalUnit,
} from '@/types';

interface RightSidebarProps {
  fire: Fire | null;
  onClose: () => void;
}

function sortHistory(entries: FireAudit[]) {
  return [...entries].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function RightSidebar({ fire, onClose }: RightSidebarProps) {
  const queryClient = useQueryClient();
  const confirmFire = useConfirmFire();
  const operateFire = useOperateFire();
  const extinguishFire = useExtinguishFire();
  const deleteFire = useDeleteFire();
  const updateLifecycle = useUpdateLifecycle();
  const { data: history = [] } = useFireHistory(fire?.id || null);
  const { data: context } = useFireContext(fire?.id || null);
  const { data: units = [] } = useUnits();
  const { data: assets = [] } = useAssets();
  const { data: stations = [] } = useStations();
  const [locationName, setLocationName] = useState('Resolviendo ubicacion...');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'confirm' | 'reject' | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showExtinguishModal, setShowExtinguishModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!fire) return;
    let cancelled = false;
    reverseGeocode(fire.lat, fire.lon)
      .then((result) => {
        if (!cancelled) setLocationName(result.displayName);
      })
      .catch(() => {
        if (!cancelled) setLocationName('Ubicacion desconocida');
      });
    return () => {
      cancelled = true;
    };
  }, [fire]);

  const visibleHistory = useMemo(() => sortHistory(filterVisibleHistory(history)), [history]);
  const commandFire = fire as Fire & Partial<CommandIncident>;
  const assignment = commandFire.assignment || null;
  const nearbyResources = useMemo(
    () => (fire ? getNearbyResources(fire, units, assets) : []),
    [assets, fire, units]
  );

  if (!fire) {
    return (
      <aside className="flex h-full w-full items-center justify-center bg-popover text-popover-foreground">
        <div className="text-center text-muted-foreground">
          <MapPin size={46} className="mx-auto mb-3 opacity-60" />
          <p>Selecciona un incidente para abrir su consola operativa.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-popover text-popover-foreground">
      <header className="border-b bg-card/95 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Flame size={17} fill="currentColor" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Consola de intervencion</p>
                <p className="text-xs text-muted-foreground">{formatDate(fire.detectedAt)} / {formatRelativeTime(fire.detectedAt)}</p>
              </div>
            </div>
            <h2 className="break-words text-base font-semibold leading-tight tracking-tight">{locationName}</h2>
          </div>
          <Button variant="outline" size="icon-sm" onClick={onClose} aria-label="Cerrar panel">
            <X size={16} />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={fire.status === 'confirmed' ? 'destructive' : fire.status === 'probable' ? 'outline' : 'secondary'}>
            {getStatusLabel(fire.status)}
          </Badge>
          <Badge variant="outline">{getOperationalStatusLabel(fire.operationalStatus || 'unreviewed')}</Badge>
          <IncidentPriorityBadge priority={fire.priority || 'low'} />
        </div>
      </header>

      <Tabs defaultValue="resumen" className="min-h-0 flex-1 gap-0">
        <div className="border-b bg-card px-4 py-2">
          <TabsList className="w-full justify-start overflow-x-auto" variant="line">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="despacho">Despacho</TabsTrigger>
            <TabsTrigger value="riesgo">Riesgo</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="resumen" className="m-0 grid gap-3 p-4">
            <SummaryCards fire={commandFire} assignment={assignment} />
            <OperationalVariablesPanel context={context} fire={commandFire} />
            <NearbyResources resources={nearbyResources} stationsCount={stations.length} />
            <IncidentActions
              fire={fire}
              onConfirm={(action) => {
                setConfirmAction(action);
                setShowConfirmDialog(true);
              }}
              onNotes={() => setShowNotesModal(true)}
              onExtinguish={() => setShowExtinguishModal(true)}
              onFollowUp={() =>
                operateFire.mutate({
                  id: fire.id,
                  operationalStatus: fire.status === 'extinguished' || fire.status === 'false_positive' ? 'closed' : 'monitoring',
                  reviewed: true,
                })
              }
              onRestore={() =>
                updateLifecycle.mutate({
                  id: fire.id,
                  lifecycleStatus: 'active',
                  reason: 'Restaurado por operador',
                })
              }
              onArchive={() => setShowDeleteConfirm(true)}
              pending={confirmFire.isPending || operateFire.isPending || updateLifecycle.isPending || deleteFire.isPending}
            />
          </TabsContent>

          <TabsContent value="despacho" className="m-0 p-4">
            <DispatchPanel fire={fire} />
          </TabsContent>

          <TabsContent value="riesgo" className="m-0 grid gap-3 p-4">
            <RiskPanel fire={fire} context={context} />
            <OperationalVariablesPanel context={context} fire={commandFire} compact />
          </TabsContent>

          <TabsContent value="historial" className="m-0 p-4">
            <Card>
              <CardHeader>
                <CardTitle>Historial del incidente</CardTitle>
                <CardDescription>Confirmaciones, notas, despacho, seguimiento y cierre.</CardDescription>
              </CardHeader>
              <CardContent>
                <IncidentTimeline entries={visibleHistory} />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      {showConfirmDialog && confirmAction ? (
        <ConfirmOverlay
          title={confirmAction === 'confirm' ? 'Confirmar foco' : 'Marcar falso positivo'}
          detail={confirmAction === 'confirm' ? 'Esto mantiene el incidente abierto pero validado tecnicamente.' : 'Esto cierra el incidente por descarte operativo.'}
          destructive={confirmAction === 'reject'}
          pending={confirmFire.isPending}
          onCancel={() => {
            setShowConfirmDialog(false);
            setConfirmAction(null);
          }}
          onConfirm={() =>
            confirmFire.mutate(
              {
                id: fire.id,
                confirmed: confirmAction === 'confirm',
                reason: confirmAction === 'confirm' ? 'Confirmado manualmente por operador' : 'Marcado como falso positivo por operador',
              },
              {
                onSuccess: () => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                },
              }
            )
          }
        />
      ) : null}

      {showDeleteConfirm ? (
        <ConfirmOverlay
          title="Archivar incidente"
          detail="Esto lo oculta de la operacion diaria y conserva trazabilidad para auditoria."
          destructive
          pending={deleteFire.isPending}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() =>
            deleteFire.mutate(fire.id, {
              onSuccess: () => {
                setShowDeleteConfirm(false);
                onClose();
              },
            })
          }
        />
      ) : null}

      {showNotesModal ? (
        <NotesModal
          fireId={fire.id}
          onClose={() => setShowNotesModal(false)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['fire-history', fire.id] });
            queryClient.invalidateQueries({ queryKey: ['fires'] });
          }}
        />
      ) : null}

      {showExtinguishModal ? (
        <ExtinguishModal
          fire={fire}
          locationName={locationName}
          onClose={() => setShowExtinguishModal(false)}
          isLoading={extinguishFire.isPending}
          onConfirm={() =>
            extinguishFire.mutate(
              { id: fire.id, reason: 'Marcado como extinguido por operador' },
              { onSuccess: () => setShowExtinguishModal(false) }
            )
          }
        />
      ) : null}
    </aside>
  );
}

function SummaryCards({ fire, assignment }: { fire: Fire & Partial<CommandIncident>; assignment: IncidentAssignment | null }) {
  const assignedLabel = assignment?.unit?.name || assignment?.unitName || fire.assignedUnit || 'Sin unidad';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <QuickFact label="Fuente" value={getPrimarySourceLabel(fire.confirmedBy)} />
      <QuickFact label="Detecciones" value={String(getDetectionCount(fire))} />
      <QuickFact label="FRP max." value={getMaxFrp(fire) > 0 ? `${getMaxFrp(fire).toFixed(1)} MW` : 'Sin dato'} />
      <QuickFact label="Coordenadas" value={formatCoords(fire)} />
      <QuickFact label="Unidad asignada" value={assignedLabel} />
      <QuickFact label="Siguiente accion" value={fire.nextAction || 'Definir por guardia'} />
      {assignment ? (
        <div className="sm:col-span-2">
          <Alert>
            <Radio size={16} />
            <AlertTitle>Despacho activo</AlertTitle>
            <AlertDescription>
              {assignedLabel} / {getAssignmentStatusLabel(assignment.status)} / asignado por {assignment.assignedBy} {formatRelativeTime(assignment.assignedAt)}.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}

function QuickFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}

function OperationalVariablesPanel({
  context,
  fire,
  compact = false,
}: {
  context?: FireContextResponse | null;
  fire: Fire & Partial<CommandIncident>;
  compact?: boolean;
}) {
  const rows = [
    { icon: <CloudSun size={14} />, label: 'Clima', value: formatWeather(context?.weather) },
    { icon: <Mountain size={14} />, label: 'Terreno', value: formatTerrain(context?.terrain) },
    { icon: <ShieldAlert size={14} />, label: 'Proyeccion', value: formatProjection(context?.projection) },
    { icon: <Radio size={14} />, label: 'Recursos', value: formatResources(context?.operations) },
    { icon: <Archive size={14} />, label: 'Asignacion', value: formatAssignment(fire) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variables tacticas</CardTitle>
        {!compact ? <CardDescription>Lectura operativa disponible para decidir despacho.</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <VariableRow key={row.label} {...row} />
        ))}
      </CardContent>
    </Card>
  );
}

function VariableRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.25rem_6rem_1fr] items-start gap-2 text-sm">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words leading-snug">{value}</div>
    </div>
  );
}

function NearbyResources({ resources, stationsCount }: { resources: NearbyResource[]; stationsCount: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recursos cercanos</CardTitle>
        <CardDescription>{stationsCount} cuarteles cargados. Solo se calculan distancias con ubicacion real.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {resources.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay recursos con ubicacion cargada cerca del incidente.</div>
        ) : (
          resources.slice(0, 6).map((resource) => (
            <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{resource.label}</div>
                <div className="truncate text-xs text-muted-foreground">{resource.detail}</div>
              </div>
              <Badge variant={resource.status === 'available' ? 'secondary' : 'outline'}>{resource.distanceKm.toFixed(1)} km</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function IncidentActions({
  fire,
  onConfirm,
  onNotes,
  onExtinguish,
  onFollowUp,
  onRestore,
  onArchive,
  pending,
}: {
  fire: Fire;
  onConfirm: (action: 'confirm' | 'reject') => void;
  onNotes: () => void;
  onExtinguish: () => void;
  onFollowUp: () => void;
  onRestore: () => void;
  onArchive: () => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones</CardTitle>
        <CardDescription>Operaciones manuales del incidente.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {!fire.confirmed && fire.status !== 'false_positive' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onConfirm('confirm')} disabled={pending}>
              <CheckCircle size={16} />
              Confirmar
            </Button>
            <Button variant="destructive" onClick={() => onConfirm('reject')} disabled={pending}>
              <XCircle size={16} />
              Falso positivo
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onNotes}>
            <FileText size={15} />
            Notas
          </Button>
          {fire.status === 'confirmed' ? (
            <Button variant="outline" onClick={onExtinguish}>
              Extinguir
            </Button>
          ) : null}
          {fire.lifecycleStatus === 'active' ? (
            <Button variant="outline" onClick={onFollowUp} disabled={pending}>
              <ClipboardList size={15} />
              Seguimiento
            </Button>
          ) : (
            <Button variant="outline" onClick={onRestore} disabled={pending}>
              <RotateCcw size={15} />
              Restaurar
            </Button>
          )}
          <Button variant="outline" onClick={onArchive} disabled={pending}>
            <Trash2 size={15} />
            Archivar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmOverlay({
  title,
  detail,
  destructive,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  detail: string;
  destructive?: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{detail}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} className="flex-1" disabled={pending} onClick={onConfirm}>
            Confirmar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type NearbyResource = {
  id: string;
  label: string;
  status: string;
  detail: string;
  distanceKm: number;
};

function getNearbyResources(fire: Fire, units: OperationalUnit[], assets: OperationalAsset[]): NearbyResource[] {
  const unitRows = units
    .filter((unit) => typeof unit.lat === 'number' && typeof unit.lon === 'number')
    .map((unit) => ({
      id: `unit:${unit.id}`,
      label: unit.name,
      status: unit.status,
      detail: `${getResourceTypeLabel(unit.type)} / ${getUnitStatusLabel(unit.status)}`,
      distanceKm: haversineKm(fire.lat, fire.lon, unit.lat as number, unit.lon as number),
    }));
  const assetRows = assets
    .filter((asset) => typeof asset.lat === 'number' && typeof asset.lon === 'number')
    .map((asset) => ({
      id: `asset:${asset.id}`,
      label: asset.name,
      status: asset.status,
      detail: `${getResourceTypeLabel(asset.type)} / ${getAssetStatusLabel(asset.status)}`,
      distanceKm: haversineKm(fire.lat, fire.lon, asset.lat as number, asset.lon as number),
    }));
  return [...unitRows, ...assetRows].sort((left, right) => left.distanceKm - right.distanceKm);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function formatCoords(fire: Pick<Fire, 'lat' | 'lon'>) {
  return `${fire.lat.toFixed(3)}, ${fire.lon.toFixed(3)}`;
}

function formatWeather(weather?: Record<string, unknown>) {
  if (!weather) return 'sin dato';
  const temp = typeof weather.temperatureC === 'number' ? `${weather.temperatureC} C` : 'temp. sin dato';
  const humidity = typeof weather.humidityPct === 'number' ? `${weather.humidityPct}% HR` : 'humedad sin dato';
  const wind = typeof weather.windSpeedKmh === 'number' ? `${weather.windSpeedKmh} km/h` : 'viento sin dato';
  return `${temp} / ${humidity} / ${wind}`;
}

function formatTerrain(terrain?: Record<string, unknown>) {
  if (!terrain) return 'sin dato';
  const altitude = typeof terrain.altitudeM === 'number' ? `${terrain.altitudeM} m` : 'altitud sin dato';
  const slope = typeof terrain.slopeDeg === 'number' ? `${terrain.slopeDeg} grados pendiente` : 'pendiente sin dato';
  const fuel = typeof terrain.fuelType === 'string' ? terrain.fuelType : 'combustible sin dato';
  return `${altitude} / ${slope} / ${fuel}`;
}

function formatProjection(projection?: Record<string, unknown>) {
  if (!projection) return 'sin dato';
  if (typeof projection.summary === 'string') return projection.summary;
  return typeof projection.distanceKm1h === 'number' ? `${projection.distanceKm1h} km en 1h` : 'distancia sin dato';
}

function formatResources(operations?: OperationalContextSnapshot | null) {
  if (!operations) return 'sin dato operativo';
  const resources = Array.isArray(operations.recommendedResources) ? operations.recommendedResources.slice(0, 3).join(', ') : 'recursos a definir';
  return `${operations.resourceSummary || 'recomendacion pendiente'}: ${resources}`;
}

function formatAssignment(fire: Fire & Partial<CommandIncident>) {
  const assignment = fire.assignment || null;
  if (assignment) {
    return `${assignment.unit?.name || assignment.unitName || 'unidad sin nombre'} / ${getAssignmentStatusLabel(assignment.status)} / ${assignment.assignedBy}`;
  }
  if (fire.assignedUnit) return `${fire.assignedUnit} / compatibilidad payload`;
  return 'sin unidad asignada en catalogo';
}

function getAssignmentStatusLabel(status: string) {
  switch (status) {
    case 'assigned':
      return 'Asignado';
    case 'en_route':
      return 'En camino';
    case 'on_scene':
      return 'En escena';
    case 'released':
      return 'Liberado';
    default:
      return status;
  }
}
