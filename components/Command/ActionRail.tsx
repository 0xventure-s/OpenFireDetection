'use client';

import { Download, Keyboard, Plus, SlidersHorizontal } from 'lucide-react';

interface ActionRailProps {
  onExport: () => void;
  onOpenFilters: () => void;
  onOpenShortcuts: () => void;
  onOpenAddFire: () => void;
}

export function ActionRail({
  onExport,
  onOpenFilters,
  onOpenShortcuts,
  onOpenAddFire,
}: ActionRailProps) {
  return (
    <div className="absolute right-5 top-5 z-50 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/88 p-2 shadow-[0_18px_40px_rgba(2,6,23,0.4)] backdrop-blur">
      <button onClick={onOpenAddFire} className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700">
        <span className="flex items-center gap-2">
          <Plus size={16} />
          Reportar
        </span>
      </button>
      <button onClick={onExport} className="rounded-md bg-slate-900 px-3 py-2 text-slate-200 transition-colors hover:bg-slate-800" title="Exportar CSV">
        <Download size={16} />
      </button>
      <button onClick={onOpenFilters} className="rounded-md bg-slate-900 px-3 py-2 text-slate-200 transition-colors hover:bg-slate-800" title="Filtros avanzados">
        <SlidersHorizontal size={16} />
      </button>
      <button onClick={onOpenShortcuts} className="rounded-md bg-slate-900 px-3 py-2 text-slate-200 transition-colors hover:bg-slate-800" title="Atajos">
        <Keyboard size={16} />
      </button>
    </div>
  );
}
