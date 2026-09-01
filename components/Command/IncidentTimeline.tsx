'use client';

import { FireAudit } from '@/types';
import type { OperationalStatus } from '@/types';
import { getOperationalStatusLabel } from '@/lib/fire-utils';
import { formatRelativeTime } from '@/lib/utils';

interface IncidentTimelineProps {
  entries: FireAudit[];
}

const MAX_VISIBLE_ENTRIES = 7;

export function IncidentTimeline({ entries }: IncidentTimelineProps) {
  const { visibleEntries, hiddenCount } = compactTimelineEntries(entries);

  return (
    <section className="px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Bitacora</h3>
        {entries.length > 0 ? <span className="text-xs text-slate-500">{entries.length} eventos</span> : null}
      </div>

      <div>
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
            Sin actividad registrada.
          </div>
        ) : (
          <>
            {visibleEntries.map((entry, index) => (
              <div key={entry.id} className="relative grid grid-cols-[0.875rem_1fr] gap-3 pb-4 last:pb-0">
                {index < visibleEntries.length - 1 ? <div className="absolute left-[0.406rem] top-3 h-full w-px bg-slate-300" /> : null}
                <div className="relative z-10 mt-1 h-3 w-3 rounded-full border border-orange-300 bg-orange-100" />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-slate-900">{formatAction(entry)}</div>
                    <div className="flex-shrink-0 text-[11px] text-slate-500">{formatRelativeTime(entry.createdAt)}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{entry.actor}</div>
                  {formatReason(entry) ? <div className="mt-1 text-sm leading-snug text-slate-700">{formatReason(entry)}</div> : null}
                </div>
              </div>
            ))}
            {hiddenCount > 0 ? <div className="pt-3 text-xs text-slate-500">{hiddenCount} eventos repetidos o antiguos ocultos.</div> : null}
          </>
        )}
      </div>
    </section>
  );
}

function compactTimelineEntries(entries: FireAudit[]) {
  const seenOperationalStates = new Set<string>();
  const visibleEntries: FireAudit[] = [];
  let hiddenCount = 0;

  for (const entry of entries) {
    if (entry.action === 'operational_update') {
      const key = parseOperationalStatus(entry.reason) || entry.reason || entry.action;
      if (seenOperationalStates.has(key)) {
        hiddenCount += 1;
        continue;
      }
      seenOperationalStates.add(key);
    }

    if (visibleEntries.length < MAX_VISIBLE_ENTRIES) {
      visibleEntries.push(entry);
    } else {
      hiddenCount += 1;
    }
  }

  return { visibleEntries, hiddenCount };
}

function formatAction(entry: FireAudit) {
  switch (entry.action) {
    case 'operational_update':
      return 'Estado operativo';
    case 'manual_add':
      return 'Alta manual';
    case 'note_added':
      return 'Nota de campo';
    case 'rejected':
      return 'Descartado';
    case 'confirmed':
      return 'Confirmado';
    case 'extinguished':
      return 'Extinguido';
    case 'deleted':
      return 'Archivado';
    default:
      return entry.action.replaceAll('_', ' ');
  }
}

function formatReason(entry: FireAudit) {
  if (entry.action === 'operational_update') {
    const status = parseOperationalStatus(entry.reason);
    if (status) return `Estado operativo: ${getOperationalStatusLabel(status)}`;
  }
  return entry.reason;
}

function parseOperationalStatus(reason: string | null): OperationalStatus | null {
  const status = reason?.match(/Operational status updated to ([a-z_]+)/)?.[1];
  if (
    status === 'unreviewed' ||
    status === 'evaluating' ||
    status === 'dispatched' ||
    status === 'monitoring' ||
    status === 'closed'
  ) {
    return status;
  }
  return null;
}
