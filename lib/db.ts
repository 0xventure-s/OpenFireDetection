import { Prisma, PrismaClient } from '@prisma/client';
import { DETECTION_THRESHOLDS } from '@/lib/constants';
import { isPointInJurisdiction } from './jurisdiction';
import { JURISDICTION_BBOX } from './constants';
import {
  AuditAction,
  DataFreshness,
  DetectionResult,
  FirePayload,
  FireSource,
  FireStatus,
  LifecycleFilter,
  LifecycleStatus,
  ProjectionSnapshot,
  TerrainSnapshot,
  WeatherSnapshot,
} from '@/types';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

type JsonInput = Prisma.InputJsonValue;

interface GetFiresParams {
  organizationId: string;
  status?: FireStatus;
  lifecycle?: LifecycleFilter;
  since?: Date;
  limit?: number;
  offset?: number;
}

interface CreateFireParams {
  organizationId: string;
  lat: number;
  lon: number;
  detectedAt: Date;
  status?: FireStatus;
  lifecycleStatus?: LifecycleStatus;
  sources?: FireSource[];
  payload?: FirePayload;
  manual?: boolean;
  confirmed?: boolean;
  confirmedBy?: string;
  confirmedAt?: Date;
  dataFreshness?: DataFreshness;
  weatherSnapshot?: WeatherSnapshot | null;
  terrainSnapshot?: TerrainSnapshot | null;
  projectionSnapshot?: ProjectionSnapshot | null;
}

interface UpdateFireParams {
  confirmed?: boolean;
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
  status?: FireStatus;
  lifecycleStatus?: LifecycleStatus;
  sources?: FireSource[];
  payload?: FirePayload;
  extinguishedBy?: string | null;
  extinguishedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  dispatchedAt?: Date | null;
  dispatchedBy?: string | null;
  closedAt?: Date | null;
  dataFreshness?: DataFreshness;
  weatherSnapshot?: WeatherSnapshot | null;
  terrainSnapshot?: TerrainSnapshot | null;
  projectionSnapshot?: ProjectionSnapshot | null;
}

interface AuditParams {
  action: AuditAction;
  actor: string;
  reason?: string;
}

interface CreateScanRunParams {
  organizationId: string;
  triggerType: string;
  triggeredBy?: string | null;
}

// Helper functions for database operations
export const db = {
  async createScanRun(data: CreateScanRunParams) {
    return prisma.scanRun.create({
      data: {
        organizationId: data.organizationId,
        triggerType: data.triggerType,
        triggeredBy: data.triggeredBy || null,
        status: 'running',
      },
    });
  },

  async completeScanRun(id: string, organizationId: string, result: DetectionResult, durationMs: number) {
    return prisma.scanRun.update({
      where: { id, organizationId },
      data: {
        status: 'success',
        finishedAt: new Date(),
        durationMs,
        newCount: result.new,
        updatedCount: result.updated,
        confirmedCount: result.confirmed,
        closedCount: result.closed || 0,
        summary: result.summary,
        error: null,
      },
    });
  },

  async failScanRun(id: string, organizationId: string, error: string, durationMs: number) {
    return prisma.scanRun.update({
      where: { id, organizationId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        durationMs,
        error,
      },
    });
  },

  async getScanStatus(organizationId: string, now = Date.now()) {
    const [latest, latestSuccess, latestFailure] = await Promise.all([
      prisma.scanRun.findFirst({ where: { organizationId }, orderBy: { startedAt: 'desc' } }),
      prisma.scanRun.findFirst({ where: { organizationId, status: 'success' }, orderBy: { startedAt: 'desc' } }),
      prisma.scanRun.findFirst({ where: { organizationId, status: 'failed' }, orderBy: { startedAt: 'desc' } }),
    ]);
    const pollIntervalMinutes = 10;
    const nextBase = latest?.finishedAt || latest?.startedAt || new Date(now);
    const nextClientPollAt = new Date(Math.max(now, nextBase.getTime() + pollIntervalMinutes * 60000)).toISOString();

    return {
      latest,
      latestSuccess,
      latestFailure,
      nextClientPollAt,
      pollIntervalMinutes,
      lockTtlSeconds: 120,
      status: latest?.status || 'idle',
    };
  },

  // Get fires with filters
  async getFires(params: GetFiresParams) {
    const { organizationId, status, lifecycle = 'active', since, limit = 50, offset = 0 } = params;

    const where: Prisma.IncidentWhereInput = {
      organizationId,
      ...jurisdictionLatLonWhere(),
    };
    if (status) where.status = status;
    if (lifecycle && lifecycle !== 'all') where.lifecycleStatus = lifecycle;
    if (since) where.detectedAt = { gte: since };

    const provincialFires = (
      await prisma.incident.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
      })
    ).filter(isFireRecordInJurisdiction);

    return {
      fires: provincialFires.slice(offset, offset + limit),
      total: provincialFires.length,
    };
  },

  // Create new fire
  async createFire(data: CreateFireParams) {
    if (!isPointInJurisdiction(data.lat, data.lon)) {
      throw new Error('Fire location must be inside the configured jurisdiction');
    }

    const geom = `POINT(${data.lon} ${data.lat})`;

    const fire = await prisma.incident.create({
      data: {
        organizationId: data.organizationId,
        lat: data.lat,
        lon: data.lon,
        geom,
        detectedAt: data.detectedAt,
        status: data.status || 'unconfirmed',
        lifecycleStatus: data.lifecycleStatus || (data.payload?.test ? 'test' : 'active'),
        sources: (data.sources || []) as unknown as JsonInput,
        payload: (data.payload || {}) as unknown as JsonInput,
        manual: data.manual || false,
        confirmed: data.confirmed || false,
        confirmedBy: data.confirmedBy,
        confirmedAt: data.confirmedAt,
        dataFreshness: (data.dataFreshness || deriveDataFreshness(data.sources || [], data.manual)) as unknown as JsonInput,
        weatherSnapshot: data.weatherSnapshot === null ? Prisma.JsonNull : (data.weatherSnapshot as unknown as JsonInput | undefined),
        terrainSnapshot: data.terrainSnapshot === null ? Prisma.JsonNull : (data.terrainSnapshot as unknown as JsonInput | undefined),
        projectionSnapshot: data.projectionSnapshot === null ? Prisma.JsonNull : (data.projectionSnapshot as unknown as JsonInput | undefined),
      },
    });

    // Create audit log
    await prisma.fireAudit.create({
      data: {
        organizationId: data.organizationId,
        fireId: fire.id,
        action: data.manual ? 'manual_add' : 'created',
        actor: data.confirmedBy || 'system:detection',
          payload: (data.payload || {}) as unknown as JsonInput,
      },
    });

    return fire;
  },

  // Update fire
  async updateFire(
    id: string,
    organizationId: string,
    data: UpdateFireParams,
    auditData?: AuditParams
  ) {
    const fire = await prisma.incident.update({
      where: { id, organizationId },
      data: {
        ...data,
        sources: data.sources ? (data.sources as unknown as JsonInput) : undefined,
        payload: data.payload ? (data.payload as unknown as JsonInput) : undefined,
        dataFreshness: data.dataFreshness ? (data.dataFreshness as unknown as JsonInput) : undefined,
        weatherSnapshot: data.weatherSnapshot === null ? Prisma.JsonNull : data.weatherSnapshot ? (data.weatherSnapshot as unknown as JsonInput) : undefined,
        terrainSnapshot: data.terrainSnapshot === null ? Prisma.JsonNull : data.terrainSnapshot ? (data.terrainSnapshot as unknown as JsonInput) : undefined,
        projectionSnapshot: data.projectionSnapshot === null ? Prisma.JsonNull : data.projectionSnapshot ? (data.projectionSnapshot as unknown as JsonInput) : undefined,
      },
    });

    // Create audit log if provided
    if (auditData) {
      await prisma.fireAudit.create({
        data: {
          organizationId,
          fireId: id,
          ...auditData,
          payload: data as unknown as JsonInput,
        },
      });
    }

    return fire;
  },

  // Get fire by ID
  async getFireById(id: string, organizationId: string) {
    if (!id) {
      console.error('[DB] getFireById called with undefined/null id');
      return null;
    }

    const fire = await prisma.incident.findFirst({
      where: { id, organizationId },
      include: {
        audits: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!fire || !isFireRecordInJurisdiction(fire)) {
      return null;
    }

    return fire;
  },

  // Get fire history
  async getFireHistory(id: string, organizationId: string) {
    if (!id) {
      console.error('[DB] getFireHistory called with undefined/null id');
      return [];
    }

    return prisma.fireAudit.findMany({
      where: { fireId: id, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Find nearby fires (within radius and time window)
  async findNearbyFires(params: {
    organizationId: string;
    lat: number;
    lon: number;
    radiusKm: number;
    withinMinutes: number;
    referenceTime?: Date;
  }) {
    const { organizationId, lat, lon, radiusKm, withinMinutes, referenceTime = new Date() } = params;
    const { since, until } = buildNearbyDetectionTimeWindow(referenceTime, withinMinutes);

    // Simple bounding box query (more efficient than full distance calculation)
    const latDelta = radiusKm / 111; // ~111km per degree latitude
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const fires = await prisma.incident.findMany({
      where: {
        organizationId,
        lat: {
          gte: lat - latDelta,
          lte: lat + latDelta,
        },
        lon: {
          gte: lon - lonDelta,
          lte: lon + lonDelta,
        },
        detectedAt: {
          gte: since,
          lte: until,
        },
      },
    });

    // Filter by actual distance using Haversine
    return fires.filter((fire: { lat: number; lon: number }) => {
      if (!isFireRecordInJurisdiction(fire)) return false;
      const distance = haversineDistance(lat, lon, fire.lat, fire.lon);
      return distance <= radiusKm;
    });
  },

  // Archive fire while keeping it available for history and audit views.
  async deleteFire(id: string, organizationId: string, actor = 'operator') {
    if (!id) {
      console.error('[DB] deleteFire called with undefined/null id');
      return null;
    }

    const existing = await prisma.incident.findFirst({
      where: { id, organizationId },
      select: { payload: true },
    });
    if (!existing) return null;

    const now = new Date();
    const fire = await prisma.incident.update({
      where: { id, organizationId },
      data: {
        lifecycleStatus: 'archived',
        closedAt: now,
        payload: {
          ...toJsonObject(existing.payload),
          operationalStatus: 'closed',
          archivedAt: now.toISOString(),
          archivedBy: actor,
        } as unknown as JsonInput,
      },
    });

    await prisma.fireAudit.create({
      data: {
        organizationId,
        fireId: id,
        action: 'deleted',
        actor,
        reason: 'Fire archived by operator',
        payload: { lifecycleStatus: 'archived' },
      },
    });

    return fire;
  },

  async clearTestFires(organizationId: string) {
    const testFires = await prisma.incident.findMany({
      where: {
        organizationId,
        OR: [
          { lifecycleStatus: 'test' },
          {
            payload: {
              path: ['test'],
              equals: true,
            },
          },
        ],
      },
      select: { id: true },
    });

    const ids = testFires.map((fire) => fire.id);
    if (ids.length === 0) {
      return { fires: 0, audits: 0 };
    }

    const audits = await prisma.fireAudit.deleteMany({ where: { organizationId, fireId: { in: ids } } });
    const fires = await prisma.incident.deleteMany({ where: { organizationId, id: { in: ids } } });
    return { fires: fires.count, audits: audits.count };
  },

  async closeStaleUnactionedFires(
    organizationId: string,
    maxAgeHours = DETECTION_THRESHOLDS.AUTO_CLOSE_UNACTIONED_HOURS,
    staleActiveAgeHours = DETECTION_THRESHOLDS.AUTO_CLOSE_STALE_ACTIVE_HOURS
  ) {
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - maxAgeHours * 3600000);
    const staleActiveCutoff = new Date(nowMs - staleActiveAgeHours * 3600000);
    const candidates = await prisma.incident.findMany({
      where: {
        organizationId,
        lifecycleStatus: 'active',
        extinguishedAt: null,
        closedAt: null,
      },
      select: {
        id: true,
        detectedAt: true,
        reviewedAt: true,
        dispatchedAt: true,
        dataFreshness: true,
        payload: true,
        sources: true,
      },
    });

    const stale = candidates
      .map((fire) => {
        const hasOperatorAction = Boolean(fire.reviewedAt || fire.dispatchedAt);
        const latestSignalAt = getLatestDetectionSignalAt(fire.sources, fire.dataFreshness, fire.detectedAt);
        const hasStaleSignal = latestSignalAt.getTime() < staleActiveCutoff.getTime();
        const hasStaleUnactionedIncident = !hasOperatorAction && latestSignalAt.getTime() < cutoff.getTime();
        const fireCutoff = hasStaleSignal ? staleActiveCutoff : cutoff;
        const reason = hasStaleSignal
          ? `No fresh satellite signal within ${staleActiveAgeHours} hours`
          : `No operator action within ${maxAgeHours} hours`;
        return {
          ...fire,
          latestSignalAt,
          shouldClose: hasStaleSignal || hasStaleUnactionedIncident,
          cutoff: fireCutoff,
          reason,
        };
      })
      .filter((fire) => fire.shouldClose);

    if (stale.length === 0) {
      return { closed: 0, cutoff };
    }

    const now = new Date();

    for (const fire of stale) {
      await prisma.incident.update({
        where: { id: fire.id, organizationId },
        data: {
          lifecycleStatus: 'closed',
          closedAt: now,
          payload: {
            ...toJsonObject(fire.payload),
            operationalStatus: 'closed',
            autoClosedAt: now.toISOString(),
            autoCloseReason: fire.reason,
            latestSignalAt: fire.latestSignalAt.toISOString(),
          } as unknown as JsonInput,
        },
      });

      await prisma.fireAudit.create({
        data: {
          organizationId,
          fireId: fire.id,
          action: 'operational_update',
          actor: 'system:lifecycle',
          reason: `Closed automatically: ${fire.reason}`,
          payload: {
            lifecycleStatus: 'closed',
            cutoff: fire.cutoff.toISOString(),
            detectedAt: fire.detectedAt.toISOString(),
            latestSignalAt: fire.latestSignalAt.toISOString(),
          },
        },
      });
    }

    return { closed: stale.length, cutoff };
  },

  // Get statistics
  async getStats(organizationId: string) {
    try {
      const active = (
        await prisma.incident.findMany({
          where: {
            organizationId,
            ...jurisdictionLatLonWhere(),
            lifecycleStatus: 'active',
          },
          select: {
            lat: true,
            lon: true,
            status: true,
          },
        })
      ).filter(isFireRecordInJurisdiction);

      return {
        total: active.length,
        unconfirmed: active.filter((fire) => fire.status === 'unconfirmed').length,
        probable: active.filter((fire) => fire.status === 'probable').length,
        confirmed: active.filter((fire) => fire.status === 'confirmed').length,
        falsePositive: active.filter((fire) => fire.status === 'false_positive').length,
        extinguished: active.filter((fire) => fire.status === 'extinguished').length,
      };
    } catch (error) {
      console.error('[DB] Error getting stats:', error);
      return {
        total: 0,
        unconfirmed: 0,
        probable: 0,
        confirmed: 0,
        falsePositive: 0,
        extinguished: 0,
      };
    }
  },
};

function jurisdictionLatLonWhere(): Prisma.IncidentWhereInput {
  return {
    lat: {
      gte: JURISDICTION_BBOX.south,
      lte: JURISDICTION_BBOX.north,
    },
    lon: {
      gte: JURISDICTION_BBOX.west,
      lte: JURISDICTION_BBOX.east,
    },
  };
}

export function buildNearbyDetectionTimeWindow(referenceTime: Date, withinMinutes: number) {
  const windowMs = withinMinutes * 60 * 1000;
  return {
    since: new Date(referenceTime.getTime() - windowMs),
    until: new Date(referenceTime.getTime() + windowMs),
  };
}

function isFireRecordInJurisdiction(fire: { lat: number; lon: number }) {
  return isPointInJurisdiction(fire.lat, fire.lon);
}

function deriveDataFreshness(sources: FireSource[], manual?: boolean): DataFreshness {
  const freshness: DataFreshness = {};
  for (const source of sources) {
    if (source.source === 'FIRMS') {
      freshness.firms = source.ts;
      freshness.firmsPolar = source.ts;
    }
    if (source.source === 'GOES') freshness.goes = source.ts;
    if (source.layer === 'goes-fdcf') freshness.goesFdcf = source.ts;
    if (source.layer === 'firms-goes-nrt') freshness.firmsGeo = source.ts;
    if (source.layer === 'viirs-noaa21' || source.layer === 'viirs-noaa20' || source.layer === 'viirs-snpp') {
      freshness.viirs = source.ts;
    }
    if (source.layer === 'modis') freshness.modis = source.ts;
    if (source.source === 'SENTINEL3' || source.layer === 'sentinel3-slstr') freshness.sentinel3 = source.ts;
    if (source.source === 'HLS' || source.layer === 'sentinel2-hls' || source.layer === 'landsat-hls') freshness.hls = source.ts;
    if (source.source === 'THERMAL' || source.layer === 'thermal-anomaly') freshness.thermal = source.ts;
    if (source.source === 'MANUAL') freshness.manual = source.ts;
  }
  if (manual && !freshness.manual) freshness.manual = new Date().toISOString();
  if (sources.length > 0) {
    freshness.lastScan = sources
      .map((source) => source.ts)
      .sort()
      .at(-1);
    freshness.scan = freshness.lastScan;
  }
  return freshness;
}

function getLatestDetectionSignalAt(sources: unknown, dataFreshness: unknown, fallback: Date): Date {
  let latestMs = fallback.getTime();
  const assign = (value: unknown) => {
    if (typeof value !== 'string') return;
    const time = new Date(value).getTime();
    if (Number.isFinite(time) && time > latestMs) latestMs = time;
  };

  if (Array.isArray(sources)) {
    for (const source of sources) {
      if (isJsonObject(source)) assign(source.ts);
    }
  }

  if (isJsonObject(dataFreshness)) {
    assign(dataFreshness.goes);
    assign(dataFreshness.firms);
    assign(dataFreshness.manual);
    assign(dataFreshness.scan);
    assign(dataFreshness.lastScan);
  }

  return new Date(latestMs);
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {};
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

// Haversine distance calculation
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
