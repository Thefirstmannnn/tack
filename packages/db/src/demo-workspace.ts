export const DEMO_ORGANIZATION_ID = 'org_tack_demo';
export const DEMO_WORKSPACE_TIMEZONE = 'Etc/UTC';

export function demoOrganizationValues(createdAt: Date) {
  return {
    id: DEMO_ORGANIZATION_ID,
    name: 'Tack Demo',
    slug: 'tack-demo',
    logo: null,
    allowedEmailDomains: ['tack.example'],
    createdAt,
  };
}
