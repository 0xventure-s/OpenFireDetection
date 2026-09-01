'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useAddFireNote } from '@/hooks/useFires';

interface NotesModalProps {
  fireId: string;
  onClose: () => void;
  onSave: (notes: string) => void;
}

export function NotesModal({ fireId, onClose, onSave }: NotesModalProps) {
  const addNote = useAddFireNote();
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error('Por favor ingresa las notas');
      return;
    }

    try {
      await addNote.mutateAsync({ id: fireId, notes: notes.trim() });
      onSave(notes.trim());
      onClose();
    } catch {
      toast.error('No se pudieron guardar las notas');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h3 className="text-lg font-bold text-white">Agregar notas del operativo</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <label className="mb-2 block text-sm font-semibold text-slate-300">Notas del operativo</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej: unidades despachadas, tiempo de control, danos, observaciones."
            className="h-40 w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="mt-2 text-xs text-slate-400">{notes.length} caracteres</div>

          <div className="mt-4 rounded-lg bg-slate-800 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-300">Sugerencias</div>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>- Unidades y personal movilizado.</li>
              <li>- Tiempo de respuesta y control.</li>
              <li>- Danos materiales o heridos.</li>
              <li>- Causa probable.</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-700 p-4">
          <button
            onClick={onClose}
            disabled={addNote.isPending}
            className="flex-1 rounded-lg bg-slate-700 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={addNote.isPending || !notes.trim()}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {addNote.isPending ? 'Guardando...' : 'Guardar notas'}
          </button>
        </div>
      </div>
    </div>
  );
}
