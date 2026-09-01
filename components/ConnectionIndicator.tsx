'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function ConnectionIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 bg-red-600 text-white animate-pulse">
      <WifiOff size={18} />
      <span className="text-sm font-medium">Sin conexión</span>
    </div>
  );
}
