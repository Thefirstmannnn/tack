import { describe, expect, it } from 'bun:test';
import { db, sql } from '@tack/db';
import {
  githubInstallation,
  githubRepository,
  integration,
  member,
  organization,
  user,
} from '@tack/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  bindGithubInstallation,
  findGithubInstallation,
  listGithubInstallations,
  removeGithubInstallation,
  replaceGithubRepositories,
  setGithubInstallationStatus,
} from '../../src/github/installations.ts';
import { type TestTransaction, withRollback } from '../../src/test-database.ts';
import { account, repository, seedWorkspace, type TestWorkspace } from './fixtures.ts';

const PRIMARY = '151887625';
const SECONDARY = '151889033';

function bind(
  tx: TestTransaction,
  workspace: TestWorkspace,
  installationId: string,
  login: string,
) {
  return bindGithubInstallation(tx, {
    organizationId: workspace.organizationId,
    connectedById: workspace.userId,
    account: account({ installationId, accountLogin: login }),
  });
}

describe('bindGithubInstallation', () => {
  it('binds the installation to the workspace that started the flow', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const row = await bind(tx, workspace, PRIMARY, 'mbhatt');

      expect(row.organizationId).toBe(workspace.organizationId);
      expect(row.installationId).toBe(PRIMARY);
      expect(row.accountLogin).toBe('mbhatt');
      expect(row.status).toBe('active');
    });
  });

  it('refuses to let a second workspace claim an installation the first holds', async () => {
    await withRollback(async (tx) => {
      const first = await seedWorkspace(tx, 'First');
      const second = await seedWorkspace(tx, 'Second');
      await bind(tx, first, PRIMARY, 'mbhatt');

      await expect(bind(tx, second, PRIMARY, 'mbhatt')).rejects.toThrow(
        /already connected to another Tack workspace/,
      );

      const rows = await tx
        .select({ organizationId: githubInstallation.organizationId })
        .from(githubInstallation)
        .where(eq(githubInstallation.installationId, PRIMARY));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.organizationId).toBe(first.organizationId);
    });
  });

  it('leaves the second workspace with no github integration row after a refused claim', async () => {
    await withRollback(async (tx) => {
      const first = await seedWorkspace(tx, 'First');
      const second = await seedWorkspace(tx, 'Second');
      await bind(tx, first, PRIMARY, 'mbhatt');

      await expect(bind(tx, second, PRIMARY, 'mbhatt')).rejects.toThrow();

      const rows = await tx
        .select({ id: integration.id })
        .from(integration)
        .where(
          and(
            eq(integration.organizationId, second.organizationId),
            eq(integration.provider, 'github'),
          ),
        );
      expect(rows).toHaveLength(0);
    });
  });

  it('lets one workspace span several installations across several github accounts', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      await bind(tx, workspace, PRIMARY, 'mbhatt');
      await bind(tx, workspace, SECONDARY, 'testuser');

      const rows = await listGithubInstallations(tx, workspace.organizationId);
      expect(rows.map((row) => row.accountLogin).sort()).toEqual(['mbhatt', 'testuser']);
      expect(rows.map((row) => row.installationId).sort()).toEqual([SECONDARY, PRIMARY].sort());
    });
  });

  it('updates in place when the same installation reconnects', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const first = await bind(tx, workspace, PRIMARY, 'mbhatt');
      const second = await bindGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        connectedById: workspace.userId,
        account: account({
          installationId: PRIMARY,
          accountLogin: 'mbhatt-Renamed',
          repositorySelection: 'selected',
        }),
      });

      expect(second.id).toBe(first.id);
      expect(second.accountLogin).toBe('mbhatt-Renamed');
      expect(second.repositorySelection).toBe('selected');
      expect(await listGithubInstallations(tx, workspace.organizationId)).toHaveLength(1);
    });
  });

  it('records a suspended installation as suspended', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const row = await bindGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        connectedById: workspace.userId,
        account: account({ installationId: PRIMARY, suspended: true }),
      });
      expect(row.status).toBe('suspended');
    });
  });

  it('refuses a member who cannot manage integrations', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      await tx
        .update(member)
        .set({ role: 'member' })
        .where(
          and(
            eq(member.organizationId, workspace.organizationId),
            eq(member.userId, workspace.userId),
          ),
        );

      await expect(bind(tx, workspace, PRIMARY, 'mbhatt')).rejects.toThrow(
        /cannot integration manage/,
      );

      expect(await listGithubInstallations(tx, workspace.organizationId)).toHaveLength(0);
      const integrations = await tx
        .select({ id: integration.id })
        .from(integration)
        .where(
          and(
            eq(integration.organizationId, workspace.organizationId),
            eq(integration.provider, 'github'),
          ),
        );
      expect(integrations).toHaveLength(0);
    });
  });

  it('refuses a user who is no longer a workspace member', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      await tx
        .delete(member)
        .where(
          and(
            eq(member.organizationId, workspace.organizationId),
            eq(member.userId, workspace.userId),
          ),
        );

      await expect(bind(tx, workspace, PRIMARY, 'mbhatt')).rejects.toThrow(
        /cannot integration manage/,
      );

      expect(await listGithubInstallations(tx, workspace.organizationId)).toHaveLength(0);
      const integrations = await tx
        .select({ id: integration.id })
        .from(integration)
        .where(
          and(
            eq(integration.organizationId, workspace.organizationId),
            eq(integration.provider, 'github'),
          ),
        );
      expect(integrations).toHaveLength(0);
    });
  });

  it('identifies a workspace awaiting deletion as unavailable', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      await tx
        .update(organization)
        .set({ deletionRequestedAt: new Date() })
        .where(eq(organization.id, workspace.organizationId));

      await expect(bind(tx, workspace, PRIMARY, 'mbhatt')).rejects.toMatchObject({
        code: 'conflict',
        details: { reason: 'workspace_unavailable' },
      });

      expect(await listGithubInstallations(tx, workspace.organizationId)).toHaveLength(0);
    });
  });

  it('holds the membership lock until the installation bind commits', async () => {
    const workspace = await db.transaction(async (tx) => await seedWorkspace(tx, 'Concurrent'));
    let markBindingReady: (() => void) | undefined;
    let releaseBinding: (() => void) | undefined;
    const bindingReady = new Promise<void>((resolve) => {
      markBindingReady = resolve;
    });
    const bindingRelease = new Promise<void>((resolve) => {
      releaseBinding = resolve;
    });
    const binding = db.transaction(async (tx) => {
      const row = await bind(tx, workspace, PRIMARY, 'mbhatt');
      markBindingReady?.();
      await bindingRelease;
      return row;
    });

    try {
      await Promise.race([bindingReady, binding.then(() => undefined)]);
      const demotion = db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '250ms'`);
        await tx
          .update(member)
          .set({ role: 'member' })
          .where(
            and(
              eq(member.organizationId, workspace.organizationId),
              eq(member.userId, workspace.userId),
            ),
          );
      });

      await expect(demotion).rejects.toHaveProperty('cause.code', '55P03');
    } finally {
      releaseBinding?.();
      await binding.catch(() => undefined);
      await db.delete(organization).where(eq(organization.id, workspace.organizationId));
      await db.delete(user).where(eq(user.id, workspace.userId));
    }
  });
});

describe('removeGithubInstallation', () => {
  it('refuses to remove an installation belonging to another workspace', async () => {
    await withRollback(async (tx) => {
      const first = await seedWorkspace(tx, 'First');
      const second = await seedWorkspace(tx, 'Second');
      await bind(tx, first, PRIMARY, 'mbhatt');

      const removed = await removeGithubInstallation(tx, {
        organizationId: second.organizationId,
        installationId: PRIMARY,
      });

      expect(removed).toBe(false);
      expect(await listGithubInstallations(tx, first.organizationId)).toHaveLength(1);
    });
  });

  it('removes the installation, its repositories and its integration row', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const installation = await bind(tx, workspace, PRIMARY, 'mbhatt');
      await replaceGithubRepositories(tx, {
        installation,
        repositories: [repository({ repositoryId: '884762793' })],
      });

      const removed = await removeGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        installationId: PRIMARY,
      });

      expect(removed).toBe(true);
      expect(await listGithubInstallations(tx, workspace.organizationId)).toHaveLength(0);
      const repositories = await tx
        .select({ id: githubRepository.id })
        .from(githubRepository)
        .where(eq(githubRepository.organizationId, workspace.organizationId));
      expect(repositories).toHaveLength(0);
      const integrations = await tx
        .select({ id: integration.id })
        .from(integration)
        .where(
          and(
            eq(integration.organizationId, workspace.organizationId),
            eq(integration.provider, 'github'),
          ),
        );
      expect(integrations).toHaveLength(0);
    });
  });

  it('lets the same installation reconnect cleanly after a disconnect', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const first = await bind(tx, workspace, PRIMARY, 'mbhatt');
      await removeGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        installationId: PRIMARY,
      });

      const again = await bind(tx, workspace, PRIMARY, 'mbhatt');
      await replaceGithubRepositories(tx, {
        installation: again,
        repositories: [repository({ repositoryId: '884762793' })],
      });

      expect(again.id).not.toBe(first.id);
      expect(await listGithubInstallations(tx, workspace.organizationId)).toHaveLength(1);
      const repositories = await tx
        .select({ id: githubRepository.id })
        .from(githubRepository)
        .where(eq(githubRepository.installationRowId, again.id));
      expect(repositories).toHaveLength(1);
    });
  });

  it('frees the installation for another workspace once it is disconnected', async () => {
    await withRollback(async (tx) => {
      const first = await seedWorkspace(tx, 'First');
      const second = await seedWorkspace(tx, 'Second');
      await bind(tx, first, PRIMARY, 'mbhatt');
      await removeGithubInstallation(tx, {
        organizationId: first.organizationId,
        installationId: PRIMARY,
      });

      const row = await bind(tx, second, PRIMARY, 'mbhatt');
      expect(row.organizationId).toBe(second.organizationId);
    });
  });
});

describe('replaceGithubRepositories', () => {
  it('adds, updates and drops so the cache matches what GitHub reports', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const installation = await bind(tx, workspace, PRIMARY, 'mbhatt');
      await replaceGithubRepositories(tx, {
        installation,
        repositories: [
          repository({ repositoryId: '1', repositoryName: 'mbhatt/ai-gateway' }),
          repository({ repositoryId: '2', repositoryName: 'mbhatt/magic', private: true }),
        ],
      });

      await replaceGithubRepositories(tx, {
        installation,
        repositories: [
          repository({ repositoryId: '2', repositoryName: 'mbhatt/magic-renamed', private: true }),
          repository({ repositoryId: '3', repositoryName: 'Thefirstmannnn/tack' }),
        ],
      });

      const rows = await tx
        .select()
        .from(githubRepository)
        .where(eq(githubRepository.installationRowId, installation.id));
      expect(rows.map((row) => row.repositoryId).sort()).toEqual(['2', '3']);
      expect(rows.find((row) => row.repositoryId === '2')?.fullName).toBe('mbhatt/magic-renamed');
      expect(rows.find((row) => row.repositoryId === '2')?.private).toBe(true);
    });
  });

  it('stamps the freshness marker so the cache is not refetched on every page view', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const installation = await bind(tx, workspace, PRIMARY, 'mbhatt');
      const now = new Date('2026-08-07T10:00:00.000Z');
      await replaceGithubRepositories(tx, {
        installation,
        repositories: [repository({ repositoryId: '1' })],
        now,
      });

      const refreshed = await findGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        installationId: PRIMARY,
      });
      expect(refreshed?.repositoriesSyncedAt?.toISOString()).toBe(now.toISOString());
    });
  });

  it('keeps two installations of the same workspace independent', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      const org = await bind(tx, workspace, PRIMARY, 'mbhatt');
      const personal = await bind(tx, workspace, SECONDARY, 'testuser');
      await replaceGithubRepositories(tx, {
        installation: org,
        repositories: [repository({ repositoryId: '1', repositoryName: 'mbhatt/ai-gateway' })],
      });
      await replaceGithubRepositories(tx, {
        installation: personal,
        repositories: [repository({ repositoryId: '9', repositoryName: 'testuser/dash' })],
      });

      const orgRows = await tx
        .select({ repositoryId: githubRepository.repositoryId })
        .from(githubRepository)
        .where(eq(githubRepository.installationRowId, org.id));
      expect(orgRows.map((row) => row.repositoryId)).toEqual(['1']);
    });
  });
});

describe('setGithubInstallationStatus', () => {
  it('suspends and unsuspends without disturbing the binding', async () => {
    await withRollback(async (tx) => {
      const workspace = await seedWorkspace(tx, 'mbhatt');
      await bind(tx, workspace, PRIMARY, 'mbhatt');

      await setGithubInstallationStatus(tx, { installationId: PRIMARY, status: 'suspended' });
      const suspended = await findGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        installationId: PRIMARY,
      });
      expect(suspended?.status).toBe('suspended');

      await setGithubInstallationStatus(tx, { installationId: PRIMARY, status: 'active' });
      const active = await findGithubInstallation(tx, {
        organizationId: workspace.organizationId,
        installationId: PRIMARY,
      });
      expect(active?.status).toBe('active');
      expect(active?.organizationId).toBe(workspace.organizationId);
    });
  });
});

describe('findGithubInstallation', () => {
  it('does not return another workspace installation', async () => {
    await withRollback(async (tx) => {
      const first = await seedWorkspace(tx, 'First');
      const second = await seedWorkspace(tx, 'Second');
      await bind(tx, first, PRIMARY, 'mbhatt');

      const found = await findGithubInstallation(tx, {
        organizationId: second.organizationId,
        installationId: PRIMARY,
      });
      expect(found).toBeNull();
    });
  });
});
