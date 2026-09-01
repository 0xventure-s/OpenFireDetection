'use client';

import { Siren, TriangleAlert, BellRing, CheckCircle2 } from 'lucide-react';
import { CommandAlert } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { IncidentPriorityBadge } from './IncidentPriorityBadge';

interface AlertFeedProps {
  alerts: CommandAlert[];
  onSelect: (fireId: string) => void;
}

function getAlertIcon(kind: CommandAlert['kind']) {
  switch (kind) {
    case 'critical':
      return <Siren size={16} className="text-red-400" />;
    case 'confirmed':
      return <CheckCircle2 size={16} className="text-green-400" />;
    case 'updated':
      return <BellRing size={16} className="text-orange-400" />;
    default:
      return <TriangleAlert size={16} className="text-cyan-400" />;
  }
}

export function AlertFeed({ alerts, onSelect }: AlertFeedProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.35)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Centro de alertas</h2>
          <p className="text-xs text-slate-500">Eventos priorizados del turno</p>
        </div>
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-300">{alerts.length}</span>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-sm text-slate-500">
            Sin alertas recientes.
          </div>
        ) : (
          alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => onSelect(alert.fireId)}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
            >
              <div className="mt-0.5">{getAlertIcon(alert.kind)}</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-slate-100">{alert.title}</div>
                  <IncidentPriorityBadge priority={alert.priority} compact />
                </div>
                <div className="text-xs text-slate-400">{alert.detail}</div>
                <div className="mt-1 text-[11px] text-slate-500">{formatRelativeTime(alert.createdAt)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
