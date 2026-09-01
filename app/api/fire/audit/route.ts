import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import type { AuditEvent, FireAudit, OperationalAudit } from '@/types';
import { requireOperator } from '@/lib/operator-auth';

export async function GET(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request, 'audit.read');
    if (authResponse) return authResponse;
    const operator = await requireOperator(request, 'audit.read');

    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') || 'all';
    const actor = searchParams.get('actor')?.trim();
    const entityId = searchParams.get('entityId')?.trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const take = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 200);
    const createdAt = buildDateFilter(from, to);

    const [fireAudits, operationalAudits] = await Promise.all([
      type === 'all' || type === 'incident'
        ? prisma.fireAudit.findMany({
            where: {
              organizationId: operator.organizationId,
              ...(actor ? { actor } : {}),
              ...(entityId ? { fireId: entityId } : {}),
              ...(createdAt ? { createdAt } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
      type !== 'incident'
        ? prisma.operationalAudit.findMany({
            where: {
              organizationId: operator.organizationId,
              ...(actor ? { actor } : {}),
              ...(entityId
                ? {
                    OR: [
                      { unitId: entityId },
                      { assetId: entityId },
                      { stationId: entityId },
                      { maintenanceId: entityId },
                    ],
                  }
                : {}),
              ...(createdAt ? { createdAt } : {}),
              ...(type === 'resource' ? { unitId: { not: null } } : {}),
              ...(type === 'asset' ? { assetId: { not: null } } : {}),
              ...(type === 'station' ? { stationId: { not: null } } : {}),
              ...(type === 'maintenance' ? { maintenanceId: { not: null } } : {}),
            },
            include: {
              unit: true,
              asset: true,
              station: true,
              maintenance: true,
            },
            orderBy: { createdAt: 'desc' },
            take,
          })
        : Promise.resolve([]),
    ]);

    const items = [
      ...fireAudits.map((audit) => fromFireAudit(audit as unknown as FireAudit)),
      ...operationalAudits.map((audit) => fromOperationalAudit(audit as unknown as OperationalAudit)),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, take);

    return ok({ items });
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function buildDateFilter(from: string | null, to: string | null) {
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return Object.keys(filter).length ? filter : null;
}

function fromFireAudit(audit: FireAudit): AuditEvent {
  return {
    id: `fire:${audit.id}`,
    type: 'incident',
    entityId: audit.fireId,
    entityLabel: audit.fireId,
    action: audit.action,
    actor: audit.actor,
    reason: audit.reason,
    payload: audit.payload,
    createdAt: audit.createdAt,
  };
}

function fromOperationalAudit(audit: OperationalAudit): AuditEvent {
  const entity =
    audit.unit ? { type: 'resource' as const, id: audit.unit.id, label: audit.unit.name } :
    audit.asset ? { type: 'asset' as const, id: audit.asset.id, label: audit.asset.name } :
    audit.station ? { type: 'station' as const, id: audit.station.id, label: audit.station.name } :
    audit.maintenance ? { type: 'maintenance' as const, id: audit.maintenance.id, label: audit.maintenance.title } :
    { type: 'resource' as const, id: audit.unitId || audit.assetId || audit.stationId || audit.maintenanceId || audit.id, label: 'Registro operativo' };

  return {
    id: `operational:${audit.id}`,
    type: entity.type,
    entityId: entity.id,
    entityLabel: entity.label,
    action: audit.action,
    actor: audit.actor,
    reason: audit.reason,
    payload: audit.payload,
    createdAt: audit.createdAt,
  };
}
