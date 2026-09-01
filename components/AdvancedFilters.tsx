'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

interface AdvancedFiltersProps {
  onClose: () => void;
  onApply: (filters: AdvancedFilterValues) => void;
  currentFilters: AdvancedFilterValues;
}

export interface AdvancedFilterValues {
  minFRP?: number;
  maxFRP?: number;
  dateFrom?: string;
  dateTo?: string;
  minDetections?: number;
}

export function AdvancedFilters({ onClose, onApply, currentFilters }: AdvancedFiltersProps) {
  const [filters, setFilters] = useState<AdvancedFilterValues>(currentFilters);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: AdvancedFilterValues = {};
    setFilters(emptyFilters);
    onApply(emptyFilters);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-2xl max-w-md w-full border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="text-blue-500" size={24} />
            <h3 className="text-lg font-bold text-white">Filtros Avanzados</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* FRP Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Potencia (MW)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Mínimo</label>
                <input
                  type="number"
                  step="0.1"
                  value={filters.minFRP || ''}
                  onChange={(e) => setFilters({ ...filters, minFRP: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Máximo</label>
                <input
                  type="number"
                  step="0.1"
                  value={filters.maxFRP || ''}
                  onChange={(e) => setFilters({ ...filters, maxFRP: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="100"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Rango de Fechas
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Desde</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hasta</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Min Detections */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Detecciones Mínimas
            </label>
            <input
              type="number"
              min="1"
              value={filters.minDetections || ''}
              onChange={(e) => setFilters({ ...filters, minDetections: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="1"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Mostrar solo incendios con al menos N detecciones satelitales
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button
            onClick={handleReset}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Limpiar
          </button>
          <button
            onClick={handleApply}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}
