'use client';

import { IncidentPriority } from '@/types';
import { getPriorityColor, getPriorityLabel } from '@/lib/fire-utils';

interface IncidentPriorityBadgeProps {
  priority: IncidentPriority;
  compact?: boolean;
}

export function IncidentPriorityBadge({ priority, compact = false }: IncidentPriorityBadgeProps) {
  const color = getPriorityColor(priority);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold uppercase tracking-wide ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
      style={{
        color,
        borderColor: `${color}99`,
        backgroundColor: `${color}20`,
      }}
    >
      {getPriorityLabel(priority)}
    </span>
  );
}
