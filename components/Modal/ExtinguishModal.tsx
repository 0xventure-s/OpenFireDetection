'use client';

import { X, Droplet, MapPin, Clock } from 'lucide-react';
import { Fire } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { getMaxFrp } from '@/lib/fire-utils';

interface ExtinguishModalProps {
  fire: Fire;
  locationName: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ExtinguishModal({
  fire,
  locationName,
  onClose,
  onConfirm,
  isLoading = false,
}: ExtinguishModalProps) {
  const maxFrp = getMaxFrp(fire);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-blue-500/50 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div className="flex items-center gap-2">
            <Droplet className="text-blue-500" size={24} />
            <h3 className="text-lg font-bold text-white">Marcar como extinguido</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-blue-700 bg-blue-900/20 p-4 text-sm text-blue-300">
            Esta accion cambia el estado del foco a <strong>extinguido</strong> y deja trazabilidad operativa.
          </div>

          <div className="space-y-3 rounded-lg bg-slate-800 p-4">
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 text-slate-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-400">Ubicacion</div>
                <div className="text-sm font-semibold text-slate-200">{locationName}</div>
                <div className="font-mono text-xs text-slate-500">
                  {fire.lat.toFixed(4)}°, {fire.lon.toFixed(4)}°
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock size={16} className="mt-0.5 text-slate-400" />
              <div className="flex-1">
                <div className="text-xs text-slate-400">Detectado</div>
                <div className="text-sm font-semibold text-slate-200">{formatRelativeTime(fire.detectedAt)}</div>
                <div className="text-xs text-slate-500">{formatDate(fire.detectedAt)}</div>
              </div>
            </div>

            {maxFrp > 0 ? (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-slate-400">FRP</span>
                <div className="flex-1">
                  <div className="text-xs text-slate-400">Potencia maxima</div>
                  <div className="text-sm font-semibold text-orange-400">{maxFrp.toFixed(1)} MW</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-700 p-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-slate-700 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-800"
          >
            <Droplet size={18} />
            {isLoading ? 'Procesando...' : 'Confirmar extincion'}
          </button>
        </div>
      </div>
    </div>
  );
}
