'use client';

import { useEffect, useState } from 'react';
import { Flame, Clock3, ShieldCheck } from 'lucide-react';
import { Fire } from '@/types';
import { formatCoordinates, formatDate } from '@/lib/utils';
import { STATUS_COLORS } from '@/lib/constants';
import {
  getDetectionCount,
  getMaxFrp,
  getOperationalStatusLabel,
  getPrimarySourceLabel,
  getStatusLabel,
} from '@/lib/fire-utils';
import { getLocationName } from '@/lib/geocoding';
import { IncidentPriorityBadge } from '@/components/Command/IncidentPriorityBadge';

interface FireCardProps {
  fire: Fire;
  isSelected: boolean;
  onClick: () => void;
}

export function FireCard({ fire, isSelected, onClick }: FireCardProps) {
  const [locationName, setLocationName] = useState('');
  const detectionCount = getDetectionCount(fire);
  const maxFrp = getMaxFrp(fire);

  useEffect(() => {
    let cancelled = false;
    getLocationName(fire.lat, fire.lon)
      .then((name) => {
        if (!cancelled) setLocationName(name);
      })
      .catch(() => {
        if (!cancelled) setLocationName('');
      });
    return () => {
      cancelled = true;
    };
  }, [fire.id, fire.lat, fire.lon]);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-3 text-left transition-all ${
        isSelected
          ? 'border-orange-500 bg-orange-600/10 shadow-[0_0_0_1px_rgba(249,115,22,0.15)]'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame
            size={20}
            fill={STATUS_COLORS[fire.status]}
            color={STATUS_COLORS[fire.status]}
            className="mt-0.5 flex-shrink-0"
          />
          <div className="text-sm font-semibold text-slate-100">{locationName || 'Ubicacion en resolucion'}</div>
        </div>
        <IncidentPriorityBadge priority={fire.priority || 'low'} compact />
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: `${STATUS_COLORS[fire.status]}20`,
            color: STATUS_COLORS[fire.status],
          }}
        >
          {getStatusLabel(fire.status)}
        </span>
        <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">
          {getOperationalStatusLabel(fire.operationalStatus || 'unreviewed')}
        </span>
      </div>

      <div className="mb-2 text-xs text-slate-400">{formatCoordinates(fire.lat, fire.lon)}</div>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Clock3 size={12} />
          <span>{formatDate(fire.detectedAt)}</span>
        </div>
        <div>{detectionCount} deteccion(es)</div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-slate-500">
          <ShieldCheck size={12} />
          <span>{getPrimarySourceLabel(fire.confirmedBy)}</span>
        </div>
        {maxFrp > 0 ? <div className="font-semibold text-orange-300">{maxFrp.toFixed(1)} MW</div> : null}
      </div>
    </button>
  );
}
