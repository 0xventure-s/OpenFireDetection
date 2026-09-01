'use client';

import { Fire } from '@/types';
import { compareByPriorityAndTime } from '@/lib/fire-utils';
import { FireCard } from '@/components/Fires/FireCard';

interface IncidentQueueProps {
  fires: Fire[];
  selectedFireId: string | null;
  onSelect: (fireId: string) => void;
}

export function IncidentQueue({ fires, selectedFireId, onSelect }: IncidentQueueProps) {
  const sortedFires = [...fires].sort(compareByPriorityAndTime);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.35)]">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Incidentes activos</h2>
        <p className="text-xs text-slate-500">Priorizada por severidad y recencia.</p>
      </div>

      <div className="space-y-2">
        {sortedFires.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
            No hay incidentes para mostrar.
          </div>
        ) : (
          sortedFires.map((fire) => (
            <FireCard
              key={fire.id}
              fire={fire}
              isSelected={selectedFireId === fire.id}
              onClick={() => onSelect(fire.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
