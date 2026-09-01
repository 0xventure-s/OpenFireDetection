'use client';

import { FormEvent, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Edit3,
  Eye,
  Factory,
  MoreHorizontal,
  Plus,
  Search,
  Truck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CoordinatePickerMap } from '@/components/Map/CoordinatePickerMap';
import {
  assetTypes,
  getAssetStatusLabel,
  getMachinerySubtypeLabel,
  getPayloadNumber,
  getPayloadString,
  getResourcePayload,
  getResourceTypeLabel,
  getUnitStatusLabel,
  getVisibleUnitFields,
  machinerySubtypes,
  parseOptionalInteger,
  parseOptionalNumber,
  vehicleUnitTypes,
} from '@/lib/resource-helpers';
import {
  useAssets,
  useCreateAsset,
  useCreateMaintenanceRecord,
  useCreateStation,
  useCreateUnit,
  useImportResources,
  useResourceDetail,
  useStations,
  useUnits,
  useUpdateAsset,
  useUpdateMaintenanceRecord,
  useUpdateStation,
  useUpdateUnit,
} from '@/hooks/useFires';
import type {
  FireStation,
  MaintenanceRecord,
  OperationalAsset,
  OperationalAssetStatus,
  OperationalAssetType,
  OperationalUnit,
  OperationalUnitStatus,
  OperationalUnitType,
  ResourceDetail,
  ResourceImportPreview,
} from '@/types';

const unitStatuses: Array<[OperationalUnitStatus, string]> = [
  ['available', 'Disponible'],
  ['assigned', 'Asignado'],
  ['maintenance', 'Mantenimiento'],
  ['unavailable', 'Fuera de servicio'],
];

const resourceSheetClassName = 'w-full overflow-y-auto sm:max-w-3xl';
const resourceFormClassName = 'grid gap-5 py-4';
const resourceFieldGroupClassName = 'px-5';
const resourceFieldGridClassName = 'grid gap-x-5 gap-y-4 sm:grid-cols-2';

const assetStatuses: Array<[OperationalAssetStatus, string]> = [
  ['available', 'Disponible'],
  ['unknown', 'Sin verificar'],
  ['unavailable', 'No disponible'],
];

type StationForm = {
  code: string;
  name: string;
  locality: string;
  address: string;
  contact: string;
  lat: string;
  lon: string;
  notes: string;
};

type UnitForm = {
  code: string;
  name: string;
  type: OperationalUnitType;
  stationId: string;
  baseName: string;
  status: OperationalUnitStatus;
  contact: string;
  licensePlate: string;
  capacityLiters: string;
  crewCapacity: string;
  lat: string;
  lon: string;
  notes: string;
  internalCode: string;
  serialNumber: string;
  engineHours: string;
  machinerySubtype: string;
};

type AssetForm = {
  name: string;
  type: OperationalAssetType;
  status: OperationalAssetStatus;
  capacityLiters: string;
  lat: string;
  lon: string;
  accessNotes: string;
  notes: string;
};

type MaintenanceForm = {
  unitId: string;
  title: string;
  status: MaintenanceRecord['status'];
  dueAt: string;
  odometerKm: string;
  performedBy: string;
  notes: string;
};

type ResourceSheet = 'vehicle' | 'machinery' | 'asset' | 'station' | null;

const emptyStationForm: StationForm = {
  code: '',
  name: '',
  locality: '',
  address: '',
  contact: '',
  lat: '',
  lon: '',
  notes: '',
};

const emptyUnitForm: UnitForm = {
  code: '',
  name: '',
  type: 'engine',
  stationId: '',
  baseName: '',
  status: 'available',
  contact: '',
  licensePlate: '',
  capacityLiters: '',
  crewCapacity: '',
  lat: '',
  lon: '',
  notes: '',
  internalCode: '',
  serialNumber: '',
  engineHours: '',
  machinerySubtype: 'topadora',
};

const emptyAssetForm: AssetForm = {
  name: '',
  type: 'water_tank',
  status: 'unknown',
  capacityLiters: '',
  lat: '',
  lon: '',
  accessNotes: '',
  notes: '',
};

const emptyMaintenanceForm: MaintenanceForm = {
  unitId: '',
  title: '',
  status: 'scheduled',
  dueAt: '',
  odometerKm: '',
  performedBy: '',
  notes: '',
};

export function ResourceManagementPanel() {
  const { data: stations = [] } = useStations();
  const { data: units = [] } = useUnits();
  const { data: assets = [] } = useAssets();
  const createStation = useCreateStation();
  const updateStation = useUpdateStation();
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const importResources = useImportResources();
  const [sheet, setSheet] = useState<ResourceSheet>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importPreview, setImportPreview] = useState<ResourceImportPreview | null>(null);
  const [stationForm, setStationForm] = useState<StationForm>(emptyStationForm);
  const [unitForm, setUnitForm] = useState<UnitForm>(emptyUnitForm);
  const [assetForm, setAssetForm] = useState<AssetForm>(emptyAssetForm);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const vehicleUnits = useMemo(() => units.filter((unit) => unit.type !== 'machinery'), [units]);
  const machineryUnits = useMemo(() => units.filter((unit) => unit.type === 'machinery'), [units]);
  const filteredVehicles = useMemo(() => filterUnits(vehicleUnits, search, statusFilter), [search, statusFilter, vehicleUnits]);
  const filteredMachinery = useMemo(() => filterUnits(machineryUnits, search, statusFilter), [machineryUnits, search, statusFilter]);
  const filteredAssets = useMemo(() => filterAssets(assets, search, statusFilter), [assets, search, statusFilter]);
  const filteredStations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stations;
    return stations.filter((station) => [station.code || '', station.name, station.locality || '', station.address || '', station.contact || ''].join(' ').toLowerCase().includes(query));
  }, [search, stations]);

  const summary = useMemo(() => ({
    available: units.filter((unit) => unit.status === 'available').length,
    assigned: units.filter((unit) => unit.status === 'assigned').length,
    maintenance: units.filter((unit) => unit.status === 'maintenance').length,
  }), [units]);

  const handleStationSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!stationForm.name.trim()) {
      toast.error('El cuartel necesita nombre real.');
      return;
    }
    const payload = {
      code: optionalString(stationForm.code),
      name: stationForm.name.trim(),
      locality: optionalString(stationForm.locality),
      address: optionalString(stationForm.address),
      contact: optionalString(stationForm.contact),
      lat: optionalNumber(stationForm.lat),
      lon: optionalNumber(stationForm.lon),
      notes: optionalString(stationForm.notes),
    };
    if (editingStationId) {
      updateStation.mutate({ id: editingStationId, ...payload }, { onSuccess: closeSheet });
    } else {
      createStation.mutate(payload, { onSuccess: closeSheet });
    }
  };

  const handleUnitSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!unitForm.code.trim() || !unitForm.name.trim()) {
      toast.error('El recurso necesita codigo y nombre reales.');
      return;
    }
    const isMachinery = unitForm.type === 'machinery';
    const payload = {
      code: unitForm.code.trim(),
      name: unitForm.name.trim(),
      type: unitForm.type,
      stationId: optionalString(unitForm.stationId),
      baseName: optionalString(unitForm.baseName),
      status: unitForm.status,
      contact: optionalString(unitForm.contact),
      licensePlate: isMachinery ? '' : optionalString(unitForm.licensePlate),
      capacityLiters: isMachinery ? undefined : optionalInteger(unitForm.capacityLiters),
      crewCapacity: isMachinery ? undefined : optionalInteger(unitForm.crewCapacity),
      lat: optionalNumber(unitForm.lat),
      lon: optionalNumber(unitForm.lon),
      notes: optionalString(unitForm.notes),
      payload: buildUnitPayload(unitForm),
    };
    if (editingUnitId) {
      updateUnit.mutate({ id: editingUnitId, ...payload }, { onSuccess: closeSheet });
    } else {
      createUnit.mutate(payload, { onSuccess: closeSheet });
    }
  };

  const handleAssetSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!assetForm.name.trim()) {
      toast.error('El activo necesita nombre real.');
      return;
    }
    const payload = {
      name: assetForm.name.trim(),
      type: assetForm.type,
      status: assetForm.status,
      lat: optionalNumber(assetForm.lat),
      lon: optionalNumber(assetForm.lon),
      notes: optionalString(assetForm.notes),
      payload: buildAssetPayload(assetForm),
    };
    if (editingAssetId) {
      updateAsset.mutate({ id: editingAssetId, ...payload }, { onSuccess: closeSheet });
    } else {
      createAsset.mutate(payload, { onSuccess: closeSheet });
    }
  };

  const openNewVehicle = () => {
    setEditingUnitId(null);
    setUnitForm({ ...emptyUnitForm, type: 'engine' });
    setSheet('vehicle');
  };

  const openNewMachinery = () => {
    setEditingUnitId(null);
    setUnitForm({ ...emptyUnitForm, type: 'machinery', machinerySubtype: 'topadora' });
    setSheet('machinery');
  };

  const openEditUnit = (unit: OperationalUnit) => {
    setEditingUnitId(unit.id);
    setUnitForm(toUnitForm(unit));
    setSheet(unit.type === 'machinery' ? 'machinery' : 'vehicle');
  };

  const openNewAsset = () => {
    setEditingAssetId(null);
    setAssetForm(emptyAssetForm);
    setSheet('asset');
  };

  const openEditAsset = (asset: OperationalAsset) => {
    setEditingAssetId(asset.id);
    setAssetForm(toAssetForm(asset));
    setSheet('asset');
  };

  const openNewStation = () => {
    setEditingStationId(null);
    setStationForm(emptyStationForm);
    setSheet('station');
  };

  const openEditStation = (station: FireStation) => {
    setEditingStationId(station.id);
    setStationForm(toStationForm(station));
    setSheet('station');
  };

  const closeSheet = () => {
    setSheet(null);
    setEditingStationId(null);
    setEditingUnitId(null);
    setEditingAssetId(null);
    setStationForm(emptyStationForm);
    setUnitForm(emptyUnitForm);
    setAssetForm(emptyAssetForm);
  };

  const openDetail = (id: string) => setDetailId(id);

  const handleImport = (mode: 'validateOnly' | 'commit') => {
    if (!importContent.trim()) {
      toast.error('Carga o pega un CSV real antes de importar.');
      return;
    }
    importResources.mutate(
      { content: importContent, mode },
      {
        onSuccess: (preview) => {
          setImportPreview(preview);
          if (mode === 'commit' && preview.invalid === 0) {
            setImportOpen(false);
            setImportContent('');
          }
        },
      }
    );
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Recursos</p>
          <h2 className="text-2xl font-semibold tracking-tight">Parque operativo</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Inventario real para despacho: moviles, maquinaria, agua, activos y cuarteles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload />Importar CSV</Button>
          <Button variant="outline" onClick={openNewStation}><Building2 />Nuevo cuartel</Button>
          <Button variant="outline" onClick={openNewMachinery}><Factory />Nueva maquinaria</Button>
          <Button variant="outline" onClick={openNewAsset}><Droplets />Nuevo activo</Button>
          <Button onClick={openNewVehicle}><Plus />Nuevo movil</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Moviles" value={vehicleUnits.length} icon={<Truck className="size-4" />} />
        <SummaryCard label="Maquinaria" value={machineryUnits.length} icon={<Factory className="size-4" />} />
        <SummaryCard label="Activos agua" value={assets.length} icon={<Droplets className="size-4" />} />
        <SummaryCard label="Disponibles" value={summary.available} tone="success" />
        <SummaryCard label="En taller" value={summary.maintenance} tone="warning" />
      </div>

      <Card className="command-card-modern">
        <CardHeader className="border-b">
          <CardTitle>Gestion operativa</CardTitle>
          <CardDescription>Tablas reales, filtros y acciones por recurso. Las altas y ediciones se hacen en panel lateral.</CardDescription>
          <CardAction className="flex items-center gap-2">
            <label className="relative min-w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" placeholder="Buscar recurso" />
            </label>
            <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <NativeSelectOption value="all">Todos</NativeSelectOption>
              {unitStatuses.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
              {assetStatuses.map(([value, label]) => <NativeSelectOption key={`asset-${value}`} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="vehicles" className="gap-4">
            <TabsList className="w-full justify-start overflow-x-auto" variant="line">
              <TabsTrigger value="vehicles">Unidades moviles</TabsTrigger>
              <TabsTrigger value="machinery">Maquinaria</TabsTrigger>
              <TabsTrigger value="assets">Agua y activos</TabsTrigger>
              <TabsTrigger value="stations">Cuarteles</TabsTrigger>
            </TabsList>

            <TabsContent value="vehicles">
              <UnitsTable
                units={filteredVehicles}
                emptyTitle="Sin unidades moviles"
                emptyDescription="Carga autobombas, camiones cisterna, forestales, camionetas o apoyo real."
                onCreate={openNewVehicle}
                onView={openDetail}
                onEdit={openEditUnit}
                onSetAvailable={(unit) => updateUnit.mutate({ id: unit.id, status: 'available' })}
                onSetUnavailable={(unit) => updateUnit.mutate({ id: unit.id, status: 'unavailable' })}
              />
            </TabsContent>

            <TabsContent value="machinery">
              <MachineryTable
                units={filteredMachinery}
                onCreate={openNewMachinery}
                onView={openDetail}
                onEdit={openEditUnit}
                onSetAvailable={(unit) => updateUnit.mutate({ id: unit.id, status: 'available' })}
                onSetUnavailable={(unit) => updateUnit.mutate({ id: unit.id, status: 'unavailable' })}
              />
            </TabsContent>

            <TabsContent value="assets">
              <AssetsTable assets={filteredAssets} onCreate={openNewAsset} onView={openDetail} onEdit={openEditAsset} />
            </TabsContent>

            <TabsContent value="stations">
              <StationsTable stations={filteredStations} onCreate={openNewStation} onView={openDetail} onEdit={openEditStation} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Sheet open={sheet === 'vehicle'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className={resourceSheetClassName}>
          <SheetHeader>
            <SheetTitle>{editingUnitId ? 'Editar movil' : 'Nuevo movil'}</SheetTitle>
            <SheetDescription>Autobombas, camiones cisterna, forestales, camionetas y apoyo. Si es vehiculo puede tener patente.</SheetDescription>
          </SheetHeader>
          <UnitFormView form={unitForm} stations={stations} mode="vehicle" onChange={setUnitForm} onSubmit={handleUnitSubmit} pending={createUnit.isPending || updateUnit.isPending} submitLabel={editingUnitId ? 'Guardar cambios' : 'Cargar movil'} />
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'machinery'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className={resourceSheetClassName}>
          <SheetHeader>
            <SheetTitle>{editingUnitId ? 'Editar maquinaria' : 'Nueva maquinaria'}</SheetTitle>
            <SheetDescription>Maquinaria no vehicular. No se solicita patente, litros ni dotacion.</SheetDescription>
          </SheetHeader>
          <UnitFormView form={unitForm} stations={stations} mode="machinery" onChange={setUnitForm} onSubmit={handleUnitSubmit} pending={createUnit.isPending || updateUnit.isPending} submitLabel={editingUnitId ? 'Guardar cambios' : 'Cargar maquinaria'} />
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'asset'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className={resourceSheetClassName}>
          <SheetHeader>
            <SheetTitle>{editingAssetId ? 'Editar activo' : 'Nuevo activo'}</SheetTitle>
            <SheetDescription>Cisternas/tanques, fuentes de agua, helipuntos, accesos y puntos de espera. No tienen patente.</SheetDescription>
          </SheetHeader>
          <AssetFormView form={assetForm} onChange={setAssetForm} onSubmit={handleAssetSubmit} pending={createAsset.isPending || updateAsset.isPending} submitLabel={editingAssetId ? 'Guardar cambios' : 'Cargar activo'} />
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'station'} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className={resourceSheetClassName}>
          <SheetHeader>
            <SheetTitle>{editingStationId ? 'Editar cuartel' : 'Nuevo cuartel'}</SheetTitle>
            <SheetDescription>Bases operativas con ubicacion, contacto y notas reales.</SheetDescription>
          </SheetHeader>
          <StationFormView form={stationForm} onChange={setStationForm} onSubmit={handleStationSubmit} pending={createStation.isPending || updateStation.isPending} submitLabel={editingStationId ? 'Guardar cambios' : 'Cargar cuartel'} />
        </SheetContent>
      </Sheet>

      <ResourceDetailSheet id={detailId} onClose={() => setDetailId(null)} />

      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent className={resourceSheetClassName}>
          <SheetHeader>
            <SheetTitle>Importar recursos reales</SheetTitle>
            <SheetDescription>CSV exportado desde Excel o planilla. No crea datos al validar.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-5 py-4">
            <Field>
              <FieldLabel>Archivo CSV</FieldLabel>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  file.text().then((text) => {
                    setImportContent(text);
                    setImportPreview(null);
                  });
                }}
              />
            </Field>
            <FormField label="Contenido">
              <Textarea
                value={importContent}
                onChange={(event) => {
                  setImportContent(event.target.value);
                  setImportPreview(null);
                }}
                className="min-h-48"
                placeholder="category,code,name,type,status..."
              />
            </FormField>
            {importPreview ? <ImportPreview preview={importPreview} /> : null}
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => handleImport('validateOnly')} disabled={importResources.isPending}>Validar</Button>
            <Button type="button" onClick={() => handleImport('commit')} disabled={importResources.isPending || Boolean(importPreview && importPreview.invalid > 0)}>Importar reales</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

export function MaintenanceManagementPanel() {
  const { data: units = [] } = useUnits();
  const createMaintenance = useCreateMaintenanceRecord();
  const updateMaintenance = useUpdateMaintenanceRecord();
  const [form, setForm] = useState<MaintenanceForm>(emptyMaintenanceForm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const records = useMemo(() => {
    const allRecords = units
      .flatMap((unit) => (unit.maintenanceRecords || []).map((record) => ({ ...record, unit })))
      .sort(compareMaintenanceRecords);
    if (statusFilter === 'all') return allRecords;
    if (statusFilter === 'open') return allRecords.filter((record) => record.status === 'scheduled' || record.status === 'in_progress');
    if (statusFilter === 'overdue') return allRecords.filter((record) => getMaintenanceDueLabel(record).startsWith('Vencido'));
    if (statusFilter === 'due_soon') return allRecords.filter((record) => {
      const label = getMaintenanceDueLabel(record);
      return label === 'Vence hoy' || label.startsWith('Vence en');
    });
    return allRecords.filter((record) => record.status === statusFilter);
  }, [statusFilter, units]);
  const overdueCount = records.filter((record) => getMaintenanceDueLabel(record).startsWith('Vencido')).length;
  const inProgressCount = records.filter((record) => record.status === 'in_progress').length;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.unitId || !form.title.trim()) {
      toast.error('Selecciona un movil y un trabajo real.');
      return;
    }
    createMaintenance.mutate(
      {
        unitId: form.unitId,
        title: form.title.trim(),
        status: form.status,
        dueAt: optionalDate(form.dueAt),
        odometerKm: optionalInteger(form.odometerKm),
        performedBy: optionalString(form.performedBy),
        notes: optionalString(form.notes),
      },
      {
        onSuccess: () => {
          setSheetOpen(false);
          setForm(emptyMaintenanceForm);
        },
      }
    );
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Mantenimiento</p>
          <h2 className="text-2xl font-semibold tracking-tight">Taller y disponibilidad</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Trabajos abiertos, vencimientos y vuelta a servicio de cada movil.</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} disabled={units.length === 0}><Plus />Registrar mantenimiento</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Abiertos" value={records.length} icon={<ClipboardList className="size-4" />} />
        <SummaryCard label="Vencidos" value={overdueCount} tone={overdueCount > 0 ? 'danger' : 'success'} />
        <SummaryCard label="En taller" value={inProgressCount} tone="warning" />
        <SummaryCard label="Moviles" value={units.length} />
      </div>

    <Card className="command-card-modern">
        <CardHeader className="border-b">
          <CardTitle>Mantenimiento abierto</CardTitle>
          <CardDescription>{records.length} trabajos segun el filtro seleccionado.</CardDescription>
          <CardAction>
            <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <NativeSelectOption value="open">Abiertos</NativeSelectOption>
              <NativeSelectOption value="overdue">Vencidos</NativeSelectOption>
              <NativeSelectOption value="due_soon">Proximos</NativeSelectOption>
              <NativeSelectOption value="in_progress">En curso</NativeSelectOption>
              <NativeSelectOption value="completed">Completados</NativeSelectOption>
              <NativeSelectOption value="cancelled">Cancelados</NativeSelectOption>
              <NativeSelectOption value="all">Todos cargados</NativeSelectOption>
            </NativeSelect>
          </CardAction>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <DesignedEmpty icon={<AlertTriangle className="size-4" />} title="No hay moviles cargados" description="Primero carga el parque operativo real desde Recursos." />
          ) : records.length === 0 ? (
            <DesignedEmpty icon={<CheckCircle2 className="size-4" />} title="Sin mantenimiento abierto" description="Cuando cargues trabajos reales, aparecen aca por vencimiento y estado." action={<Button onClick={() => setSheetOpen(true)}><Plus />Registrar mantenimiento</Button>} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajo</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.title}</div>
                      <div className="text-xs text-muted-foreground">{record.performedBy || 'Sin responsable'}</div>
                    </TableCell>
                    <TableCell>{record.unit?.name || 'Movil'}</TableCell>
                    <TableCell><MaintenanceBadge status={record.status} /></TableCell>
                    <TableCell><span className={getMaintenanceDueLabel(record).startsWith('Vencido') ? 'text-destructive' : ''}>{record.dueAt ? `${formatDateOnly(record.dueAt)} / ${getMaintenanceDueLabel(record)}` : 'Sin fecha'}</span></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Acciones de mantenimiento"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          {record.status !== 'in_progress' ? (
                            <DropdownMenuItem onClick={() => updateMaintenance.mutate({ unitId: record.unitId, maintenanceId: record.id, status: 'in_progress' })}>Marcar en taller</DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => updateMaintenance.mutate({ unitId: record.unitId, maintenanceId: record.id, status: 'completed' })}>Marcar listo</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateMaintenance.mutate({ unitId: record.unitId, maintenanceId: record.id, status: 'completed' })}>Volver a servicio</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => updateMaintenance.mutate({ unitId: record.unitId, maintenanceId: record.id, status: 'cancelled' })}>Cancelar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className={resourceSheetClassName}>
          <SheetHeader>
            <SheetTitle>Registrar mantenimiento</SheetTitle>
            <SheetDescription>Agenda taller, service o vuelta a servicio con datos reales.</SheetDescription>
          </SheetHeader>
          <form className={resourceFormClassName} onSubmit={handleSubmit}>
            <FieldGroup className={resourceFieldGroupClassName}>
              <FormField label="Movil">
                <NativeSelect value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })} className="w-full">
                  <NativeSelectOption value="">Seleccionar movil real</NativeSelectOption>
                  {units.map((unit) => <NativeSelectOption key={unit.id} value={unit.id}>{unit.name} ({getUnitStatusLabel(unit.status)})</NativeSelectOption>)}
                </NativeSelect>
              </FormField>
              <FormField label="Trabajo">
                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Cambio de bomba, service, cubiertas" />
              </FormField>
              <div className={resourceFieldGridClassName}>
                <FormField label="Estado">
                  <NativeSelect value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MaintenanceRecord['status'] })} className="w-full">
                    <NativeSelectOption value="scheduled">Programado</NativeSelectOption>
                    <NativeSelectOption value="in_progress">En taller</NativeSelectOption>
                    <NativeSelectOption value="completed">Completado</NativeSelectOption>
                    <NativeSelectOption value="cancelled">Cancelado</NativeSelectOption>
                  </NativeSelect>
                </FormField>
                <FormField label="Vence">
                  <Input type="date" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
                </FormField>
                <FormField label="Kilometraje">
                  <Input value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: event.target.value })} placeholder="120000" />
                </FormField>
                <FormField label="Responsable">
                  <Input value={form.performedBy} onChange={(event) => setForm({ ...form, performedBy: event.target.value })} placeholder="Taller / mecanico" />
                </FormField>
              </div>
              <FormField label="Notas">
                <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Detalle del trabajo o repuesto" />
              </FormField>
            </FieldGroup>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMaintenance.isPending}><Plus />Registrar</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function UnitsTable({
  units,
  emptyTitle,
  emptyDescription,
  onCreate,
  onView,
  onEdit,
  onSetAvailable,
  onSetUnavailable,
}: {
  units: OperationalUnit[];
  emptyTitle: string;
  emptyDescription: string;
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (unit: OperationalUnit) => void;
  onSetAvailable: (unit: OperationalUnit) => void;
  onSetUnavailable: (unit: OperationalUnit) => void;
}) {
  if (units.length === 0) {
    return <DesignedEmpty icon={<Truck className="size-4" />} title={emptyTitle} description={emptyDescription} action={<Button onClick={onCreate}><Plus />Cargar movil</Button>} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Movil</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Cuartel</TableHead>
          <TableHead>Capacidad</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {units.map((unit) => (
          <TableRow key={unit.id}>
            <TableCell>
              <div className="font-medium">{unit.name}</div>
              <div className="text-xs text-muted-foreground">{unit.code} / {unit.licensePlate || 'Sin patente'}</div>
            </TableCell>
            <TableCell>{getResourceTypeLabel(unit.type)}</TableCell>
            <TableCell><UnitStatusBadge status={unit.status} /></TableCell>
            <TableCell>{unit.station?.name || unit.baseName || 'Sin cuartel'}</TableCell>
              <TableCell>{formatMeasure(unit.capacityLiters, 'L')}</TableCell>
            <TableCell className="text-right"><ResourceRowActions onView={() => onView(unit.id)} onEdit={() => onEdit(unit)} onSetAvailable={() => onSetAvailable(unit)} onSetUnavailable={() => onSetUnavailable(unit)} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MachineryTable({
  units,
  onCreate,
  onView,
  onEdit,
  onSetAvailable,
  onSetUnavailable,
}: {
  units: OperationalUnit[];
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (unit: OperationalUnit) => void;
  onSetAvailable: (unit: OperationalUnit) => void;
  onSetUnavailable: (unit: OperationalUnit) => void;
}) {
  if (units.length === 0) {
    return <DesignedEmpty icon={<Factory className="size-4" />} title="Sin maquinaria" description="Carga topadoras, retros, motoniveladoras, bombas/generadores u otra maquinaria real." action={<Button onClick={onCreate}><Plus />Cargar maquinaria</Button>} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Maquinaria</TableHead>
          <TableHead>Subtipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Base</TableHead>
          <TableHead>Uso</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {units.map((unit) => {
          const payload = getResourcePayload(unit.payload);
          return (
            <TableRow key={unit.id}>
              <TableCell>
                <div className="font-medium">{unit.name}</div>
                <div className="text-xs text-muted-foreground">{unit.code} / {getPayloadString(payload, 'internalCode') || 'Sin interno'}</div>
              </TableCell>
              <TableCell>{getMachinerySubtypeLabel(getPayloadString(payload, 'subtype'))}</TableCell>
              <TableCell><UnitStatusBadge status={unit.status} /></TableCell>
              <TableCell>{unit.station?.name || unit.baseName || 'Sin base'}</TableCell>
              <TableCell>{formatMeasure(getPayloadNumber(payload, 'engineHours'), 'h')}</TableCell>
              <TableCell className="text-right"><ResourceRowActions onView={() => onView(unit.id)} onEdit={() => onEdit(unit)} onSetAvailable={() => onSetAvailable(unit)} onSetUnavailable={() => onSetUnavailable(unit)} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function AssetsTable({ assets, onCreate, onView, onEdit }: { assets: OperationalAsset[]; onCreate: () => void; onView: (id: string) => void; onEdit: (asset: OperationalAsset) => void }) {
  if (assets.length === 0) {
    return <DesignedEmpty icon={<Droplets className="size-4" />} title="Sin activos cargados" description="Carga cisternas/tanques, fuentes de agua, accesos o helipuntos reales." action={<Button onClick={onCreate}><Plus />Cargar activo</Button>} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Activo</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Capacidad</TableHead>
          <TableHead>Ubicacion</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const payload = getResourcePayload(asset.payload);
          return (
            <TableRow key={asset.id}>
              <TableCell>
                <div className="font-medium">{asset.name}</div>
                <div className="text-xs text-muted-foreground">{getPayloadString(payload, 'accessNotes') || asset.notes || 'Sin notas'}</div>
              </TableCell>
              <TableCell>{getResourceTypeLabel(asset.type)}</TableCell>
              <TableCell><AssetStatusBadge status={asset.status} /></TableCell>
              <TableCell>{formatMeasure(getPayloadNumber(payload, 'capacityLiters'), 'L')}</TableCell>
              <TableCell>{typeof asset.lat === 'number' && typeof asset.lon === 'number' ? `${asset.lat.toFixed(3)}, ${asset.lon.toFixed(3)}` : 's/d'}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onView(asset.id)}><Eye />Ver detalle</Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(asset)}><Edit3 />Editar</Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function StationsTable({ stations, onCreate, onView, onEdit }: { stations: FireStation[]; onCreate: () => void; onView: (id: string) => void; onEdit: (station: FireStation) => void }) {
  if (stations.length === 0) {
    return <DesignedEmpty icon={<Building2 className="size-4" />} title="Sin cuarteles cargados" description="Carga bases reales con ubicacion, localidad y contacto operativo." action={<Button onClick={onCreate}><Plus />Cargar cuartel</Button>} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cuartel</TableHead>
          <TableHead>Localidad</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Ubicacion</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stations.map((station) => (
          <TableRow key={station.id}>
            <TableCell>
              <div className="font-medium">{station.name}</div>
              <div className="text-xs text-muted-foreground">{station.code || 'Sin codigo'}</div>
            </TableCell>
            <TableCell>{station.locality || station.address || 's/d'}</TableCell>
            <TableCell>{station.contact || 's/d'}</TableCell>
            <TableCell>{typeof station.lat === 'number' && typeof station.lon === 'number' ? `${station.lat.toFixed(3)}, ${station.lon.toFixed(3)}` : 's/d'}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => onView(station.id)}><Eye />Ver detalle</Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(station)}><Edit3 />Editar</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function UnitFormView({
  form,
  stations,
  mode,
  onChange,
  onSubmit,
  pending,
  submitLabel,
}: {
  form: UnitForm;
  stations: FireStation[];
  mode: 'vehicle' | 'machinery';
  onChange: (form: UnitForm) => void;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
  submitLabel: string;
}) {
  const fields = getVisibleUnitFields(form.type);
  const isMachinery = mode === 'machinery';

  return (
    <form className={resourceFormClassName} onSubmit={onSubmit}>
      <FieldGroup className={resourceFieldGroupClassName}>
        <div className={resourceFieldGridClassName}>
          <FormField label="Codigo"><Input value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder={isMachinery ? 'MQ-01' : 'M-01'} /></FormField>
          <FormField label="Nombre"><Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder={isMachinery ? 'Topadora 1' : 'Autobomba 1'} /></FormField>
          {isMachinery ? (
            <FormField label="Subtipo">
              <NativeSelect value={form.machinerySubtype} onChange={(event) => onChange({ ...form, machinerySubtype: event.target.value })} className="w-full">
                {machinerySubtypes.map((value) => <NativeSelectOption key={value} value={value}>{getMachinerySubtypeLabel(value)}</NativeSelectOption>)}
              </NativeSelect>
            </FormField>
          ) : (
            <FormField label="Tipo">
              <NativeSelect value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value as OperationalUnitType })} className="w-full">
                {vehicleUnitTypes.map((value) => <NativeSelectOption key={value} value={value}>{getResourceTypeLabel(value)}</NativeSelectOption>)}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Estado">
            <NativeSelect value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as OperationalUnitStatus })} className="w-full">
              {unitStatuses.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </FormField>
          <FormField label="Cuartel / base">
            <NativeSelect value={form.stationId} onChange={(event) => onChange({ ...form, stationId: event.target.value })} className="w-full">
              <NativeSelectOption value="">Sin cuartel asignado</NativeSelectOption>
              {stations.map((station) => <NativeSelectOption key={station.id} value={station.id}>{station.name}</NativeSelectOption>)}
            </NativeSelect>
          </FormField>
          {fields.licensePlate ? <FormField label="Patente"><Input value={form.licensePlate} onChange={(event) => onChange({ ...form, licensePlate: event.target.value })} placeholder="AA000AA" /></FormField> : null}
          {fields.capacityLiters ? <FormField label="Litros"><Input value={form.capacityLiters} onChange={(event) => onChange({ ...form, capacityLiters: event.target.value })} placeholder="3000" /></FormField> : null}
          {fields.crewCapacity ? <FormField label="Dotacion"><Input value={form.crewCapacity} onChange={(event) => onChange({ ...form, crewCapacity: event.target.value })} placeholder="5" /></FormField> : null}
          {fields.internalCode ? <FormField label="Numero interno"><Input value={form.internalCode} onChange={(event) => onChange({ ...form, internalCode: event.target.value })} placeholder="INT-01" /></FormField> : null}
          {fields.serialNumber ? <FormField label="Serie"><Input value={form.serialNumber} onChange={(event) => onChange({ ...form, serialNumber: event.target.value })} placeholder="Serie / chasis" /></FormField> : null}
          {fields.engineHours ? <FormField label="Horas de uso"><Input value={form.engineHours} onChange={(event) => onChange({ ...form, engineHours: event.target.value })} placeholder="1200" /></FormField> : null}
          <FormField label="Latitud"><Input value={form.lat} onChange={(event) => onChange({ ...form, lat: event.target.value })} placeholder="-28.46" /></FormField>
          <FormField label="Longitud"><Input value={form.lon} onChange={(event) => onChange({ ...form, lon: event.target.value })} placeholder="-65.78" /></FormField>
        </div>
        <CoordinatePickerMap lat={form.lat} lon={form.lon} onChange={(coords) => onChange({ ...form, ...coords })} />
        <FormField label="Contacto / radio"><Input value={form.contact} onChange={(event) => onChange({ ...form, contact: event.target.value })} placeholder="Canal, telefono o guardia" /></FormField>
        <FormField label="Notas"><Textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Estado mecanico, equipo, observaciones" /></FormField>
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}><Plus />{submitLabel}</Button>
      </SheetFooter>
    </form>
  );
}

function AssetFormView({ form, onChange, onSubmit, pending, submitLabel }: { form: AssetForm; onChange: (form: AssetForm) => void; onSubmit: (event: FormEvent) => void; pending: boolean; submitLabel: string }) {
  const showCapacity = form.type === 'water_tank' || form.type === 'water_source';
  return (
    <form className={resourceFormClassName} onSubmit={onSubmit}>
      <FieldGroup className={resourceFieldGroupClassName}>
        <div className={resourceFieldGridClassName}>
          <FormField label="Nombre"><Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Cisterna norte" /></FormField>
          <FormField label="Tipo">
            <NativeSelect value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value as OperationalAssetType })} className="w-full">
              {assetTypes.map((value) => <NativeSelectOption key={value} value={value}>{getResourceTypeLabel(value)}</NativeSelectOption>)}
            </NativeSelect>
          </FormField>
          <FormField label="Estado">
            <NativeSelect value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as OperationalAssetStatus })} className="w-full">
              {assetStatuses.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </FormField>
          {showCapacity ? <FormField label="Capacidad litros"><Input value={form.capacityLiters} onChange={(event) => onChange({ ...form, capacityLiters: event.target.value })} placeholder="10000" /></FormField> : null}
          <FormField label="Latitud"><Input value={form.lat} onChange={(event) => onChange({ ...form, lat: event.target.value })} placeholder="-28.46" /></FormField>
          <FormField label="Longitud"><Input value={form.lon} onChange={(event) => onChange({ ...form, lon: event.target.value })} placeholder="-65.78" /></FormField>
        </div>
        <CoordinatePickerMap lat={form.lat} lon={form.lon} onChange={(coords) => onChange({ ...form, ...coords })} />
        <FormField label="Acceso"><Input value={form.accessNotes} onChange={(event) => onChange({ ...form, accessNotes: event.target.value })} placeholder="Camino, tranquera, referencia operativa" /></FormField>
        <FormField label="Notas"><Textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Observaciones reales" /></FormField>
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}><Plus />{submitLabel}</Button>
      </SheetFooter>
    </form>
  );
}

function StationFormView({ form, onChange, onSubmit, pending, submitLabel }: { form: StationForm; onChange: (form: StationForm) => void; onSubmit: (event: FormEvent) => void; pending: boolean; submitLabel: string }) {
  return (
    <form className={resourceFormClassName} onSubmit={onSubmit}>
      <FieldGroup className={resourceFieldGroupClassName}>
        <div className={resourceFieldGridClassName}>
          <FormField label="Codigo"><Input value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder="CBA-01" /></FormField>
          <FormField label="Nombre"><Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Cuartel Capital" /></FormField>
          <FormField label="Localidad"><Input value={form.locality} onChange={(event) => onChange({ ...form, locality: event.target.value })} placeholder="San Fernando" /></FormField>
          <FormField label="Contacto"><Input value={form.contact} onChange={(event) => onChange({ ...form, contact: event.target.value })} placeholder="Telefono o radio" /></FormField>
          <FormField label="Latitud"><Input value={form.lat} onChange={(event) => onChange({ ...form, lat: event.target.value })} placeholder="-28.46" /></FormField>
          <FormField label="Longitud"><Input value={form.lon} onChange={(event) => onChange({ ...form, lon: event.target.value })} placeholder="-65.78" /></FormField>
        </div>
        <CoordinatePickerMap lat={form.lat} lon={form.lon} onChange={(coords) => onChange({ ...form, ...coords })} />
        <FormField label="Direccion"><Input value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} placeholder="Direccion real" /></FormField>
        <FormField label="Notas"><Textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Observaciones operativas" /></FormField>
      </FieldGroup>
      <SheetFooter>
        <Button type="submit" disabled={pending}><Plus />{submitLabel}</Button>
      </SheetFooter>
    </form>
  );
}

function ResourceRowActions({ onView, onEdit, onSetAvailable, onSetUnavailable }: { onView: () => void; onEdit: () => void; onSetAvailable: () => void; onSetUnavailable: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Acciones de recurso"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}><Eye />Ver detalle</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}><Edit3 />Editar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSetAvailable}>Marcar disponible</DropdownMenuItem>
        <DropdownMenuItem onClick={onSetUnavailable}>Marcar fuera de servicio</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ResourceDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: detail, isLoading } = useResourceDetail(id);

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className={resourceSheetClassName}>
        <SheetHeader>
          <SheetTitle>{detail?.label || 'Detalle de recurso'}</SheetTitle>
          <SheetDescription>{detail ? getResourceDetailDescription(detail) : 'Leyendo ficha operativa real.'}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-5 py-4">
          {isLoading || !detail ? (
            <DesignedEmpty icon={<ClipboardList className="size-4" />} title="Leyendo recurso" description="Cargando ficha operativa, mantenimiento, asignaciones y auditoria." />
          ) : (
            <ResourceDetailContent detail={detail} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ResourceDetailContent({ detail }: { detail: ResourceDetail }) {
  const openMaintenance = detail.maintenance.filter((record) => record.status === 'scheduled' || record.status === 'in_progress');
  const isStation = detail.category === 'station';
  const isAsset = detail.category === 'water_asset';
  const payloadRows = getPayloadDetailRows(detail);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Estado" value={getStatusForDetail(detail)} />
        <SummaryCard label="Ubicacion" value={detail.location.label} />
        <SummaryCard label={isStation ? 'Localidad' : 'Base'} value={detail.base || (isStation ? 'sin localidad' : 'sin base')} />
        {isStation || isAsset ? null : <SummaryCard label="Mant. abierto" value={openMaintenance.length} tone={openMaintenance.length > 0 ? 'warning' : 'success'} />}
      </div>

      <Card className="command-card-modern">
        <CardHeader>
          <CardTitle>Ficha</CardTitle>
          <CardDescription>{detail.notes || 'Sin notas cargadas.'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <DetailRow label="Codigo" value={detail.code || 's/d'} />
          <DetailRow label="Tipo" value={getResourceTypeLabel(detail.type)} />
          <DetailRow label="Contacto" value={detail.contact || 's/d'} />
          {payloadRows.map((row) => <DetailRow key={row.label} label={row.label} value={row.value} />)}
        </CardContent>
      </Card>

      {isStation || isAsset ? null : (
        <Card className="command-card-modern">
          <CardHeader>
            <CardTitle>Mantenimiento</CardTitle>
            <CardDescription>Trabajos asociados a esta unidad.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {detail.maintenance.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sin mantenimiento registrado.</div>
            ) : (
              detail.maintenance.slice(0, 6).map((record) => (
                <div key={record.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{record.title}</strong>
                    <MaintenanceBadge status={record.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{record.dueAt ? `${formatDateOnly(record.dueAt)} / ${getMaintenanceDueLabel(record)}` : 'Sin fecha'}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {isStation ? null : (
        <Card className="command-card-modern">
          <CardHeader>
            <CardTitle>Asignaciones</CardTitle>
            <CardDescription>Ultimos despachos relacionados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {detail.assignments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sin asignaciones registradas.</div>
            ) : (
              detail.assignments.slice(0, 6).map((assignment) => (
                <div key={assignment.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="font-medium">{assignment.unit?.name || assignment.unitName || assignment.asset?.name || 'Recurso'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{getAssignmentStatusLabel(assignment.status)} / {formatDateOnly(assignment.assignedAt)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card className="command-card-modern">
        <CardHeader>
          <CardTitle>Auditoria</CardTitle>
          <CardDescription>Ultimos cambios operativos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {detail.audits.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sin auditoria registrada.</div>
          ) : (
            detail.audits.slice(0, 8).map((audit) => (
              <div key={audit.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>{getAuditActionLabel(audit.action)}</strong>
                  <span className="text-xs text-muted-foreground">{formatDateOnly(audit.createdAt)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{audit.actor} / {formatAuditReason(audit.reason)}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

function formatMeasure(value: number | null | undefined, unit: string) {
  return typeof value === 'number' ? `${value} ${unit}` : 's/d';
}

function getPayloadDetailRows(detail: ResourceDetail) {
  const payload = getResourcePayload(detail.payload);
  const rows: Array<{ label: string; value: string }> = [];

  const internalCode = getPayloadString(payload, 'internalCode');
  const serialNumber = getPayloadString(payload, 'serialNumber');
  const subtype = getPayloadString(payload, 'subtype');
  const engineHours = getPayloadNumber(payload, 'engineHours');
  const capacityLiters = getPayloadNumber(payload, 'capacityLiters');
  const accessNotes = getPayloadString(payload, 'accessNotes');

  if (internalCode) rows.push({ label: 'Interno', value: internalCode });
  if (serialNumber) rows.push({ label: 'Serie', value: serialNumber });
  if (detail.category === 'machinery' && subtype) rows.push({ label: 'Subtipo', value: getMachinerySubtypeLabel(subtype) });
  if (detail.category === 'machinery' && typeof engineHours === 'number') rows.push({ label: 'Horas', value: formatMeasure(engineHours, 'h') });
  if (typeof capacityLiters === 'number') rows.push({ label: 'Litros', value: formatMeasure(capacityLiters, 'L') });
  if (accessNotes) rows.push({ label: 'Acceso', value: accessNotes });

  return rows;
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case 'station_created':
      return 'Cuartel cargado';
    case 'station_updated':
      return 'Cuartel editado';
    case 'station_imported':
      return 'Cuartel importado';
    case 'unit_created':
      return 'Unidad cargada';
    case 'unit_updated':
      return 'Unidad editada';
    case 'unit_imported':
      return 'Unidad importada';
    case 'asset_created':
      return 'Activo cargado';
    case 'asset_updated':
      return 'Activo editado';
    case 'asset_imported':
      return 'Activo importado';
    case 'maintenance_created':
      return 'Mantenimiento cargado';
    case 'maintenance_updated':
      return 'Mantenimiento actualizado';
    case 'unit_dispatched':
      return 'Unidad despachada';
    case 'unit_released':
      return 'Unidad liberada';
    case 'asset_assigned':
      return 'Activo asignado';
    case 'dispatch_status_updated':
      return 'Estado de despacho actualizado';
    default:
      return action.replaceAll('_', ' ');
  }
}

function formatAuditReason(reason?: string | null) {
  if (!reason) return 'sin detalle';
  return reason
    .replace(/^Station created: /, 'Alta de cuartel: ')
    .replace(/^Station updated: /, 'Edicion de cuartel: ')
    .replace(/^Station imported: /, 'Importacion de cuartel: ')
    .replace(/^Unit created: /, 'Alta de unidad: ')
    .replace(/^Unit updated: /, 'Edicion de unidad: ')
    .replace(/^Unit imported: /, 'Importacion de unidad: ')
    .replace(/^Asset created: /, 'Alta de activo: ')
    .replace(/^Asset updated: /, 'Edicion de activo: ')
    .replace(/^Asset imported: /, 'Importacion de activo: ')
    .replace(/^Maintenance created: /, 'Alta de mantenimiento: ')
    .replace(/^Maintenance updated to /, 'Mantenimiento actualizado a ')
    .replace(/^Unit dispatched to incident /, 'Unidad despachada al incidente ')
    .replace(/^Unit released from incident /, 'Unidad liberada del incidente ')
    .replace(/^Asset assigned to incident /, 'Activo asignado al incidente ');
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

function ImportPreview({ preview }: { preview: ResourceImportPreview }) {
  return (
    <Card className="command-card-modern">
      <CardHeader>
        <CardTitle>Resultado de validacion</CardTitle>
        <CardDescription>{preview.valid} validas / {preview.invalid} con errores / {preview.created} creadas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {preview.rows.slice(0, 8).map((row) => (
          <div key={row.index} className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong>Fila {row.index} / {row.category}</strong>
              <Badge variant={row.valid ? 'secondary' : 'destructive'}>{row.valid ? 'Valida' : 'Error'}</Badge>
            </div>
            {row.errors.length > 0 ? <div className="mt-1 text-xs text-destructive">{row.errors.join(' / ')}</div> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function getStatusForDetail(detail: ResourceDetail) {
  if (detail.category === 'water_asset') return getAssetStatusLabel(detail.status);
  if (detail.category === 'station') return 'Operativa';
  return getUnitStatusLabel(detail.status);
}

function getResourceDetailDescription(detail: ResourceDetail) {
  if (detail.category === 'station') return 'Cuartel / base operativa';
  if (detail.category === 'water_asset') return `${getResourceTypeLabel(detail.type)} / ${getAssetStatusLabel(detail.status)}`;
  return `${getResourceTypeLabel(detail.type)} / ${getUnitStatusLabel(detail.status)}`;
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Field>
  );
}

function SummaryCard({ label, value, icon, tone = 'default' }: { label: string; value: string | number; icon?: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <Card size="sm" className={`command-summary-card command-summary-card--${tone}`}>
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="command-summary-value mt-2 text-2xl font-semibold">{value}</p>
        </div>
        {icon ? <div className="command-summary-icon rounded-lg p-2">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}

function DesignedEmpty({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <Empty className="min-h-64 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

function UnitStatusBadge({ status }: { status: string }) {
  const variant = status === 'available' ? 'secondary' : status === 'maintenance' || status === 'assigned' ? 'outline' : 'destructive';
  return <Badge variant={variant}>{getUnitStatusLabel(status)}</Badge>;
}

function AssetStatusBadge({ status }: { status: string }) {
  const variant = status === 'available' ? 'secondary' : status === 'unavailable' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{getAssetStatusLabel(status)}</Badge>;
}

function MaintenanceBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'secondary' : status === 'cancelled' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{getMaintenanceStatusLabel(status)}</Badge>;
}

function filterUnits(units: OperationalUnit[], search: string, statusFilter: string) {
  const query = search.trim().toLowerCase();
  return units.filter((unit) => {
    if (statusFilter !== 'all' && unit.status !== statusFilter) return false;
    if (!query) return true;
    const payload = getResourcePayload(unit.payload);
    return [
      unit.code,
      unit.name,
      unit.licensePlate || '',
      unit.station?.name || '',
      unit.baseName || '',
      getPayloadString(payload, 'internalCode'),
      getPayloadString(payload, 'serialNumber'),
    ].join(' ').toLowerCase().includes(query);
  });
}

function filterAssets(assets: OperationalAsset[], search: string, statusFilter: string) {
  const query = search.trim().toLowerCase();
  return assets.filter((asset) => {
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
    if (!query) return true;
    const payload = getResourcePayload(asset.payload);
    return [asset.name, asset.type, asset.notes || '', getPayloadString(payload, 'accessNotes')].join(' ').toLowerCase().includes(query);
  });
}

function toStationForm(station: FireStation): StationForm {
  return {
    code: station.code || '',
    name: station.name,
    locality: station.locality || '',
    address: station.address || '',
    contact: station.contact || '',
    lat: station.lat?.toString() || '',
    lon: station.lon?.toString() || '',
    notes: station.notes || '',
  };
}

function toUnitForm(unit: OperationalUnit): UnitForm {
  const payload = getResourcePayload(unit.payload);
  return {
    code: unit.code,
    name: unit.name,
    type: unit.type as OperationalUnitType,
    stationId: unit.stationId || '',
    baseName: unit.baseName || '',
    status: unit.status as OperationalUnitStatus,
    contact: unit.contact || '',
    licensePlate: unit.licensePlate || '',
    capacityLiters: unit.capacityLiters?.toString() || '',
    crewCapacity: unit.crewCapacity?.toString() || '',
    lat: unit.lat?.toString() || '',
    lon: unit.lon?.toString() || '',
    notes: unit.notes || '',
    internalCode: getPayloadString(payload, 'internalCode'),
    serialNumber: getPayloadString(payload, 'serialNumber'),
    engineHours: getPayloadNumber(payload, 'engineHours')?.toString() || '',
    machinerySubtype: getPayloadString(payload, 'subtype') || 'topadora',
  };
}

function toAssetForm(asset: OperationalAsset): AssetForm {
  const payload = getResourcePayload(asset.payload);
  return {
    name: asset.name,
    type: asset.type as OperationalAssetType,
    status: asset.status as OperationalAssetStatus,
    capacityLiters: getPayloadNumber(payload, 'capacityLiters')?.toString() || '',
    lat: asset.lat?.toString() || '',
    lon: asset.lon?.toString() || '',
    accessNotes: getPayloadString(payload, 'accessNotes'),
    notes: asset.notes || '',
  };
}

function buildUnitPayload(form: UnitForm) {
  const payload: Record<string, string | number> = {};
  const isMachinery = form.type === 'machinery';
  const internalCode = isMachinery ? optionalString(form.internalCode) : undefined;
  const serialNumber = isMachinery ? optionalString(form.serialNumber) : undefined;
  const engineHours = isMachinery ? optionalInteger(form.engineHours) : undefined;
  const subtype = form.type === 'machinery' ? optionalString(form.machinerySubtype) : undefined;
  if (internalCode) payload.internalCode = internalCode;
  if (serialNumber) payload.serialNumber = serialNumber;
  if (typeof engineHours === 'number') payload.engineHours = engineHours;
  if (subtype) payload.subtype = subtype;
  return payload;
}

function buildAssetPayload(form: AssetForm) {
  const payload: Record<string, string | number> = { subtype: form.type };
  const capacityLiters = optionalInteger(form.capacityLiters);
  const accessNotes = optionalString(form.accessNotes);
  if (typeof capacityLiters === 'number') payload.capacityLiters = capacityLiters;
  if (accessNotes) payload.accessNotes = accessNotes;
  return payload;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string) {
  return parseOptionalNumber(value);
}

function optionalInteger(value: string) {
  return parseOptionalInteger(value);
}

function optionalDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function getMaintenanceStatusLabel(status: string) {
  switch (status) {
    case 'scheduled':
      return 'Programado';
    case 'in_progress':
      return 'En taller';
    case 'completed':
      return 'Completado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

function compareMaintenanceRecords(left: MaintenanceRecord, right: MaintenanceRecord) {
  const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function getMaintenanceDueLabel(record: MaintenanceRecord) {
  if (!record.dueAt) return 'Sin fecha';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(record.dueAt);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `Vencido ${Math.abs(days)} d`;
  if (days === 0) return 'Vence hoy';
  if (days <= 7) return `Vence en ${days} d`;
  return `En ${days} d`;
}

function formatDateOnly(value: Date | string) {
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
