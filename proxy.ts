import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const protectedPaths = ['/', '/dashboard', '/manual', '/cambiar-clave'];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await auth.api.getSession({ headers: request.headers });
  const isProtected = protectedPaths.some(
    (path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`))
  );

  if (!session && isProtected && pathname !== '/login') {
    const loginURL = new URL('/login', request.url);
    loginURL.searchParams.set('continuar', `${pathname}${search}`);
    return NextResponse.redirect(loginURL);
  }

  if (!session) return NextResponse.next();

  const mustChangePassword = Boolean(session.user.mustChangePassword);
  if (mustChangePassword && pathname !== '/cambiar-clave') {
    return NextResponse.redirect(new URL('/cambiar-clave', request.url));
  }

  if (!mustChangePassword && (pathname === '/login' || pathname === '/cambiar-clave')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/cambiar-clave', '/dashboard/:path*', '/manual/:path*'],
};
