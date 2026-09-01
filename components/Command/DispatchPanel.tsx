'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Radio, Truck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { getOperationalStatusLabel, getPriorityLabel } from '@/lib/fire-utils';
import { getResourceTypeLabel, getUnitStatusLabel } from '@/lib/resource-helpers';
import { formatRelativeTime } from '@/lib/utils';
import { useAssignIncident, useOperateFire, useReleaseIncidentAssignment, useUnits, useUpdateIncidentAssignment } from '@/hooks/useFires';
import type { Fire, IncidentAssignment, OperationalUnit } from '@/types';

interface DispatchPanelProps {
  fire: Fire;
}

export function DispatchPanel({ fire }: DispatchPanelProps) {
  const assignment = (fire as Fire & { assignment?: IncidentAssignment | null }).assignment || null;
  const initialSelectedUnitId = assignment?.unitId || '';
  const initialAssignedUnit = assignment?.unit?.name || assignment?.unitName || fire.assignedUnit || '';
  const initialAssignedTeam = fire.assignedTeam || assignment?.notes || '';

  return (
    <DispatchPanelForm
      key={`${fire.id}:${assignment?.id || 'none'}:${initialSelectedUnitId}:${initialAssignedUnit}:${initialAssignedTeam}`}
      fire={fire}
      assignment={assignment}
      initialSelectedUnitId={initialSelectedUnitId}
      initialAssignedUnit={initialAssignedUnit}
      initialAssignedTeam={initialAssignedTeam}
    />
  );
}

function DispatchPanelForm({
  fire,
  assignment,
  initialSelectedUnitId,
  initialAssignedUnit,
  initialAssignedTeam,
}: {
  fire: Fire;
  assignment: IncidentAssignment | null;
  initialSelectedUnitId: string;
  initialAssignedUnit: string;
  initialAssignedTeam: string;
}) {
  const operateFire = useOperateFire();
  const assignIncident = useAssignIncident();
  const updateAssignment = useUpdateIncidentAssignment();
  const releaseAssignment = useReleaseIncidentAssignment();
  const { data: units = [] } = useUnits();
  const [selectedUnitId, setSelectedUnitId] = useState(initialSelectedUnitId);
  const [assignedUnit, setAssignedUnit] = useState(initialAssignedUnit);
  const [assignedTeam, setAssignedTeam] = useState(initialAssignedTeam);
  const [notes, setNotes] = useState(initialAssignedTeam);

  const selectedUnit = useMemo(() => units.find((unit) => unit.id === selectedUnitId) || null, [selectedUnitId, units]);
  const selectableUnits = useMemo(
    () => units.filter((unit) => unit.status === 'available' || unit.id === selectedUnitId),
    [selectedUnitId, units]
  );
  const blockedUnits = useMemo(
    () => units.filter((unit) => unit.status !== 'available' && unit.id !== selectedUnitId),
    [selectedUnitId, units]
  );
  const selectedBlockReason = selectedUnit ? getDispatchBlockReason(selectedUnit) : null;
  const canDispatch = !assignment && (!selectedUnit || selectedUnit.status === 'available') && (Boolean(selectedUnitId) || Boolean(assignedUnit.trim()));
  const followUpLabel = fire.status === 'extinguished' || fire.status === 'false_positive' ? 'Cerrar' : 'Seguimiento';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck size={18} />
          Despacho
        </CardTitle>
        <CardDescription>Asignacion, avance y liberacion de recursos reales del catalogo.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{getOperationalStatusLabel(fire.operationalStatus || 'unreviewed')}</Badge>
          <Badge variant={fire.priority === 'critical' || fire.priority === 'high' ? 'destructive' : 'secondary'}>{getPriorityLabel(fire.priority || 'low')}</Badge>
          {assignment ? <Badge variant="outline">{getAssignmentStatusLabel(assignment.status)}</Badge> : <Badge variant="secondary">Sin despacho activo</Badge>}
        </div>

        {assignment ? (
          <Alert>
            <Radio size={16} />
            <AlertTitle>Recurso asignado</AlertTitle>
            <AlertDescription>
              {assignment.unit?.name || assignment.unitName || 'unidad sin nombre'} / {getAssignmentStatusLabel(assignment.status)} / operador {assignment.assignedBy} / {formatRelativeTime(assignment.assignedAt)}
            </AlertDescription>
          </Alert>
        ) : null}

        {!assignment ? (
          <FieldGroup>
            <Field>
              <FieldLabel>Unidad disponible</FieldLabel>
              {units.length > 0 ? (
                <NativeSelect
                  value={selectedUnitId}
                  onChange={(event) => {
                    const unitId = event.target.value;
                    setSelectedUnitId(unitId);
                    const unit = units.find((item) => item.id === unitId);
                    if (unit) setAssignedUnit(unit.name);
                  }}
                  className="w-full"
                >
                  <NativeSelectOption value="">Unidad manual / sin catalogo</NativeSelectOption>
                  {selectableUnits.map((unit) => (
                    <NativeSelectOption key={unit.id} value={unit.id}>
                      {unit.name} / {getResourceTypeLabel(unit.type)} / {getUnitStatusLabel(unit.status)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  No hay catalogo de unidades cargado. La asignacion queda como unidad manual.
                </div>
              )}
            </Field>

            {selectedBlockReason ? (
              <Alert variant="destructive">
                <AlertTriangle size={16} />
                <AlertTitle>Unidad bloqueada</AlertTitle>
                <AlertDescription>{selectedBlockReason}</AlertDescription>
              </Alert>
            ) : null}

            {blockedUnits.length > 0 ? (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">No despachables ahora</div>
                <div className="grid gap-2">
                  {blockedUnits.slice(0, 5).map((unit) => (
                    <div key={unit.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{unit.name}</span>
                      <Badge variant={unit.status === 'maintenance' ? 'destructive' : 'outline'}>{getUnitStatusLabel(unit.status)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Unidad</FieldLabel>
                <Input value={assignedUnit} onChange={(event) => setAssignedUnit(event.target.value)} placeholder="Sin asignar" />
              </Field>
              <Field>
                <FieldLabel>Equipo / observacion</FieldLabel>
                <Input value={assignedTeam} onChange={(event) => setAssignedTeam(event.target.value)} placeholder="Dotacion, canal o equipo" />
              </Field>
            </div>
            <Field>
              <FieldLabel>Notas de despacho</FieldLabel>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Orden, contacto, referencia operativa" />
            </Field>
          </FieldGroup>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={() =>
              operateFire.mutate({
                id: fire.id,
                operationalStatus: 'evaluating',
                reviewed: true,
              })
            }
            disabled={operateFire.isPending}
          >
            <CheckCircle2 size={15} />
            Revisado
          </Button>
          <Button
            onClick={() =>
              assignIncident.mutate({
                fireId: fire.id,
                unitId: selectedUnitId || undefined,
                unitName: selectedUnitId ? undefined : assignedUnit || undefined,
                notes: notes || assignedTeam || undefined,
                status: 'assigned',
              })
            }
            disabled={!canDispatch || assignIncident.isPending}
          >
            <Radio size={15} />
            Despachar
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              operateFire.mutate({
                id: fire.id,
                operationalStatus: fire.status === 'extinguished' || fire.status === 'false_positive' ? 'closed' : 'monitoring',
                assignedUnit: assignedUnit || undefined,
                assignedTeam: assignedTeam || undefined,
              })
            }
            disabled={operateFire.isPending}
          >
            <ClipboardCheck size={14} />
            {followUpLabel}
          </Button>
        </div>

        {assignment ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              onClick={() => updateAssignment.mutate({ fireId: fire.id, assignmentId: assignment.id, status: 'en_route' })}
              disabled={updateAssignment.isPending || assignment.status === 'en_route'}
            >
              En camino
            </Button>
            <Button
              variant="outline"
              onClick={() => updateAssignment.mutate({ fireId: fire.id, assignmentId: assignment.id, status: 'on_scene' })}
              disabled={updateAssignment.isPending || assignment.status === 'on_scene'}
            >
              En escena
            </Button>
            <Button
              variant="destructive"
              onClick={() => releaseAssignment.mutate({ fireId: fire.id, assignmentId: assignment.id })}
              disabled={releaseAssignment.isPending}
            >
              Liberar
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function getDispatchBlockReason(unit: OperationalUnit) {
  if (unit.status === 'available') return null;
  if (unit.status === 'maintenance') return `La unidad ${unit.name} esta en mantenimiento y no puede despacharse.`;
  if (unit.status === 'assigned') return `La unidad ${unit.name} ya esta asignada a otro operativo.`;
  if (unit.status === 'unavailable') return `La unidad ${unit.name} esta fuera de servicio.`;
  return `La unidad ${unit.name} no esta disponible.`;
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
