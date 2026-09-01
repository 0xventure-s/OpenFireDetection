import { NextRequest } from 'next/server';
import { fail } from '@/lib/api';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import type { OperationalCapability } from '@/lib/auth-roles';

export async function guardFireApi(
  request: NextRequest,
  capability: OperationalCapability = 'incident.read'
) {
  try {
    await requireOperator(request, capability);
    return null;
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }

    throw error;
  }
}
