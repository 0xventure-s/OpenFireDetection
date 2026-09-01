import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import {
  ApiResponse,
  AnalysisDashboardResponse,
  AnalysisPeriod,
  AuditEvent,
  CommandDashboardResponse,
  Fire,
  FireAudit,
  FireContextResponse,
  FireFilters,
  FireListResponse,
  FireStation,
  IncidentAssignment,
  IncidentPriority,
  LifecycleStatus,
  MaintenanceRecord,
  OperationalAsset,
  OperationalStatus,
  OperationalUnit,
  ResourceDetail,
  ResourceImportPreview,
  ProvincialOverview,
  ScanStatusResponse,
  ScanTriggerType,
} from '@/types';
import { toast } from 'sonner';

interface FireHistoryResponse {
  fireId: string;
  history: FireAudit[];
}

interface FireStats {
  total: number;
  unconfirmed: number;
  probable: number;
  confirmed: number;
  falsePositive: number;
  extinguished: number;
}

function buildOperatorHeaders() {
  return {};
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return fallback;
}

// Fetch fires
export function useFires(filters?: FireFilters, options?: { fetchAllPages?: boolean }) {
  const fetchAllPages = options?.fetchAllPages ?? false;

  return useQuery({
    queryKey: ['fires', filters, { fetchAllPages }],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.status && filters.status.length > 0) {
        params.append('status', filters.status[0]);
      }

      if (filters?.lifecycle) {
        params.append('lifecycle', filters.lifecycle);
      }

      if (filters?.period && filters.period !== 'all') {
        params.append('period', filters.period);
      }

      if (filters?.timeframe && filters.timeframe !== 'all') {
        const minutesByTimeframe: Record<Exclude<FireFilters['timeframe'], 'all' | undefined>, number> = {
          '30m': 30,
          '1h': 60,
          '3h': 180,
          '24h': 1440,
        };
        const since = new Date(Date.now() - minutesByTimeframe[filters.timeframe] * 60000);
        params.append('since', since.toISOString());
      }

      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.offset) params.append('offset', String(filters.offset));

      const url = `/api/fire/fires${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await axios.get<ApiResponse<FireListResponse>>(url);
      const firstPage = response.data.data as FireListResponse;

      if (!fetchAllPages || firstPage.totalPages <= 1) return firstPage;

      const remainingPages = Array.from({ length: firstPage.totalPages - 1 }, (_, index) => index + 1);
      const pages = await Promise.all(
        remainingPages.map(async (pageIndex) => {
          const pageParams = new URLSearchParams(params);
          pageParams.set('offset', String(pageIndex * firstPage.limit));
          const pageResponse = await axios.get<ApiResponse<FireListResponse>>(`/api/fire/fires?${pageParams.toString()}`);
          return pageResponse.data.data as FireListResponse;
        })
      );

      return {
        ...firstPage,
        items: [firstPage.items, ...pages.map((page) => page.items)].flat(),
        limit: firstPage.total,
        totalPages: 1,
      };
    },
    refetchInterval: fetchAllPages ? false : 60000,
  });
}

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<ProvincialOverview>>('/api/fire/overview');
      return response.data.data as ProvincialOverview;
    },
    refetchInterval: 60000,
  });
}

export function useCommandDashboard() {
  return useQuery({
    queryKey: ['command-dashboard'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<CommandDashboardResponse>>('/api/fire/command');
      return response.data.data as CommandDashboardResponse;
    },
    refetchInterval: 60000,
  });
}

export function useAnalysisDashboard(period: AnalysisPeriod = '30d') {
  return useQuery({
    queryKey: ['analysis-dashboard', period],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<AnalysisDashboardResponse>>(
        `/api/fire/analysis?period=${encodeURIComponent(period)}`
      );
      return response.data.data as AnalysisDashboardResponse;
    },
    refetchInterval: 60000,
  });
}

export function useAuditEvents(filters?: { type?: string; actor?: string; entityId?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['audit-events', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.actor) params.set('actor', filters.actor);
      if (filters?.entityId) params.set('entityId', filters.entityId);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      const response = await axios.get<ApiResponse<{ items: AuditEvent[] }>>(`/api/fire/audit${params.size ? `?${params}` : ''}`);
      return response.data.data?.items || [];
    },
    refetchInterval: 60000,
  });
}

export function useResourceDetail(id: string | null) {
  return useQuery({
    queryKey: ['resource-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await axios.get<ApiResponse<ResourceDetail>>(`/api/fire/resources/${id}`);
      return response.data.data || null;
    },
    enabled: Boolean(id),
  });
}

export function useStations() {
  return useQuery({
    queryKey: ['fire-stations'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<{ items: FireStation[] }>>('/api/fire/stations');
      return response.data.data?.items || [];
    },
    refetchInterval: 60000,
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['operational-units'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<{ items: OperationalUnit[] }>>('/api/fire/units');
      return response.data.data?.items || [];
    },
    refetchInterval: 60000,
  });
}

export function useCreateStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code?: string;
      name: string;
      locality?: string;
      address?: string;
      contact?: string;
      lat?: number;
      lon?: number;
      notes?: string;
    }) => {
      const response = await axios.post<ApiResponse<FireStation>>('/api/fire/stations', data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as FireStation;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Cuartel cargado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al cargar cuartel'));
    },
  });
}

export function useUpdateStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<FireStation> & { id: string }) => {
      const response = await axios.patch<ApiResponse<FireStation>>(`/api/fire/stations/${id}`, data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as FireStation;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Cuartel actualizado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar cuartel'));
    },
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      name: string;
      type: string;
      stationId?: string;
      baseName?: string;
      status?: OperationalUnit['status'];
      contact?: string;
      licensePlate?: string;
      capacityLiters?: number;
      crewCapacity?: number;
      lat?: number;
      lon?: number;
      notes?: string;
      payload?: OperationalUnit['payload'];
    }) => {
      const response = await axios.post<ApiResponse<OperationalUnit>>('/api/fire/units', data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as OperationalUnit;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Movil cargado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al cargar movil'));
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<OperationalUnit> & { id: string }) => {
      const response = await axios.patch<ApiResponse<OperationalUnit>>(`/api/fire/units/${id}`, data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as OperationalUnit;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Movil actualizado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar movil'));
    },
  });
}

export function useCreateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      unitId: string;
      title: string;
      status?: MaintenanceRecord['status'];
      dueAt?: string;
      scheduledAt?: string;
      startedAt?: string;
      odometerKm?: number;
      performedBy?: string;
      notes?: string;
    }) => {
      const { unitId, ...payload } = data;
      const response = await axios.post<ApiResponse<MaintenanceRecord>>(
        `/api/fire/units/${unitId}/maintenance`,
        payload,
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as MaintenanceRecord;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Mantenimiento registrado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al registrar mantenimiento'));
    },
  });
}

export function useUpdateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      unitId: string;
      maintenanceId: string;
      title?: string;
      status?: MaintenanceRecord['status'];
      dueAt?: string | null;
      scheduledAt?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
      odometerKm?: number | null;
      performedBy?: string | null;
      notes?: string | null;
    }) => {
      const { unitId, ...payload } = data;
      const response = await axios.patch<ApiResponse<MaintenanceRecord>>(
        `/api/fire/units/${unitId}/maintenance`,
        payload,
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as MaintenanceRecord;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Mantenimiento actualizado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar mantenimiento'));
    },
  });
}

export function useAssets() {
  return useQuery({
    queryKey: ['operational-assets'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<{ items: OperationalAsset[] }>>('/api/fire/assets');
      return response.data.data?.items || [];
    },
    refetchInterval: 60000,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: OperationalAsset['type'];
      status?: OperationalAsset['status'];
      lat?: number;
      lon?: number;
      notes?: string;
      payload?: OperationalAsset['payload'];
    }) => {
      const response = await axios.post<ApiResponse<OperationalAsset>>('/api/fire/assets', data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as OperationalAsset;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Activo cargado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al cargar activo'));
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<OperationalAsset> & { id: string }) => {
      const response = await axios.patch<ApiResponse<OperationalAsset>>(`/api/fire/assets/${id}`, data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as OperationalAsset;
    },
    onSuccess: () => {
      invalidateResourceQueries(queryClient);
      toast.success('Activo actualizado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar activo'));
    },
  });
}

export function useImportResources() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { content: string; mode: 'validateOnly' | 'commit' }) => {
      const response = await axios.post<ApiResponse<ResourceImportPreview>>('/api/fire/import/resources', data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as ResourceImportPreview;
    },
    onSuccess: (_, variables) => {
      if (variables.mode === 'commit') {
        invalidateResourceQueries(queryClient);
        queryClient.invalidateQueries({ queryKey: ['audit-events'] });
        toast.success('Recursos importados');
      } else {
        toast.success('Archivo validado');
      }
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al importar recursos'));
    },
  });
}

export function useFire(id: string | null) {
  return useQuery({
    queryKey: ['fire', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await axios.get<ApiResponse<{ fire: Fire }>>(`/api/fire/fires/${id}`);
      return response.data.data?.fire || null;
    },
    enabled: !!id,
  });
}

export function useFireHistory(id: string | null) {
  return useQuery({
    queryKey: ['fire-history', id],
    queryFn: async () => {
      if (!id) return [] as FireAudit[];
      const response = await axios.get<ApiResponse<FireHistoryResponse>>(`/api/fire/fires/${id}/history`);
      return response.data.data?.history || [];
    },
    enabled: !!id,
  });
}

export function useFireContext(id: string | null) {
  return useQuery({
    queryKey: ['fire-context', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await axios.get<ApiResponse<FireContextResponse>>(`/api/fire/fires/${id}/context`);
      return response.data.data || null;
    },
    enabled: !!id,
  });
}

export function useCreateFire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      lat: number;
      lon: number;
      detectedAt: Date | string;
      notes?: string;
    }) => {
      const response = await axios.post<ApiResponse<Fire>>('/api/fire/fires', data, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as Fire;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      toast.success('Foco agregado exitosamente');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al agregar foco'));
    },
  });
}

export function useConfirmFire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      confirmed,
      reason,
    }: {
      id: string;
      confirmed: boolean;
      reason?: string;
    }) => {
      const response = await axios.patch<ApiResponse<Fire>>(
        `/api/fire/fires/${id}/confirm`,
        { confirmed, actor: 'operator', reason },
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as Fire;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['fire', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['fire-history', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      toast.success(variables.confirmed ? 'Foco confirmado' : 'Marcado como falso positivo');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar foco'));
    },
  });
}

export function useDeleteFire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.delete<ApiResponse<Fire>>(`/api/fire/fires/${id}`, {
        headers: buildOperatorHeaders(),
      });
      return response.data.data as Fire;
    },
    onSuccess: (_, fireId) => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['fire', fireId] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      toast.success('Incidente archivado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al eliminar foco'));
    },
  });
}

export function useUpdateLifecycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, lifecycleStatus, reason }: { id: string; lifecycleStatus: LifecycleStatus; reason?: string }) => {
      const response = await axios.patch<ApiResponse<Fire>>(
        `/api/fire/fires/${id}/lifecycle`,
        { lifecycleStatus, reason },
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as Fire;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['fire', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['fire-history', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      toast.success(variables.lifecycleStatus === 'active' ? 'Incidente restaurado' : 'Incidente actualizado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar el ciclo de vida'));
    },
  });
}

export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options?: { triggerType?: ScanTriggerType; silent?: boolean }) => {
      const response = await axios.post<ApiResponse<{ summary: string; scanRunId: string; duration: number }>>(
        '/api/fire/scan',
        { triggerType: options?.triggerType || 'manual' },
        { headers: buildOperatorHeaders() }
      );
      return {
        ...response.data.data,
        silent: Boolean(options?.silent),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['scan-status'] });
      if (!data?.silent) {
        toast.success(data?.summary || 'Escaneo completado');
      }
    },
    onError: (error: AxiosError<ApiResponse<never>>, variables) => {
      if (!variables?.silent) {
        toast.error(getApiErrorMessage(error, 'Error al ejecutar escaneo'));
      }
    },
  });
}

export function useScanStatus() {
  return useQuery({
    queryKey: ['scan-status'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<ScanStatusResponse>>('/api/fire/scan/status');
      return response.data.data as ScanStatusResponse;
    },
    refetchInterval: 60000,
  });
}

export function useExtinguishFire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await axios.post<ApiResponse<Fire>>(
        `/api/fire/fires/${id}/extinguish`,
        { reason },
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as Fire;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['fire', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['fire-history', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      toast.success('Incendio marcado como extinguido');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al marcar como extinguido'));
    },
  });
}

export function useAddFireNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const response = await axios.post<ApiResponse<{ fireId: string }>>(
        `/api/fire/fires/${id}/notes`,
        { notes },
        { headers: buildOperatorHeaders() }
      );
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fire-history', variables.id] });
      toast.success('Notas guardadas');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al guardar notas'));
    },
  });
}

export function useOperateFire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      operationalStatus?: OperationalStatus;
      priority?: IncidentPriority;
      assignedUnit?: string;
      assignedTeam?: string;
      reviewed?: boolean;
      dispatch?: boolean;
      riskSummary?: string;
    }) => {
      const { id, ...payload } = data;
      const response = await axios.patch<ApiResponse<Fire>>(
        `/api/fire/fires/${id}/operate`,
        payload,
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as Fire;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fires'] });
      queryClient.invalidateQueries({ queryKey: ['fire', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['fire-history', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
      toast.success('Incidente operativo actualizado');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar el incidente'));
    },
  });
}

export function useAssignIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      fireId: string;
      unitId?: string;
      assetId?: string;
      unitName?: string;
      role?: string;
      status?: IncidentAssignment['status'];
      notes?: string;
    }) => {
      const { fireId, ...payload } = data;
      const response = await axios.post<ApiResponse<IncidentAssignment>>(
        `/api/fire/fires/${fireId}/assignments`,
        payload,
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as IncidentAssignment;
    },
    onSuccess: (_, variables) => {
      invalidateIncidentCommandQueries(queryClient, variables.fireId);
      toast.success('Recurso asignado al incidente');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al asignar recurso'));
    },
  });
}

export function useUpdateIncidentAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      fireId: string;
      assignmentId: string;
      status?: IncidentAssignment['status'];
      notes?: string;
    }) => {
      const { fireId, ...payload } = data;
      const response = await axios.patch<ApiResponse<IncidentAssignment>>(
        `/api/fire/fires/${fireId}/assignments`,
        payload,
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as IncidentAssignment;
    },
    onSuccess: (_, variables) => {
      invalidateIncidentCommandQueries(queryClient, variables.fireId);
      toast.success('Asignacion actualizada');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al actualizar asignacion'));
    },
  });
}

export function useReleaseIncidentAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fireId, assignmentId }: { fireId: string; assignmentId: string }) => {
      const response = await axios.delete<ApiResponse<IncidentAssignment>>(
        `/api/fire/fires/${fireId}/assignments?assignmentId=${encodeURIComponent(assignmentId)}`,
        { headers: buildOperatorHeaders() }
      );
      return response.data.data as IncidentAssignment;
    },
    onSuccess: (_, variables) => {
      invalidateIncidentCommandQueries(queryClient, variables.fireId);
      toast.success('Asignacion liberada');
    },
    onError: (error: AxiosError<ApiResponse<never>>) => {
      toast.error(getApiErrorMessage(error, 'Error al liberar asignacion'));
    },
  });
}

function invalidateIncidentCommandQueries(queryClient: ReturnType<typeof useQueryClient>, fireId: string) {
  queryClient.invalidateQueries({ queryKey: ['fires'] });
  queryClient.invalidateQueries({ queryKey: ['fire', fireId] });
  queryClient.invalidateQueries({ queryKey: ['fire-history', fireId] });
  queryClient.invalidateQueries({ queryKey: ['overview'] });
  queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['operational-units'] });
  queryClient.invalidateQueries({ queryKey: ['fire-stations'] });
  queryClient.invalidateQueries({ queryKey: ['audit-events'] });
  queryClient.invalidateQueries({ queryKey: ['resource-detail'] });
}

function invalidateResourceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['fire-stations'] });
  queryClient.invalidateQueries({ queryKey: ['operational-units'] });
  queryClient.invalidateQueries({ queryKey: ['operational-assets'] });
  queryClient.invalidateQueries({ queryKey: ['command-dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['audit-events'] });
  queryClient.invalidateQueries({ queryKey: ['resource-detail'] });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await axios.get<ApiResponse<FireStats>>('/api/fire/stats');
      return response.data.data as FireStats;
    },
    refetchInterval: 60000,
  });
}
