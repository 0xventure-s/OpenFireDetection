import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { roleHasCapability, type OperationalCapability, type OrganizationRole } from '@/lib/auth-roles';
import { COMMUNITY_ORGANIZATION_ID } from '@/lib/tenancy';

const requestIdentity = new WeakMap<NextRequest, OperatorIdentity>();

export interface OperatorIdentity {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
  mustChangePassword: boolean;
}

export class OperatorAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireOperator(
  request: NextRequest,
  capability: OperationalCapability = 'incident.read'
): Promise<OperatorIdentity> {
  const cached = requestIdentity.get(request);
  if (cached) {
    if (!roleHasCapability(cached.role, capability)) {
      throw new OperatorAuthError('No tenés permisos para realizar esta acción.', 403);
    }
    return cached;
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    throw new OperatorAuthError('Iniciá sesión para continuar.', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mustChangePassword: true,
    },
  });

  if (!user || user.status !== 'active') {
    throw new OperatorAuthError('La cuenta no está habilitada.', 403);
  }

  if (user.mustChangePassword) {
    throw new OperatorAuthError('Cambiá la contraseña inicial para continuar.', 403);
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  if (activeOrganizationId !== COMMUNITY_ORGANIZATION_ID) {
    throw new OperatorAuthError('La sesión no tiene una organización activa.', 403);
  }

  const membership = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organizationId: activeOrganizationId,
      status: 'active',
      organization: { status: 'active' },
    },
    select: {
      role: true,
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!membership || !roleHasCapability(membership.role, capability)) {
    throw new OperatorAuthError('No tenés permisos para realizar esta acción.', 403);
  }

  const identity: OperatorIdentity = {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    role: membership.role as OrganizationRole,
    mustChangePassword: user.mustChangePassword,
  };
  requestIdentity.set(request, identity);
  return identity;
}
