import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'La sesión venció. Volvé a ingresar.' }, { status: 401 });
  }

  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 12 caracteres.' }, { status: 400 });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: 'Elegí una contraseña distinta de la inicial.' }, { status: 400 });
  }

  try {
    await auth.api.changePassword({
      headers: request.headers,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: { mustChangePassword: false },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'La contraseña inicial no es correcta.' }, { status: 400 });
  }
}

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  const trusted = new Set([
    request.nextUrl.origin,
    ...(process.env.AUTH_TRUSTED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  ]);
  return trusted.has(origin);
}
