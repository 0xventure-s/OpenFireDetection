import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../_auth';
import { getResourceCategory, getResourcePayload } from '@/lib/resource-helpers';
import type { AuditEvent, FireStation, OperationalAsset, OperationalAudit, OperationalUnit, ResourceDetail } from '@/types';
import { requireOperator } from '@/lib/operator-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'resource.read');

    const { id } = await params;
    const [unit, asset, station] = await Promise.all([
      prisma.operationalUnit.findFirst({
        where: { id, organizationId: operator.organizationId },
        include: {
          station: true,
          maintenanceRecords: { orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }] },
          assignments: { orderBy: { assignedAt: 'desc' }, take: 10, include: { asset: true } },
          audits: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
      prisma.operationalAsset.findFirst({
        where: { id, organizationId: operator.organizationId },
        include: {
          assignments: { orderBy: { assignedAt: 'desc' }, take: 10, include: { unit: true } },
          audits: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
      prisma.fireStation.findFirst({
        where: { id, organizationId: operator.organizationId },
        include: {
          units: { orderBy: [{ status: 'asc' }, { name: 'asc' }] },
          audits: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
    ]);

    if (unit) return ok(toUnitDetail(unit as unknown as OperationalUnit));
    if (asset) return ok(toAssetDetail(asset as unknown as OperationalAsset));
    if (station) return ok(toStationDetail(station as unknown as FireStation));
    return fail(404, 'Resource not found');
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function toUnitDetail(unit: OperationalUnit): ResourceDetail {
  return {
    id: unit.id,
    category: getResourceCategory(unit),
    label: unit.name,
    code: unit.code,
    type: unit.type,
    status: unit.status,
    location: toLocation(unit.lat, unit.lon),
    contact: unit.contact,
    base: unit.station?.name || unit.baseName,
    notes: unit.notes,
    payload: getResourcePayload(unit.payload),
    maintenance: unit.maintenanceRecords || [],
    assignments: unit.assignments || [],
    audits: (unit.audits || []).map((audit) => toAuditEvent(audit, unit.id, unit.name, 'resource')),
    raw: unit,
  };
}

function toAssetDetail(asset: OperationalAsset): ResourceDetail {
  return {
    id: asset.id,
    category: 'water_asset',
    label: asset.name,
    code: null,
    type: asset.type,
    status: asset.status,
    location: toLocation(asset.lat, asset.lon),
    contact: null,
    base: null,
    notes: asset.notes,
    payload: getResourcePayload(asset.payload),
    maintenance: [],
    assignments: asset.assignments || [],
    audits: (asset.audits || []).map((audit) => toAuditEvent(audit, asset.id, asset.name, 'asset')),
    raw: asset,
  };
}

function toStationDetail(station: FireStation): ResourceDetail {
  return {
    id: station.id,
    category: 'station',
    label: station.name,
    code: station.code,
    type: 'station',
    status: 'operativa',
    location: toLocation(station.lat, station.lon),
    contact: station.contact,
    base: station.locality || station.address,
    notes: station.notes,
    payload: getResourcePayload(station.payload),
    maintenance: [],
    assignments: [],
    audits: (station.audits || []).map((audit) => toAuditEvent(audit, station.id, station.name, 'station')),
    raw: station,
  };
}

function toLocation(lat: number | null, lon: number | null) {
  return {
    lat,
    lon,
    label: typeof lat === 'number' && typeof lon === 'number' ? `${lat.toFixed(3)}, ${lon.toFixed(3)}` : 'sin ubicacion cargada',
  };
}

function toAuditEvent(audit: OperationalAudit, entityId: string, entityLabel: string, type: AuditEvent['type']): AuditEvent {
  return {
    id: `operational:${audit.id}`,
    type,
    entityId,
    entityLabel,
    action: audit.action,
    actor: audit.actor,
    reason: audit.reason,
    payload: audit.payload,
    createdAt: audit.createdAt,
  };
}
