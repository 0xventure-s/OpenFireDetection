import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../_auth';
import { JURISDICTION_BBOX } from '@/lib/constants';
import { isPointInJurisdiction } from '@/lib/jurisdiction';
import { buildAnalysisDashboard, normalizeAnalysisPeriod } from '@/lib/analysis-dashboard';
import { Fire, FireStation, IncidentAssignment, OperationalAsset, OperationalUnit } from '@/types';
import { requireOperator } from '@/lib/operator-auth';

export async function GET(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request);

    const period = normalizeAnalysisPeriod(request.nextUrl.searchParams.get('period'));

    const rawFires = (
      await prisma.incident.findMany({
        where: {
          organizationId: operator.organizationId,
          lat: {
            gte: JURISDICTION_BBOX.south,
            lte: JURISDICTION_BBOX.north,
          },
          lon: {
            gte: JURISDICTION_BBOX.west,
            lte: JURISDICTION_BBOX.east,
          },
        },
        orderBy: { detectedAt: 'desc' },
      })
    ).filter((fire) => isPointInJurisdiction(fire.lat, fire.lon));

    const activeFireIds = rawFires
      .filter((fire) => fire.lifecycleStatus === 'active' && fire.status !== 'false_positive' && fire.status !== 'extinguished')
      .map((fire) => fire.id);

    const [assignments, stations, units, assets, latestScan] = await Promise.all([
      findActiveAssignments(operator.organizationId, activeFireIds),
      findFireStations(operator.organizationId),
      findOperationalUnits(operator.organizationId),
      findOperationalAssets(operator.organizationId),
      findLatestSuccessfulScan(operator.organizationId),
    ]);

    return ok(
      buildAnalysisDashboard({
        fires: rawFires as unknown as Fire[],
        assignments: assignments as unknown as IncidentAssignment[],
        stations: stations as unknown as FireStation[],
        units: units as unknown as OperationalUnit[],
        assets: assets as unknown as OperationalAsset[],
        latestScan,
        period,
      })
    );
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

async function findActiveAssignments(organizationId: string, activeFireIds: string[]) {
  if (activeFireIds.length === 0) return [];

  try {
    return await prisma.incidentAssignment.findMany({
      where: {
        organizationId,
        fireId: { in: activeFireIds },
        status: { not: 'released' },
        releasedAt: null,
      },
      include: {
        unit: true,
        asset: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return [];
    throw error;
  }
}

async function findOperationalUnits(organizationId: string) {
  try {
    return await prisma.operationalUnit.findMany({
      where: { organizationId },
      include: {
        station: true,
        maintenanceRecords: {
          where: { status: { in: ['scheduled', 'in_progress'] } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          take: 3,
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return [];
    throw error;
  }
}

async function findFireStations(organizationId: string) {
  try {
    return await prisma.fireStation.findMany({ where: { organizationId }, orderBy: [{ locality: 'asc' }, { name: 'asc' }] });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return [];
    throw error;
  }
}

async function findOperationalAssets(organizationId: string) {
  try {
    return await prisma.operationalAsset.findMany({ where: { organizationId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return [];
    throw error;
  }
}

async function findLatestSuccessfulScan(organizationId: string) {
  try {
    return await prisma.scanRun.findFirst({
      where: { organizationId, status: 'success' },
      orderBy: { startedAt: 'desc' },
    });
  } catch (error) {
    if (isMissingOperationalTableError(error)) return null;
    throw error;
  }
}

function isMissingOperationalTableError(error: unknown) {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  return code === 'P2021' || /table .* does not exist/i.test(message);
}
