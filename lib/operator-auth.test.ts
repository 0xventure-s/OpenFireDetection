import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  findMembership: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    member: { findFirst: mocks.findMembership },
  },
}));

import { OperatorAuthError, requireOperator } from '@/lib/operator-auth';

describe('operator authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: 'user-1' },
      session: { activeOrganizationId: '00000000-0000-4000-8000-000000000001' },
    });
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      name: 'Guardia',
      email: 'guardia@example.test',
      status: 'active',
      mustChangePassword: false,
    });
    mocks.findMembership.mockResolvedValue({
      role: 'operator',
      organization: { id: '00000000-0000-4000-8000-000000000001', name: 'Jurisdicción demo' },
    });
  });

  it('ignores identity headers and rejects requests without a real session', async () => {
    mocks.getSession.mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/fire/scan', {
      headers: { 'x-operator-id': 'brigada-1' },
    });

    await expect(requireOperator(request)).rejects.toMatchObject<Partial<OperatorAuthError>>({
      status: 401,
      message: 'Iniciá sesión para continuar.',
    });
  });

  it('resolves the identity and organization from the authenticated membership', async () => {
    const request = new NextRequest('http://localhost/api/fire/scan');

    await expect(requireOperator(request, 'scan.trigger')).resolves.toEqual({
      id: 'user-1',
      name: 'Guardia',
      email: 'guardia@example.test',
      organizationId: '00000000-0000-4000-8000-000000000001',
      organizationName: 'Jurisdicción demo',
      role: 'operator',
      mustChangePassword: false,
    });
  });

  it('blocks permissions outside the membership role', async () => {
    mocks.findMembership.mockResolvedValue({
      role: 'viewer',
      organization: { id: '00000000-0000-4000-8000-000000000001', name: 'Jurisdicción demo' },
    });

    await expect(
      requireOperator(new NextRequest('http://localhost/api/fire/scan'), 'scan.trigger')
    ).rejects.toMatchObject<Partial<OperatorAuthError>>({ status: 403 });
  });

  it('requires changing the initial password before operational access', async () => {
    mocks.findUser.mockResolvedValue({
      id: 'user-1',
      name: 'Guardia',
      email: 'guardia@example.test',
      status: 'active',
      mustChangePassword: true,
    });

    await expect(
      requireOperator(new NextRequest('http://localhost/api/fire/scan'))
    ).rejects.toMatchObject<Partial<OperatorAuthError>>({ status: 403 });
  });
});
