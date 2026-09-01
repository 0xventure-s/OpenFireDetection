'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useCommandDashboard } from '@/hooks/useFires';
import { useAutoScan } from '@/hooks/useAutoScan';
import { useFireNotifications } from '@/hooks/useFireNotifications';
import { authClient } from '@/lib/auth-client';
import type { CommandDashboardResponse, CommandIncident, Fire } from '@/types';

type DashboardContextValue = {
  command?: CommandDashboardResponse;
  commandError: unknown;
  commandIsError: boolean;
  isLoading: boolean;
  operatorId: string;
  activeFires: Fire[];
  mapFires: Fire[];
  actionQueue: CommandIncident[];
  search: string;
  setSearch: (value: string) => void;
  visibleQueue: CommandIncident[];
  selectedFire: Fire | CommandIncident | null;
  selectedFireId: string | null;
  setSelectedFireId: (value: string | null) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const { data: command, error: commandError, isError: commandIsError, isLoading } = useCommandDashboard();
  const [search, setSearch] = useState('');
  const [selectedFireId, setSelectedFireId] = useState<string | null>(null);

  const operatorId = session?.user.name || session?.user.email || 'Operador';
  const activeFires = useMemo(() => command?.activeFires || [], [command?.activeFires]);
  const mapFires = useMemo(() => activeFires, [activeFires]);
  const actionQueue = useMemo(() => command?.actionQueue || [], [command?.actionQueue]);

  useFireNotifications(activeFires, true);
  useAutoScan(true);

  const visibleQueue = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return actionQueue;

    return actionQueue.filter((fire) => {
      const assignment = fire.assignment?.unit?.name || fire.assignment?.unitName || fire.assignedUnit || '';
      return (
        fire.id.toLowerCase().includes(query) ||
        fire.lat.toString().includes(query) ||
        fire.lon.toString().includes(query) ||
        assignment.toLowerCase().includes(query) ||
        fire.actionReason.toLowerCase().includes(query) ||
        fire.tacticalSummary.toLowerCase().includes(query)
      );
    });
  }, [actionQueue, search]);

  const selectedFire = useMemo(
    () =>
      actionQueue.find((fire) => fire.id === selectedFireId) ||
      activeFires.find((fire) => fire.id === selectedFireId) ||
      command?.overview.recent.find((fire) => fire.id === selectedFireId) ||
      null,
    [actionQueue, activeFires, command?.overview.recent, selectedFireId]
  );

  return (
    <DashboardContext.Provider
      value={{
        command,
        commandError,
        commandIsError,
        isLoading,
        operatorId,
        activeFires,
        mapFires,
        actionQueue,
        search,
        setSearch,
        visibleQueue,
        selectedFire,
        selectedFireId,
        setSelectedFireId,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used inside DashboardProvider');
  return context;
}
