'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Flame, LockKeyhole } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const result = await authClient.signIn.email({ email, password, rememberMe: false });

    if (result.error) {
      setError('Revisá el correo y la contraseña.');
      setIsPending(false);
      return;
    }

    const requestedPath = new URLSearchParams(window.location.search).get('continuar');
    const destination = requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/dashboard';
    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.13),transparent_28%),radial-gradient(circle_at_80%_85%,rgba(14,165,233,0.1),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="relative size-12 overflow-hidden rounded-xl bg-white shadow-2xl shadow-orange-950/40 ring-1 ring-white/20">
            <Image src="/openfire-mark.svg" alt="" fill sizes="48px" className="object-cover" priority />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">OpenFireDetection</p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Centro operativo</p>
          </div>
        </div>

        <Card className="border border-white/10 bg-slate-900/90 py-0 shadow-2xl shadow-black/40 ring-0 backdrop-blur-xl">
          <CardHeader className="border-b border-white/8 px-6 py-6">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-orange-500/12 text-orange-300 ring-1 ring-orange-400/20">
              <LockKeyhole aria-hidden="true" />
            </div>
            <CardTitle className="text-xl text-white">Inicio de guardia</CardTitle>
            <CardDescription className="text-slate-400">Ingresá con tu cuenta operativa.</CardDescription>
          </CardHeader>

          <CardContent className="px-6 py-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Correo</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  required
                  autoFocus
                  placeholder="nombre@organizacion.gob.ar"
                  className="h-11 border-white/10 bg-slate-950/70 px-3 text-white placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="h-11 border-white/10 bg-slate-950/70 px-3 pr-11 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              {error ? (
                <Alert variant="destructive" className="border-red-500/20 bg-red-500/8">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="lg" disabled={isPending} className="h-11 w-full bg-orange-500 text-slate-950 hover:bg-orange-400">
                {isPending ? <Spinner /> : <Flame />}
                {isPending ? 'Verificando…' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs text-slate-500">El acceso queda registrado en la bitácora operativa.</p>
      </div>
    </main>
  );
}
