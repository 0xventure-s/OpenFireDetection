'use client';

import type { ReactNode } from 'react';
import { DashboardProvider } from './_components/dashboard-context';
import { DashboardShell } from './_components/dashboard-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
