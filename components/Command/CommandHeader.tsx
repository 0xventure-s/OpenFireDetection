'use client';

import { Activity, Clock3, ShieldAlert, Wifi, WifiOff, User2 } from 'lucide-react';
import { JURISDICTION_NAME } from '@/lib/constants';

interface CommandHeaderProps {
  activeCount: number;
  newLast24h: number;
  confirmedOrProbable: number;
  lastScanLabel: string;
  isOnline: boolean;
  operatorId?: string | null;
}

export function CommandHeader({
  activeCount,
  newLast24h,
  confirmedOrProbable,
  lastScanLabel,
  isOnline,
  operatorId,
}: CommandHeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-[#050b16] px-4 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-orange-400">Sala de comando territorial</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">{JURISDICTION_NAME}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
            <div className="mb-1 flex items-center gap-2">
              {isOnline ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-red-400" />}
              <span>{isOnline ? 'Conectado' : 'Sin conexion'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <User2 size={14} />
              <span>{operatorId || 'Guardia operativa'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <CommandStat
          icon={<Activity size={16} className="text-cyan-400" />}
          label="Activos"
          value={activeCount}
          detail="Incidentes abiertos o en seguimiento"
        />
        <CommandStat
          icon={<ShieldAlert size={16} className="text-orange-400" />}
          label="Nuevos 24h"
          value={newLast24h}
          detail="Incidentes detectados en el ultimo dia"
        />
        <CommandStat
          icon={<ShieldAlert size={16} className="text-red-400" />}
          label="Alta atencion"
          value={confirmedOrProbable}
          detail="Confirmados o probables"
        />
        <CommandStat
          icon={<Clock3 size={16} className="text-slate-300" />}
          label="Ultimo escaneo"
          value={lastScanLabel}
          detail="Cadencia esperada de 10 minutos"
        />
      </div>
    </header>
  );
}

function CommandStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-semibold text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}
