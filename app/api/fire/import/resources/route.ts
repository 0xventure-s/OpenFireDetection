import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { parseOptionalInteger, parseOptionalNumber } from '@/lib/resource-helpers';
import { fireStationSchema, operationalAssetSchema, operationalUnitSchema } from '@/lib/validations';
import type { JsonObject, ResourceCategory, ResourceImportPreviewRow } from '@/types';

type ImportMode = 'validateOnly' | 'commit';
type ParsedRow = ResourceImportPreviewRow & {
  normalized: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const operator = await requireOperator(request, 'resource.import');
    const body = await request.json();
    const mode: ImportMode = body?.mode === 'commit' ? 'commit' : 'validateOnly';
    const content = typeof body?.content === 'string' ? body.content : '';
    if (!content.trim()) return fail(400, 'Validation error', 'content is required');

    const rows = parseCsv(content).map((row, index) => normalizeImportRow(row, index + 1));
    const validRows = rows.filter((row) => row.valid);
    let created = 0;

    if (mode === 'commit') {
      for (const row of validRows) {
        await createResource(row, operator.organizationId, operator.id);
        created += 1;
      }
    }

    return ok({
      mode,
      total: rows.length,
      valid: validRows.length,
      invalid: rows.length - validRows.length,
      created,
      rows: rows.map(toPreviewRow),
    });
  } catch (error) {
    if (error instanceof OperatorAuthError) return fail(error.status, 'Unauthorized', error.message);
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toPreviewRow(row: ParsedRow): ResourceImportPreviewRow {
  return {
    index: row.index,
    category: row.category,
    valid: row.valid,
    errors: row.errors,
    data: row.data,
  };
}

function normalizeImportRow(row: Record<string, string>, index: number): ParsedRow {
  const category = normalizeCategory(read(row, 'category', 'categoria', 'tipo_recurso'));
  const base: ResourceImportPreviewRow = {
    index,
    category,
    valid: true,
    errors: [],
    data: row as JsonObject,
  };

  const normalized = buildPayloadForCategory(category, row);
  const schema =
    category === 'station' ? fireStationSchema :
    category === 'water_asset' ? operationalAssetSchema :
    operationalUnitSchema;
  const result = schema.safeParse(normalized);

  if (!result.success) {
    base.valid = false;
    base.errors = result.error.errors.map((error) => `${error.path.join('.') || 'fila'}: ${error.message}`);
  }

  return { ...base, normalized: result.success ? result.data : normalized };
}

async function createResource(row: ParsedRow, organizationId: string, actor: string) {
  if (row.category === 'station') {
    const station = await prisma.fireStation.create({
      data: { ...row.normalized, organizationId } as Prisma.FireStationUncheckedCreateInput,
    });
    await prisma.operationalAudit.create({
      data: { organizationId, stationId: station.id, action: 'station_imported', actor, reason: `Importacion de cuartel: ${station.name}`, payload: toJson(row.normalized) },
    });
    return;
  }

  if (row.category === 'water_asset') {
    const assetData = row.normalized as { name: string; type: string; status?: string; lat?: number; lon?: number; notes?: string; payload?: unknown };
    const asset = await prisma.operationalAsset.create({
      data: {
        organizationId,
        name: assetData.name,
        type: assetData.type,
        status: assetData.status,
        lat: assetData.lat,
        lon: assetData.lon,
        notes: assetData.notes,
        payload: toJson(assetData.payload),
      },
    });
    await prisma.operationalAudit.create({
      data: { organizationId, assetId: asset.id, action: 'asset_imported', actor, reason: `Importacion de activo: ${asset.name}`, payload: toJson(row.normalized) },
    });
    return;
  }

  const unitData = row.normalized as { code: string; name: string; type: string; status?: string; baseName?: string; contact?: string; licensePlate?: string; capacityLiters?: number; crewCapacity?: number; lat?: number; lon?: number; notes?: string; payload?: unknown };
  const unit = await prisma.operationalUnit.create({
    data: {
      organizationId,
      code: unitData.code,
      name: unitData.name,
      type: unitData.type,
      status: unitData.status,
      baseName: unitData.baseName,
      contact: unitData.contact,
      licensePlate: unitData.type === 'machinery' ? null : unitData.licensePlate,
      capacityLiters: unitData.type === 'machinery' ? null : unitData.capacityLiters,
      crewCapacity: unitData.type === 'machinery' ? null : unitData.crewCapacity,
      lat: unitData.lat,
      lon: unitData.lon,
      notes: unitData.notes,
      payload: toJson(unitData.payload),
    },
  });
  await prisma.operationalAudit.create({
    data: { organizationId, unitId: unit.id, action: 'unit_imported', actor, reason: `Importacion de unidad: ${unit.name}`, payload: toJson(row.normalized) },
  });
}

function buildPayloadForCategory(category: ResourceCategory, row: Record<string, string>) {
  const status = read(row, 'status', 'estado');
  const lat = optionalNumber(read(row, 'lat', 'latitud'));
  const lon = optionalNumber(read(row, 'lon', 'longitud'));
  const notes = optionalString(read(row, 'notes', 'notas', 'observaciones'));

  if (category === 'station') {
    return {
      code: optionalString(read(row, 'code', 'codigo')),
      name: read(row, 'name', 'nombre'),
      locality: optionalString(read(row, 'locality', 'localidad')),
      address: optionalString(read(row, 'address', 'direccion')),
      contact: optionalString(read(row, 'contact', 'contacto', 'radio')),
      lat,
      lon,
      notes,
    };
  }

  if (category === 'water_asset') {
    return {
      name: read(row, 'name', 'nombre'),
      type: normalizeAssetType(read(row, 'type', 'tipo', 'subtipo')),
      status: normalizeAssetStatus(status),
      lat,
      lon,
      notes,
      payload: {
        capacityLiters: optionalInteger(read(row, 'capacityLiters', 'capacidad_litros', 'litros')),
        accessNotes: optionalString(read(row, 'accessNotes', 'acceso')),
        subtype: normalizeAssetType(read(row, 'type', 'tipo', 'subtipo')),
      },
    };
  }

  const isMachinery = category === 'machinery';
  return {
    code: read(row, 'code', 'codigo'),
    name: read(row, 'name', 'nombre'),
    type: isMachinery ? 'machinery' : normalizeUnitType(read(row, 'type', 'tipo')),
    status: normalizeUnitStatus(status),
    baseName: optionalString(read(row, 'baseName', 'base', 'cuartel')),
    contact: optionalString(read(row, 'contact', 'contacto', 'radio')),
    licensePlate: isMachinery ? undefined : optionalString(read(row, 'licensePlate', 'patente')),
    capacityLiters: isMachinery ? undefined : optionalInteger(read(row, 'capacityLiters', 'capacidad_litros', 'litros')),
    crewCapacity: isMachinery ? undefined : optionalInteger(read(row, 'crewCapacity', 'dotacion')),
    lat,
    lon,
    notes,
    payload: {
      internalCode: isMachinery ? optionalString(read(row, 'internalCode', 'numero_interno', 'interno')) : undefined,
      serialNumber: isMachinery ? optionalString(read(row, 'serialNumber', 'serie')) : undefined,
      engineHours: isMachinery ? optionalInteger(read(row, 'engineHours', 'horas_uso', 'horas')) : undefined,
      subtype: isMachinery ? optionalString(read(row, 'subtype', 'subtipo')) : undefined,
    },
  };
}

function parseCsv(content: string) {
  const rows = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) return [];
  const delimiter = rows[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(rows[0], delimiter).map(normalizeHeader);
  return rows.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || '']));
  });
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function read(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value.trim();
  }
  return '';
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
}

function normalizeCategory(value: string): ResourceCategory {
  const normalized = normalizeHeader(value);
  if (normalized.includes('maquinaria')) return 'machinery';
  if (normalized.includes('agua') || normalized.includes('activo') || normalized.includes('cisterna') || normalized.includes('tanque')) return 'water_asset';
  if (normalized.includes('cuartel') || normalized.includes('base') || normalized.includes('station')) return 'station';
  return 'vehicle';
}

function normalizeUnitType(value: string) {
  const normalized = normalizeHeader(value);
  if (normalized.includes('cisterna')) return 'tanker';
  if (normalized.includes('forestal')) return 'brush_truck';
  if (normalized.includes('camioneta')) return 'pickup';
  if (normalized.includes('apoyo')) return 'support';
  if (normalized.includes('brigada')) return 'brigade';
  if (normalized.includes('autobomba') || normalized.includes('bomba')) return 'engine';
  return ['engine', 'tanker', 'brush_truck', 'pickup', 'support', 'brigade', 'other'].includes(normalized) ? normalized : 'other';
}

function normalizeAssetType(value: string) {
  const normalized = normalizeHeader(value);
  if (normalized.includes('cisterna') || normalized.includes('tanque')) return 'water_tank';
  if (normalized.includes('agua')) return 'water_source';
  if (normalized.includes('heli')) return 'helipad';
  if (normalized.includes('acceso')) return 'access_point';
  if (normalized.includes('espera') || normalized.includes('staging')) return 'staging';
  return ['water_tank', 'water_source', 'helipad', 'access_point', 'staging', 'other'].includes(normalized) ? normalized : 'other';
}

function normalizeUnitStatus(value: string) {
  const normalized = normalizeHeader(value);
  if (normalized.includes('asign')) return 'assigned';
  if (normalized.includes('mant') || normalized.includes('taller')) return 'maintenance';
  if (normalized.includes('fuera') || normalized.includes('no_disponible')) return 'unavailable';
  return normalized === 'assigned' || normalized === 'maintenance' || normalized === 'unavailable' ? normalized : 'available';
}

function normalizeAssetStatus(value: string) {
  const normalized = normalizeHeader(value);
  if (normalized.includes('no') || normalized.includes('fuera')) return 'unavailable';
  if (normalized.includes('disponible')) return 'available';
  return normalized === 'available' || normalized === 'unavailable' ? normalized : 'unknown';
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNumber(value: string) {
  return parseOptionalNumber(value);
}

function optionalInteger(value: string) {
  return parseOptionalInteger(value);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
