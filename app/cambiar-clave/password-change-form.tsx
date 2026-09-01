'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export function PasswordChangeForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmation = String(formData.get('confirmation') || '');

    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setIsPending(true);
    const response = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error || 'No pudimos actualizar la contraseña.');
      setIsPending(false);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="relative size-11 overflow-hidden rounded-xl bg-white ring-1 ring-white/20">
            <Image src="/openfire-mark.svg" alt="" fill sizes="44px" className="object-cover" />
          </span>
          <div>
            <p className="font-semibold">OpenFireDetection</p>
            <p className="text-xs text-slate-500">Protección de la cuenta</p>
          </div>
        </div>

        <Card className="border border-white/10 bg-slate-900 py-0 ring-0">
          <CardHeader className="border-b border-white/8 px-6 py-6">
            <ShieldCheck className="mb-3 text-emerald-400" aria-hidden="true" />
            <CardTitle className="text-xl text-white">Creá tu contraseña</CardTitle>
            <CardDescription className="text-slate-400">
              Usá 12 caracteres o más. Combiná palabras, números y símbolos.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <PasswordField id="currentPassword" label="Contraseña inicial" autoComplete="current-password" />
              <PasswordField id="newPassword" label="Nueva contraseña" autoComplete="new-password" minLength={12} />
              <PasswordField id="confirmation" label="Repetir nueva contraseña" autoComplete="new-password" minLength={12} />

              {error ? (
                <Alert variant="destructive" className="border-red-500/20 bg-red-500/8">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="lg" disabled={isPending} className="mt-2 h-11 w-full bg-orange-500 text-slate-950 hover:bg-orange-400">
                {isPending ? <Spinner /> : <KeyRound />}
                {isPending ? 'Guardando…' : 'Guardar y continuar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-slate-200">{label}</Label>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className="h-11 border-white/10 bg-slate-950/70 px-3 text-white"
      />
    </div>
  );
}
