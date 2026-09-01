'use client';

import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    { key: 'R', description: 'Reportar nuevo incidente' },
    { key: 'C', description: 'Abrir confirmacion contextual del incidente' },
    { key: 'Escape', description: 'Cerrar modales o deseleccionar' },
    { key: '?', description: 'Mostrar esta ayuda' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2">
            <Keyboard className="text-blue-500" size={24} />
            <h3 className="text-lg font-bold text-white">Atajos de teclado</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-2">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
                <span className="text-sm text-slate-300">{shortcut.description}</span>
                <kbd className="rounded border border-slate-600 bg-slate-700 px-3 py-1 font-mono text-sm text-white">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-blue-700 bg-blue-900/20 p-4">
            <div className="text-xs text-blue-300">
              <strong>Tip:</strong> Los atajos no funcionan mientras escribes en campos de texto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
