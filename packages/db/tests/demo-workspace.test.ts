import { describe, expect, it } from 'bun:test';
import {
  DEMO_ORGANIZATION_ID,
  DEMO_WORKSPACE_TIMEZONE,
  demoOrganizationValues,
} from '../src/demo-workspace.ts';
import { SEED_USERS } from '../src/seed/data.ts';

describe('demo workspace', () => {
  it('defines the neutral Tack organization and seeded user matrix', () => {
    const createdAt = new Date('2026-08-08T00:00:00.000Z');

    expect(DEMO_ORGANIZATION_ID).toBe('org_tack_demo');
    expect(DEMO_WORKSPACE_TIMEZONE).toBe('Etc/UTC');
    expect(demoOrganizationValues(createdAt)).toEqual({
      id: 'org_tack_demo',
      name: 'Tack Demo',
      slug: 'tack-demo',
      logo: null,
      allowedEmailDomains: ['tack.example'],
      createdAt,
    });
    expect(SEED_USERS).toEqual([
      {
        handle: 'alex',
        name: 'Alex Morgan',
        email: 'alex@tack.example',
        role: 'admin',
        teams: ['ENG', 'DES', 'MKT'],
      },
      {
        handle: 'sam',
        name: 'Sam Rivera',
        email: 'sam@tack.example',
        role: 'admin',
        teams: ['ENG', 'MKT'],
      },
      {
        handle: 'jordan',
        name: 'Jordan Lee',
        email: 'jordan@tack.example',
        role: 'member',
        teams: ['ENG', 'DES'],
      },
      {
        handle: 'taylor',
        name: 'Taylor Kim',
        email: 'taylor@tack.example',
        role: 'member',
        teams: ['MKT'],
      },
      {
        handle: 'casey',
        name: 'Casey Chen',
        email: 'casey@tack.example',
        role: 'member',
        teams: ['ENG', 'DES'],
      },
      {
        handle: 'robin',
        name: 'Robin Park',
        email: 'robin@tack.example',
        role: 'contributor',
        teams: ['ENG'],
      },
      {
        handle: 'drew',
        name: 'Drew Ellis',
        email: 'drew@tack.example',
        role: 'guest',
        teams: ['MKT'],
      },
    ]);
  });
});
