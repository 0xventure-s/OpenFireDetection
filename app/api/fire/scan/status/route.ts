import { NextRequest } from 'next/server';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';

export async function GET(request: NextRequest) {
  try {
    const operator = await requireOperator(request, 'scan.read');
    return ok(await db.getScanStatus(operator.organizationId));
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }

    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
