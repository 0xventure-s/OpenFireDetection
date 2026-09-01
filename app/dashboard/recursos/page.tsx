'use client';

import { useDashboard } from '../_components/dashboard-context';
import { DashboardDataBanner } from '../_components/dashboard-widgets';
import { ResourceManagementPanel } from '../_components/operational-resource-panels';

export default function DashboardResourcesPage() {
  const { command, commandError, commandIsError, isLoading } = useDashboard();

  return (
    <>
      <DashboardDataBanner command={command} error={commandError} isError={commandIsError} isLoading={isLoading} />
      <ResourceManagementPanel />
    </>
  );
}
