'use client';

import { useState } from 'react';
import { Activity, Search } from 'lucide-react';
import { useDashboard } from '../_components/dashboard-context';
import {
  DashboardDataBanner,
  FireHistoryPanel,
} from '../_components/dashboard-widgets';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuditEvents } from '@/hooks/useFires';
import { formatRelativeTime } from '@/lib/utils';
import type { AuditEvent } from '@/types';

export default function DashboardHistoryPage() {
  const { command, commandError, commandIsError, isLoading, setSelectedFireId } = useDashboard();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const { data: auditEvents = [], isLoading: auditLoading } = useAuditEvents({ type });
  const filteredAuditEvents = auditEvents.filter((event) =>
    [event.entityLabel, event.action, event.actor, event.reason || '', event.type].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <DashboardDataBanner command={command} error={commandError} isError={commandIsError} isLoading={isLoading} />
      <Tabs defaultValue="auditoria" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="incidentes">Incidentes</TabsTrigger>
        </TabsList>
        <TabsContent value="auditoria">
          <Card className="command-card-modern">
            <CardHeader className="border-b">
              <CardTitle>Auditoria operativa</CardTitle>
              <CardDescription>Incidentes, despacho/liberacion, recursos, mantenimiento, altas y ediciones.</CardDescription>
              <CardAction className="flex items-center gap-2">
                <label className="relative min-w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" placeholder="Buscar auditoria" />
                </label>
                <NativeSelect value={type} onChange={(event) => setType(event.target.value)}>
                  <NativeSelectOption value="all">Todo</NativeSelectOption>
                  <NativeSelectOption value="incident">Incidentes</NativeSelectOption>
                  <NativeSelectOption value="resource">Recursos</NativeSelectOption>
                  <NativeSelectOption value="asset">Activos</NativeSelectOption>
                  <NativeSelectOption value="station">Cuarteles</NativeSelectOption>
                  <NativeSelectOption value="maintenance">Mantenimiento</NativeSelectOption>
                </NativeSelect>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AuditTable events={filteredAuditEvents} isLoading={auditLoading} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="incidentes">
          <FireHistoryPanel command={command} isLoading={isLoading} onSelect={setSelectedFireId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function AuditTable({ events, isLoading }: { events: AuditEvent[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Empty className="min-h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Activity size={20} /></EmptyMedia>
          <EmptyTitle>Leyendo auditoria</EmptyTitle>
          <EmptyDescription>Consultando cambios operativos reales.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (events.length === 0) {
    return (
      <Empty className="min-h-64">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Activity size={20} /></EmptyMedia>
          <EmptyTitle>Sin eventos</EmptyTitle>
          <EmptyDescription>No hay auditoria para el filtro actual.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Entidad</TableHead>
          <TableHead>Accion</TableHead>
          <TableHead>Operador</TableHead>
          <TableHead>Detalle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>
              <div className="font-medium">{formatDate(event.createdAt)}</div>
              <div className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</div>
            </TableCell>
            <TableCell><Badge variant="outline">{getAuditTypeLabel(event.type)}</Badge></TableCell>
            <TableCell>{event.entityLabel}</TableCell>
            <TableCell>{event.action}</TableCell>
            <TableCell>{event.actor}</TableCell>
            <TableCell className="max-w-md truncate text-muted-foreground">{event.reason || 's/d'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAuditTypeLabel(type: AuditEvent['type']) {
  switch (type) {
    case 'incident':
      return 'Incidente';
    case 'resource':
      return 'Recurso';
    case 'maintenance':
      return 'Mantenimiento';
    case 'asset':
      return 'Activo';
    case 'station':
      return 'Cuartel';
    default:
      return type;
  }
}
