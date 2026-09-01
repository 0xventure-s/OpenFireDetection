import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';
import { noteSchema } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operator = await requireOperator(request, 'incident.note');
    const { id } = await params;
    const validated = noteSchema.parse(await request.json());

    const fire = await db.getFireById(id, operator.organizationId);
    if (!fire) return fail(404, 'Fire not found');

    await db.updateFire(
      id,
      operator.organizationId,
      {},
      {
        action: 'note_added',
        actor: operator.id,
        reason: validated.notes,
      }
    );

    return ok({ fireId: id }, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return fail(error.status, 'Unauthorized', error.message);
    }
    if (error instanceof ZodError) {
      return fail(400, 'Validation error', error.errors[0]?.message);
    }
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}
