'use client';

import { useDashboard } from '../_components/dashboard-context';
import { AnalysisCenter } from '../_components/analysis-center';

export default function DashboardAnalysisPage() {
  const { setSelectedFireId } = useDashboard();

  return <AnalysisCenter onSelectIncident={setSelectedFireId} />;
}
