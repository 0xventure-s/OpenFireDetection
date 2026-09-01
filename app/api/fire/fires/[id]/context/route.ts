import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { guardFireApi } from '../../../_auth';
import { enrichFire } from '@/lib/fire-utils';
import { buildIncidentContext } from '@/lib/incident-context';
import { Fire } from '@/types';
import { requireOperator } from '@/lib/operator-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResponse = await guardFireApi(request);
    if (authResponse) return authResponse;
    const operator = await requireOperator(request);

    const { id } = await params;
    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    const enriched = enrichFire(fire as unknown as Fire);
    const { weather, terrain, projection, operations } = await buildIncidentContext(enriched);

    return ok({
      fireId: id,
      weather,
      terrain,
      projection,
      operations,
      layers: {
        available: ['satellite', 'incidents', 'measurements', 'thermal', 'lightning', 'hls', 'sentinel3'],
        planned: ['camera-ai'],
      },
    });
  } catch (error) {
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
