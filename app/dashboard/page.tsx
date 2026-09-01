'use client';

import { useDashboard } from './_components/dashboard-context';
import {
  CommandOverview,
  DashboardDataBanner,
  DecisionQueue,
  MapCommandCenter,
} from './_components/dashboard-widgets';

export default function DashboardPage() {
  const {
    command,
    commandError,
    commandIsError,
    isLoading,
    mapFires,
    actionQueue,
    visibleQueue,
    selectedFireId,
    search,
    setSearch,
    setSelectedFireId,
  } = useDashboard();

  return (
    <>
      <DashboardDataBanner command={command} error={commandError} isError={commandIsError} isLoading={isLoading} />
      <CommandOverview command={command} isLoading={isLoading} />

      <section className="command-workbench">
        <MapCommandCenter
          fires={mapFires}
          selectedFireId={selectedFireId}
          onSelect={setSelectedFireId}
          units={command?.units || []}
          stations={command?.stations || []}
          assets={command?.assets || []}
        />
        <DecisionQueue
          fires={visibleQueue}
          total={actionQueue.length}
          isLoading={isLoading}
          selectedFireId={selectedFireId}
          search={search}
          onSearchChange={setSearch}
          onSelect={setSelectedFireId}
        />
      </section>
    </>
  );
}
