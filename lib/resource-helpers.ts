import type {
  JsonObject,
  OperationalAsset,
  OperationalAssetStatus,
  OperationalAssetType,
  OperationalUnit,
  OperationalUnitStatus,
  OperationalUnitType,
  ResourceCategory,
} from '@/types';

export const vehicleUnitTypes: OperationalUnitType[] = ['engine', 'tanker', 'brush_truck', 'pickup', 'support', 'brigade', 'other'];
export const machinerySubtypes = ['topadora', 'retroexcavadora', 'motoniveladora', 'bomba_generador', 'otra'] as const;
export const assetTypes: OperationalAssetType[] = ['water_tank', 'water_source', 'helipad', 'access_point', 'staging', 'other'];

export type VisibleUnitFields = {
  licensePlate: boolean;
  capacityLiters: boolean;
  crewCapacity: boolean;
  serialNumber: boolean;
  engineHours: boolean;
  internalCode: boolean;
};

export function getResourceCategory(resource: OperationalUnit | OperationalAsset | OperationalUnitType | OperationalAssetType): ResourceCategory {
  const type = typeof resource === 'string' ? resource : resource.type;
  if (type === 'machinery') return 'machinery';
  if (type === 'water_tank' || type === 'water_source' || type === 'helipad' || type === 'access_point' || type === 'staging') return 'water_asset';
  return 'vehicle';
}

export function getVisibleUnitFields(type: OperationalUnitType | string): VisibleUnitFields {
  const isMachinery = type === 'machinery';
  return {
    licensePlate: !isMachinery,
    capacityLiters: !isMachinery && (type === 'engine' || type === 'tanker' || type === 'brush_truck'),
    crewCapacity: !isMachinery,
    serialNumber: isMachinery,
    engineHours: isMachinery,
    internalCode: isMachinery,
  };
}

export function getResourceTypeLabel(type: string) {
  switch (type) {
    case 'engine':
      return 'Autobomba';
    case 'tanker':
      return 'Camion cisterna';
    case 'brush_truck':
      return 'Forestal';
    case 'pickup':
      return 'Camioneta';
    case 'machinery':
      return 'Maquinaria';
    case 'support':
      return 'Apoyo';
    case 'brigade':
      return 'Brigada';
    case 'water_tank':
      return 'Cisterna / tanque';
    case 'water_source':
      return 'Fuente de agua';
    case 'helipad':
      return 'Helipunto';
    case 'station':
      return 'Cuartel / base';
    case 'staging':
      return 'Punto de espera';
    case 'access_point':
      return 'Punto de acceso';
    case 'other':
      return 'Otro';
    default:
      return type;
  }
}

export function getMachinerySubtypeLabel(value?: string | null) {
  switch (value) {
    case 'topadora':
      return 'Topadora';
    case 'retroexcavadora':
      return 'Retroexcavadora';
    case 'motoniveladora':
      return 'Motoniveladora';
    case 'bomba_generador':
      return 'Bomba / generador';
    case 'otra':
      return 'Otra maquinaria';
    default:
      return 'Maquinaria';
  }
}

export function getUnitStatusLabel(status: OperationalUnitStatus | string) {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'assigned':
      return 'Asignado';
    case 'maintenance':
      return 'Mantenimiento';
    case 'unavailable':
      return 'Fuera de servicio';
    default:
      return status;
  }
}

export function getAssetStatusLabel(status: OperationalAssetStatus | string) {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'unavailable':
      return 'No disponible';
    case 'unknown':
      return 'Sin verificar';
    default:
      return status;
  }
}

export function getResourcePayload(value?: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

export function getPayloadString(payload: JsonObject, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

export function getPayloadNumber(payload: JsonObject, key: string) {
  const value = payload[key];
  return typeof value === 'number' ? value : null;
}

export function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
