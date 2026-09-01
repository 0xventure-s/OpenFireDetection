import { NextRequest } from 'next/server';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { detectOnJurisdiction } from '@/lib/detection';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { rateLimit } from '@/lib/rate-limit';
import { ScanTriggerType } from '@/types';

const limiter = rateLimit({
  windowMs: 60000, // 1 minute
  maxRequests: 10, // Max 10 scans per minute
});

/**
 * POST /api/fire/scan
 * Trigger a detection scan from an operator action or client polling.
 */
export async function POST(req: NextRequest) {
  let scanRunId: string | null = null;
  const startedAt = Date.now();

  try {
    const rateLimitResponse = await limiter(req);
    if (rateLimitResponse) return rateLimitResponse;

    const operator = await requireOperator(req, 'scan.trigger');
    const body = await readJsonBody(req);
    const triggerType = parseTriggerType(body?.triggerType);
    const scanRun = await db.createScanRun({
      organizationId: operator.organizationId,
      triggerType,
      triggeredBy: operator.id,
    });
    scanRunId = scanRun.id;

    const result = await detectOnJurisdiction(operator.organizationId);
    const duration = Date.now() - startedAt;
    await db.completeScanRun(scanRun.id, operator.organizationId, result, duration);

    return ok({
      ...result,
      scanRunId: scanRun.id,
      duration,
      triggerType,
      triggeredBy: operator.id,
    });
  } catch (error: unknown) {
    console.error('[API] Error during scan:', error);

    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }

    if (scanRunId) {
      const organizationId = await requireOperator(req, 'scan.trigger')
        .then((operator) => operator.organizationId)
        .catch(() => null);
      if (organizationId) await db.failScanRun(scanRunId, organizationId, getErrorMessage(error), Date.now() - startedAt).catch((scanError) => {
        console.error('[API] Error recording failed scan:', scanError);
      });
    }

    return fail(500, 'Scan failed', getErrorMessage(error));
  }
}

function parseTriggerType(value: unknown): ScanTriggerType {
  return value === 'polling' ? 'polling' : 'manual';
}

async function readJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
