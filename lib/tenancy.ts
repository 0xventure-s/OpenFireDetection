export const COMMUNITY_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

export function requireOrganizationId(value: string) {
  const organizationId = value.trim();
  if (!organizationId) throw new Error('Organization context is required.');
  return organizationId;
}
