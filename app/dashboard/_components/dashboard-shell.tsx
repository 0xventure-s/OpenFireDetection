'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  BarChart3,
  BookOpenText,
  Download,
  History,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Truck,
  UserRound,
  Wrench,
} from 'lucide-react';
import { RightSidebar } from '@/components/Layout/RightSidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useScanStatus, useTriggerScan } from '@/hooks/useFires';
import { authClient } from '@/lib/auth-client';
import { exportRowsToCSV, exportToCSV } from '@/lib/export';
import { formatRelativeTime } from '@/lib/utils';
import type { CommandDashboardResponse, Fire, ScanStatusResponse } from '@/types';
import { useDashboard } from './dashboard-context';

type NavigationItem = {
  label: string;
  value: string | number;
  icon: ReactNode;
  href: string;
  active: boolean;
  warning?: boolean;
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const { command, operatorId, activeFires, selectedFire, setSelectedFireId } = useDashboard();
  const triggerScan = useTriggerScan();
  const { data: scanStatus } = useScanStatus();

  return (
    <SidebarProvider>
      <OperationalSidebar command={command} operatorId={operatorId} />
      <SidebarInset className="dashboard-shell-surface">
        <TopBar
          command={command}
          scanStatus={scanStatus}
          operatorId={operatorId}
          isScanning={triggerScan.isPending}
          onScan={() => triggerScan.mutate({ triggerType: 'manual' })}
          onExport={() => {
            exportToCSV(activeFires);
            toast.success('CSV exportado');
          }}
        />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</main>
      </SidebarInset>

      <Sheet open={Boolean(selectedFire)} onOpenChange={(open) => !open && setSelectedFireId(null)}>
        <SheetContent side="right" showCloseButton={false} className="z-[70] w-full gap-0 p-0 sm:max-w-xl">
          {selectedFire ? <RightSidebar fire={selectedFire as Fire} onClose={() => setSelectedFireId(null)} /> : null}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}

function OperationalSidebar({
  command,
  operatorId,
}: {
  command?: CommandDashboardResponse;
  operatorId: string;
}) {
  const pathname = usePathname();
  const totals = command?.overview.totals;
  const totalRecords = totals ? totals.active + totals.closed + totals.archived + totals.test : 0;
  const unitCount = command?.unitStatus.noCatalog ? 's/d' : command?.unitStatus.total ?? 0;
  const staleSources = command?.sourceHealth.filter((source) => source.status === 'stale' || source.status === 'missing').length ?? 0;
  const groups: Array<{ label: string; items: NavigationItem[] }> = [
    {
      label: 'Operación',
      items: [
        {
          label: 'Comando',
          value: command?.overview.totals.active ?? 0,
          icon: <LayoutDashboard />,
          href: '/dashboard',
          active: pathname === '/dashboard',
        },
      ],
    },
    {
      label: 'Recursos',
      items: [
        {
          label: 'Parque operativo',
          value: unitCount,
          icon: <Truck />,
          href: '/dashboard/recursos',
          active: pathname === '/dashboard/recursos',
          warning: command?.unitStatus.noCatalog,
        },
        {
          label: 'Mantenimiento',
          value: command?.maintenanceStatus.totalOpen ?? 0,
          icon: <Wrench />,
          href: '/dashboard/mantenimiento',
          active: pathname === '/dashboard/mantenimiento',
          warning: (command?.maintenanceStatus.overdue || 0) > 0,
        },
      ],
    },
    {
      label: 'Inteligencia',
      items: [
        {
          label: 'Análisis',
          value: totalRecords,
          icon: <BarChart3 />,
          href: '/dashboard/analisis',
          active: pathname === '/dashboard/analisis' || pathname === '/dashboard/graficos',
          warning: staleSources > 0,
        },
        {
          label: 'Historial',
          value: totalRecords,
          icon: <History />,
          href: '/dashboard/historial',
          active: pathname === '/dashboard/historial',
        },
      ],
    },
    {
      label: 'Sistema',
      items: [
        {
          label: 'Manual',
          value: '↗',
          icon: <BookOpenText />,
          href: '/manual',
          active: pathname === '/manual',
        },
      ],
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="inset" className="dashboard-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="OpenFireDetection">
              <Link href="/" className="gap-3">
                <span className="relative aspect-square size-9 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-sidebar-border">
                  <Image
                    src="/openfire-mark.svg"
                    alt=""
                    fill
                    sizes="36px"
                    className="object-cover"
                    priority
                  />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">OpenFireDetection</span>
                  <span className="truncate text-xs text-sidebar-foreground/65">Centro operativo</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={item.active} tooltip={item.label}>
                      <Link href={item.href}>
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className={item.warning ? 'text-amber-200' : undefined}>{item.value}</SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/70 p-2 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-sidebar-foreground/65">Operador</p>
          <p className="truncate text-sm font-medium">{operatorId}</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function TopBar({
  command,
  scanStatus,
  operatorId,
  isScanning,
  onScan,
  onExport,
}: {
  command?: CommandDashboardResponse;
  scanStatus?: ScanStatusResponse;
  operatorId: string;
  isScanning: boolean;
  onScan: () => void;
  onExport: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const title = getRouteTitle(pathname);
  const staleSources = command?.sourceHealth.filter((source) => source.status === 'stale' || source.status === 'missing').length ?? 0;

  return (
    <header className="dashboard-topbar sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:px-6">
      <SidebarTrigger />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-base font-semibold">{title}</h1>
          <Badge variant={staleSources > 0 ? 'outline' : 'secondary'}>{staleSources > 0 ? `${staleSources} fuentes atrasadas` : 'Datos al día'}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {scanStatus?.latestSuccess?.finishedAt
            ? `Último escaneo ${formatRelativeTime(scanStatus.latestSuccess.finishedAt)} / próximo ${formatRelativeTime(scanStatus.nextClientPollAt)}`
            : command?.generatedAt
              ? `Actualizado ${formatRelativeTime(command.generatedAt)}`
              : 'Esperando datos de comando'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onScan} disabled={isScanning}>
          <RefreshCw className={isScanning ? 'animate-spin' : undefined} />
          <span className="hidden sm:inline">Escanear</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Exportar CSV">
              <Download />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Exportar</DropdownMenuLabel>
            <DropdownMenuItem onClick={onExport}>Incidentes activos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportResources(command)}>Recursos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportMaintenance(command)}>Mantenimiento</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="max-w-48 gap-2 px-2" aria-label="Cuenta de operador">
              <UserRound />
              <span className="hidden truncate sm:inline">{operatorId}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="max-w-64 truncate">{operatorId}</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true);
                await authClient.signOut();
                router.replace('/login');
                router.refresh();
              }}
            >
              <LogOut />
              {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function exportResources(command?: CommandDashboardResponse) {
  const rows = [
    ...(command?.units || []).map((unit) => ({
      tipo_registro: 'unidad',
      codigo: unit.code,
      nombre: unit.name,
      tipo: unit.type,
      estado: unit.status,
      base: unit.station?.name || unit.baseName || '',
      patente: unit.licensePlate || '',
      litros: unit.capacityLiters || '',
      dotacion: unit.crewCapacity || '',
    })),
    ...(command?.assets || []).map((asset) => ({
      tipo_registro: 'activo',
      codigo: '',
      nombre: asset.name,
      tipo: asset.type,
      estado: asset.status,
      base: '',
      patente: '',
      litros: '',
      dotacion: '',
    })),
    ...(command?.stations || []).map((station) => ({
      tipo_registro: 'cuartel',
      codigo: station.code || '',
      nombre: station.name,
      tipo: 'station',
      estado: 'operativa',
      base: station.locality || station.address || '',
      patente: '',
      litros: '',
      dotacion: '',
    })),
  ];
  exportRowsToCSV(rows, 'recursos-jurisdiccion.csv');
}

function exportMaintenance(command?: CommandDashboardResponse) {
  const rows = (command?.units || []).flatMap((unit) =>
    (unit.maintenanceRecords || []).map((record) => ({
      unidad: unit.name,
      codigo: unit.code,
      trabajo: record.title,
      estado: record.status,
      vence: record.dueAt || '',
      responsable: record.performedBy || '',
      notas: record.notes || '',
    }))
  );
  exportRowsToCSV(rows, 'mantenimiento-jurisdiccion.csv');
}

function getRouteTitle(pathname: string) {
  if (pathname.includes('/dashboard/recursos')) return 'Parque operativo';
  if (pathname.includes('/dashboard/mantenimiento')) return 'Mantenimiento';
  if (pathname.includes('/dashboard/analisis') || pathname.includes('/dashboard/graficos')) return 'Análisis';
  if (pathname.includes('/dashboard/historial')) return 'Historial';
  return 'Centro operativo';
}
