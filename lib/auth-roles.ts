export type OperationalCapability =
  | 'incident.read'
  | 'incident.report'
  | 'incident.review'
  | 'incident.confirm'
  | 'incident.dispatch'
  | 'incident.close'
  | 'incident.archive'
  | 'incident.note'
  | 'resource.read'
  | 'resource.create'
  | 'resource.update'
  | 'resource.import'
  | 'resource.assign'
  | 'resource.release'
  | 'maintenance.read'
  | 'maintenance.create'
  | 'maintenance.update'
  | 'scan.read'
  | 'scan.trigger'
  | 'audit.read'
  | 'audit.export'
  | 'settings.read'
  | 'settings.update';

const allCapabilities: readonly OperationalCapability[] = [
  'incident.read', 'incident.report', 'incident.review', 'incident.confirm', 'incident.dispatch',
  'incident.close', 'incident.archive', 'incident.note', 'resource.read', 'resource.create',
  'resource.update', 'resource.import', 'resource.assign', 'resource.release', 'maintenance.read',
  'maintenance.create', 'maintenance.update', 'scan.read', 'scan.trigger', 'audit.read',
  'audit.export', 'settings.read', 'settings.update',
];

export const roleCapabilities = {
  owner: allCapabilities,
  admin: allCapabilities,
  commander: allCapabilities.filter((capability) => capability !== 'settings.update'),
  operator: [
    'incident.read', 'incident.report', 'incident.review', 'incident.confirm', 'incident.dispatch',
    'incident.note', 'resource.read', 'resource.assign', 'resource.release', 'maintenance.read',
    'scan.read', 'scan.trigger', 'audit.read', 'settings.read',
  ],
  viewer: ['incident.read', 'resource.read', 'maintenance.read', 'scan.read', 'settings.read'],
  auditor: ['incident.read', 'resource.read', 'maintenance.read', 'scan.read', 'audit.read', 'audit.export', 'settings.read'],
} as const satisfies Record<string, readonly OperationalCapability[]>;

export type OrganizationRole = keyof typeof roleCapabilities;

export const organizationRoleLabels: Record<OrganizationRole, string> = {
  owner: 'Responsable',
  admin: 'Administrador',
  commander: 'Jefatura',
  operator: 'Operador',
  viewer: 'Consulta',
  auditor: 'Auditoría',
};

export function isOrganizationRole(value: string): value is OrganizationRole {
  return value in roleCapabilities;
}

export function roleHasCapability(role: string, capability: OperationalCapability) {
  return isOrganizationRole(role) && (roleCapabilities[role] as readonly OperationalCapability[]).includes(capability);
}
