import { beforeEach, describe, expect, it } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import {
  createWorkspace,
  resetDatabase,
  stateNamed,
  type Workspace,
} from '@tack/core/test-support';
import { and, db, eq, schema } from '@tack/db';
import { linkGithubRepository, listGithubCatalogue, listGithubInstallations } from '@tack/services';
import { randomUUIDv7 } from '@tack/shared/utils';
import {
  backfillWorkspacePullRequests,
  completeGithubInstall,
  refreshWorkspaceRepositories,
  repositoriesAreStale,
} from '../../../src/features/settings/github-connect.ts';
import type { GithubAppConfig } from '../../../src/lib/env.ts';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const CONFIG: GithubAppConfig = {
  slug: 'tack-mbhatt-ai',
  appId: '4514311',
  privateKey,
  clientId: 'Iv1.test',
  clientSecret: 'test-secret',
};

const PRIMARY = '151887625';
const SECONDARY = '151889033';

interface GithubStub {
  readonly installations: Record<string, unknown>;
  readonly repositories: Record<string, unknown[]>;
  readonly pullRequests?: Record<string, unknown[]>;
  readonly userInstallations?: number[];
  readonly userTokenError?: string;
}

function githubFetch(stub: GithubStub): typeof globalThis.fetch {
  return ((input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/login/oauth/access_token')) {
      const body =
        stub.userTokenError === undefined
          ? { access_token: 'ghu_token' }
          : { error: stub.userTokenError };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }
    if (url.includes('/user/installations')) {
      const ids = stub.userInstallations ?? [];
      return Promise.resolve(
        new Response(
          JSON.stringify({ total_count: ids.length, installations: ids.map((id) => ({ id })) }),
          { status: 200 },
        ),
      );
    }
    if (url.includes('/access_tokens')) {
      expect(init?.method).toBe('POST');
      return Promise.resolve(new Response(JSON.stringify({ token: 'ghs_x' }), { status: 201 }));
    }
    if (url.includes('/installation/repositories')) {
      const match = /\/app\/installations\/(\d+)/.exec(url);
      const id = match?.[1] ?? currentInstallation;
      const repositories = stub.repositories[id] ?? [];
      return Promise.resolve(
        new Response(JSON.stringify({ total_count: repositories.length, repositories }), {
          status: 200,
        }),
      );
    }
    const pullsMatch = /\/repos\/(.+)\/pulls$/.exec(new URL(url).pathname);
    if (pullsMatch !== null) {
      const repository = decodeURIComponent(pullsMatch[1] ?? '');
      const pullRequests = stub.pullRequests?.[repository] ?? [];
      return Promise.resolve(new Response(JSON.stringify(pullRequests), { status: 200 }));
    }
    const installationMatch = /\/app\/installations\/(\d+)$/.exec(url);
    if (installationMatch !== null) {
      const found = stub.installations[installationMatch[1] ?? ''];
      if (found === undefined) {
        return Promise.resolve(new Response('{}', { status: 404 }));
      }
      return Promise.resolve(new Response(JSON.stringify(found), { status: 200 }));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  }) as unknown as typeof globalThis.fetch;
}

let currentInstallation = PRIMARY;

function installationPayload(id: string, login: string, selection: 'all' | 'selected' = 'all') {
  return {
    id: Number(id),
    account: { login, id: 192082188, type: login === 'testuser' ? 'User' : 'Organization' },
    target_type: login === 'testuser' ? 'User' : 'Organization',
    repository_selection: selection,
    suspended_at: null,
  };
}

function repositoryPayload(id: number, fullName: string, isPrivate = false) {
  return {
    id,
    name: fullName.slice(fullName.indexOf('/') + 1),
    full_name: fullName,
    private: isPrivate,
    archived: false,
    default_branch: 'main',
    html_url: `https://github.com/${fullName}`,
    owner: { login: fullName.slice(0, fullName.indexOf('/')) },
  };
}

const PRIMARY_STUB: GithubStub = {
  installations: {
    [PRIMARY]: installationPayload(PRIMARY, 'mbhatt'),
    [SECONDARY]: installationPayload(SECONDARY, 'testuser', 'selected'),
  },
  repositories: {
    [PRIMARY]: [
      repositoryPayload(884762793, 'mbhatt/ai-gateway'),
      repositoryPayload(900712888, 'mbhatt/magic-experiments', true),
    ],
    [SECONDARY]: [repositoryPayload(618961824, 'testuser/example-dash', true)],
  },
  userInstallations: [Number(PRIMARY), Number(SECONDARY)],
};

let workspace: Workspace;
let other: Workspace;

beforeEach(async () => {
  await resetDatabase();
  workspace = await createWorkspace('mbhatt');
  other = await createWorkspace('Rival');
  currentInstallation = PRIMARY;
});

function install(
  target: Workspace,
  installationId: string,
  stub = PRIMARY_STUB,
  code = 'the-code',
) {
  currentInstallation = installationId;
  return completeGithubInstall({
    organizationId: target.organizationId,
    userId: target.adminUser.id,
    installationId,
    config: CONFIG,
    fetch: githubFetch(stub),
    code,
  });
}

describe('completeGithubInstall', () => {
  it('binds the installation to the workspace that started the flow and caches its repositories', async () => {
    const row = await install(workspace, PRIMARY);

    expect(row.organizationId).toBe(workspace.organizationId);
    expect(row.accountLogin).toBe('mbhatt');
    expect(row.repositorySelection).toBe('all');

    const catalogue = await listGithubCatalogue(db, workspace.organizationId);
    expect(catalogue.map((entry) => entry.fullName).sort()).toEqual([
      'mbhatt/ai-gateway',
      'mbhatt/magic-experiments',
    ]);
    expect(catalogue.find((entry) => entry.fullName === 'mbhatt/magic-experiments')?.private).toBe(
      true,
    );
  });

  it('refuses to let a second workspace claim the same installation', async () => {
    await install(workspace, PRIMARY);

    await expect(install(other, PRIMARY)).rejects.toThrow(/already connected to another/);

    expect(await listGithubInstallations(db, other.organizationId)).toHaveLength(0);
    expect(await listGithubCatalogue(db, other.organizationId)).toHaveLength(0);
  });

  it('keeps the first workspace repositories invisible to the second', async () => {
    await install(workspace, PRIMARY);
    await install(other, SECONDARY);

    const theirs = await listGithubCatalogue(db, other.organizationId);
    expect(theirs.map((entry) => entry.fullName)).toEqual(['testuser/example-dash']);
    const ours = await listGithubCatalogue(db, workspace.organizationId);
    expect(ours.every((entry) => entry.accountLogin === 'mbhatt')).toBe(true);
  });

  it('lets one workspace hold installations on two different github accounts', async () => {
    await install(workspace, PRIMARY);
    await install(workspace, SECONDARY);

    const installations = await listGithubInstallations(db, workspace.organizationId);
    expect(installations.map((row) => row.accountLogin).sort()).toEqual(['mbhatt', 'testuser']);
    const catalogue = await listGithubCatalogue(db, workspace.organizationId);
    expect(catalogue).toHaveLength(3);
    expect(new Set(catalogue.map((entry) => entry.accountLogin))).toEqual(
      new Set(['mbhatt', 'testuser']),
    );
  });

  it('refuses an installation the signing-in user cannot reach on GitHub', async () => {
    const stub: GithubStub = { ...PRIMARY_STUB, userInstallations: [Number(SECONDARY)] };

    await expect(install(workspace, PRIMARY, stub, 'the-code')).rejects.toThrow(
      /do not have access to that GitHub installation/,
    );

    expect(await listGithubInstallations(db, workspace.organizationId)).toHaveLength(0);
  });

  it('accepts an installation the signing-in user can reach', async () => {
    const row = await install(workspace, PRIMARY, PRIMARY_STUB, 'the-code');
    expect(row.installationId).toBe(PRIMARY);
  });

  it('refuses an actor demoted after GitHub access verification and before binding', async () => {
    const demotingFetch = ((input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/user/installations')) {
        return db
          .update(schema.member)
          .set({ role: 'member' })
          .where(
            and(
              eq(schema.member.organizationId, workspace.organizationId),
              eq(schema.member.userId, workspace.adminUser.id),
            ),
          )
          .then(() => githubFetch(PRIMARY_STUB)(url, init));
      }
      return githubFetch(PRIMARY_STUB)(url, init);
    }) as unknown as typeof globalThis.fetch;

    await expect(
      completeGithubInstall({
        organizationId: workspace.organizationId,
        userId: workspace.adminUser.id,
        installationId: PRIMARY,
        code: 'the-code',
        config: CONFIG,
        fetch: demotingFetch,
      }),
    ).rejects.toThrow(/cannot integration manage/);

    expect(await listGithubInstallations(db, workspace.organizationId)).toHaveLength(0);
    expect(await listGithubCatalogue(db, workspace.organizationId)).toHaveLength(0);
  });

  it('refuses a workspace marked for deletion after GitHub verification and before binding', async () => {
    const deletingFetch = ((input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/user/installations')) {
        return db
          .update(schema.organization)
          .set({ deletionRequestedAt: new Date() })
          .where(eq(schema.organization.id, workspace.organizationId))
          .then(() => githubFetch(PRIMARY_STUB)(url, init));
      }
      return githubFetch(PRIMARY_STUB)(url, init);
    }) as unknown as typeof globalThis.fetch;

    await expect(
      completeGithubInstall({
        organizationId: workspace.organizationId,
        userId: workspace.adminUser.id,
        installationId: PRIMARY,
        code: 'the-code',
        config: CONFIG,
        fetch: deletingFetch,
      }),
    ).rejects.toThrow(/deletion is in progress/);

    expect(await listGithubInstallations(db, workspace.organizationId)).toHaveLength(0);
    expect(await listGithubCatalogue(db, workspace.organizationId)).toHaveLength(0);
  });

  it('refuses a callback carrying no code, which proves nothing about the caller', async () => {
    await expect(install(workspace, PRIMARY, PRIMARY_STUB, '')).rejects.toThrow(
      /no proof that you control the installation/,
    );

    expect(await listGithubInstallations(db, workspace.organizationId)).toHaveLength(0);
    expect(await listGithubCatalogue(db, workspace.organizationId)).toHaveLength(0);
  });

  it('refuses when the app has no client credentials rather than skipping the check', async () => {
    await expect(
      completeGithubInstall({
        organizationId: workspace.organizationId,
        userId: workspace.adminUser.id,
        installationId: PRIMARY,
        code: 'the-code',
        config: { ...CONFIG, clientId: '', clientSecret: '' },
        fetch: githubFetch(PRIMARY_STUB),
      }),
    ).rejects.toThrow(/no client credentials/);

    expect(await listGithubInstallations(db, workspace.organizationId)).toHaveLength(0);
  });

  it('refuses when GitHub does not know the installation at all', async () => {
    const stub: GithubStub = { ...PRIMARY_STUB, userInstallations: [999999999] };

    await expect(install(workspace, '999999999', stub)).rejects.toThrow(/HTTP 404/);

    expect(await listGithubInstallations(db, workspace.organizationId)).toHaveLength(0);
  });

  it('refuses when the app is not configured rather than binding a blank installation', async () => {
    await expect(
      completeGithubInstall({
        organizationId: workspace.organizationId,
        userId: workspace.adminUser.id,
        installationId: PRIMARY,
        code: 'the-code',
        config: { ...CONFIG, appId: '', privateKey: '' },
        fetch: githubFetch(PRIMARY_STUB),
      }),
    ).rejects.toThrow(/not configured yet/);
  });

  it('reconnects after a disconnect with a fresh repository cache', async () => {
    await install(workspace, PRIMARY);
    await db
      .delete(schema.githubInstallation)
      .where(eq(schema.githubInstallation.organizationId, workspace.organizationId));

    const again = await install(workspace, PRIMARY);

    expect(again.organizationId).toBe(workspace.organizationId);
    expect(await listGithubCatalogue(db, workspace.organizationId)).toHaveLength(2);
  });
});

describe('repositoriesAreStale', () => {
  it('is true when the cache has never been filled', async () => {
    const row = await install(workspace, PRIMARY);
    expect(repositoriesAreStale({ ...row, repositoriesSyncedAt: null })).toBe(true);
  });

  it('is false inside the cache window so a page view does not hammer GitHub', async () => {
    const row = await install(workspace, PRIMARY);
    const synced = new Date('2026-08-07T10:00:00.000Z');
    expect(
      repositoriesAreStale(
        { ...row, repositoriesSyncedAt: synced },
        new Date('2026-08-07T10:05:00.000Z'),
      ),
    ).toBe(false);
  });

  it('is true once the cache window has passed', async () => {
    const row = await install(workspace, PRIMARY);
    const synced = new Date('2026-08-07T10:00:00.000Z');
    expect(
      repositoriesAreStale(
        { ...row, repositoriesSyncedAt: synced },
        new Date('2026-08-07T10:11:00.000Z'),
      ),
    ).toBe(true);
  });

  it('is false for a suspended installation, which cannot be read anyway', async () => {
    const row = await install(workspace, PRIMARY);
    expect(repositoriesAreStale({ ...row, status: 'suspended', repositoriesSyncedAt: null })).toBe(
      false,
    );
  });
});

describe('refreshWorkspaceRepositories', () => {
  it('does not call GitHub again while the cache is fresh', async () => {
    await install(workspace, PRIMARY);
    const installations = await listGithubInstallations(db, workspace.organizationId);
    let calls = 0;
    const counting = ((url: string, init?: RequestInit) => {
      calls += 1;
      return githubFetch(PRIMARY_STUB)(url, init);
    }) as unknown as typeof globalThis.fetch;

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: false,
      config: CONFIG,
      fetch: counting,
    });

    expect(refreshed).toBe(0);
    expect(calls).toBe(0);
  });

  it('calls GitHub when forced', async () => {
    await install(workspace, PRIMARY);
    const installations = await listGithubInstallations(db, workspace.organizationId);
    let calls = 0;
    const counting = ((url: string, init?: RequestInit) => {
      calls += 1;
      return githubFetch(PRIMARY_STUB)(url, init);
    }) as unknown as typeof globalThis.fetch;

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: counting,
    });

    expect(refreshed).toBe(1);
    expect(calls).toBeGreaterThan(0);
  });

  it('backfills open pull requests for watched repositories without sending old notifications', async () => {
    const stub: GithubStub = {
      ...PRIMARY_STUB,
      pullRequests: {
        'mbhatt/ai-gateway': [
          {
            id: 730,
            node_id: 'PR_kwDO730',
            number: 73,
            title: 'Restore the GitHub inbox ORB-3',
            body: 'Links ORB-3',
            html_url: 'https://github.com/mbhatt/ai-gateway/pull/73',
            draft: false,
            state: 'open',
            head: { ref: 'orb-3-github-inbox', sha: 'def456' },
            base: { ref: 'main' },
            user: { login: 'octocat', id: 500 },
            created_at: '2026-08-13T00:00:00.000Z',
            updated_at: '2026-08-13T01:00:00.000Z',
          },
        ],
      },
    };
    await install(workspace, PRIMARY, stub);
    const repository = (await listGithubCatalogue(db, workspace.organizationId)).find(
      (entry) => entry.fullName === 'mbhatt/ai-gateway',
    );
    if (repository === undefined) throw new Error('the installed repository is missing');
    await db.transaction(async (tx) =>
      linkGithubRepository(tx, {
        organizationId: workspace.organizationId,
        repositoryId: repository.repositoryId,
        projectId: null,
        linkedById: workspace.adminUser.id,
      }),
    );
    await db.update(schema.team).set({ key: 'ORB' }).where(eq(schema.team.id, workspace.teamId));
    const issueId = `iss_${randomUUIDv7()}`;
    await db.insert(schema.issue).values({
      id: issueId,
      organizationId: workspace.organizationId,
      teamId: workspace.teamId,
      number: 3,
      identifier: 'ORB-3',
      title: 'GitHub inbox',
      stateId: stateNamed(workspace, 'Todo').id,
      creatorId: workspace.adminUser.id,
    });
    const installations = await listGithubInstallations(db, workspace.organizationId);

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: githubFetch(stub),
    });

    const links = await db.select().from(schema.gitLink).where(eq(schema.gitLink.issueId, issueId));
    const notifications = await db
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.organizationId, workspace.organizationId));
    expect(refreshed).toBe(1);
    expect(links).toHaveLength(1);
    expect(links[0]?.url).toBe('https://github.com/mbhatt/ai-gateway/pull/73');
    expect(notifications).toHaveLength(0);
    const [sync] = await db
      .select({ backfilledAt: schema.githubRepositorySync.pullRequestsBackfilledAt })
      .from(schema.githubRepositorySync)
      .where(eq(schema.githubRepositorySync.repositoryId, repository.repositoryId));
    expect(sync?.backfilledAt).not.toBeNull();
  });

  it('backfills pending repositories without repeating completed work', async () => {
    const stub: GithubStub = {
      ...PRIMARY_STUB,
      pullRequests: {
        'mbhatt/ai-gateway': [
          {
            id: 732,
            node_id: 'PR_kwDO732',
            number: 74,
            title: 'Populate pull requests without opening settings',
            body: '',
            html_url: 'https://github.com/mbhatt/ai-gateway/pull/74',
            draft: false,
            state: 'open',
            head: { ref: 'pull-request-backfill', sha: 'fed987' },
            base: { ref: 'main' },
            user: { login: 'octocat', id: 500 },
            created_at: '2026-08-14T00:00:00.000Z',
            updated_at: '2026-08-14T01:00:00.000Z',
          },
        ],
      },
    };
    await install(workspace, PRIMARY, stub);
    const repository = (await listGithubCatalogue(db, workspace.organizationId)).find(
      (entry) => entry.fullName === 'mbhatt/ai-gateway',
    );
    if (repository === undefined) throw new Error('the installed repository is missing');
    await db.transaction(async (tx) =>
      linkGithubRepository(tx, {
        organizationId: workspace.organizationId,
        repositoryId: repository.repositoryId,
        projectId: null,
        linkedById: workspace.adminUser.id,
      }),
    );
    let pullFetches = 0;
    const countingFetch = ((input: string, init?: RequestInit) => {
      if (/\/repos\/.+\/pulls$/.test(new URL(String(input)).pathname)) pullFetches += 1;
      return githubFetch(stub)(input, init);
    }) as unknown as typeof globalThis.fetch;

    const first = await backfillWorkspacePullRequests({
      organizationId: workspace.organizationId,
      config: CONFIG,
      fetch: countingFetch,
    });
    const second = await backfillWorkspacePullRequests({
      organizationId: workspace.organizationId,
      config: CONFIG,
      fetch: countingFetch,
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(pullFetches).toBe(1);
    const pulls = await db
      .select()
      .from(schema.githubPullRequest)
      .where(eq(schema.githubPullRequest.organizationId, workspace.organizationId));
    expect(pulls.map((pull) => pull.number)).toEqual([74]);
  });

  it('keeps a successful repository refresh when pull request backfill fails', async () => {
    await install(workspace, PRIMARY);
    const repository = (await listGithubCatalogue(db, workspace.organizationId)).find(
      (entry) => entry.fullName === 'mbhatt/ai-gateway',
    );
    if (repository === undefined) throw new Error('the installed repository is missing');
    await db.transaction(async (tx) =>
      linkGithubRepository(tx, {
        organizationId: workspace.organizationId,
        repositoryId: repository.repositoryId,
        projectId: null,
        linkedById: workspace.adminUser.id,
      }),
    );
    const baseFetch = githubFetch(PRIMARY_STUB);
    const failingBackfill = ((input: string, init?: RequestInit) => {
      if (/\/repos\/.+\/pulls$/.test(new URL(String(input)).pathname)) {
        return Promise.resolve(new Response('{}', { status: 500 }));
      }
      return baseFetch(input, init);
    }) as unknown as typeof globalThis.fetch;
    const installations = await listGithubInstallations(db, workspace.organizationId);

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: failingBackfill,
    });

    expect(refreshed).toBe(1);
    const [sync] = await db
      .select({ backfilledAt: schema.githubRepositorySync.pullRequestsBackfilledAt })
      .from(schema.githubRepositorySync)
      .where(eq(schema.githubRepositorySync.repositoryId, repository.repositoryId));
    expect(sync?.backfilledAt).toBeNull();
  });

  it('backfills open pull requests that do not name an Tack issue', async () => {
    const stub: GithubStub = {
      ...PRIMARY_STUB,
      pullRequests: {
        'mbhatt/ai-gateway': [
          {
            id: 731,
            node_id: 'PR_kwDO731',
            number: 73,
            title: 'Improve repository caching',
            body: 'No Tack issue is associated with this pull request.',
            html_url: 'https://github.com/mbhatt/ai-gateway/pull/73',
            draft: false,
            state: 'open',
            head: { ref: 'improve-repository-caching', sha: 'abc123' },
            base: { ref: 'main' },
            user: { login: 'octocat', id: 500 },
            created_at: '2026-08-13T00:00:00.000Z',
            updated_at: '2026-08-13T01:00:00.000Z',
          },
        ],
      },
    };
    await install(workspace, PRIMARY, stub);
    const repository = (await listGithubCatalogue(db, workspace.organizationId)).find(
      (entry) => entry.fullName === 'mbhatt/ai-gateway',
    );
    if (repository === undefined) throw new Error('the installed repository is missing');
    await db.transaction(async (tx) =>
      linkGithubRepository(tx, {
        organizationId: workspace.organizationId,
        repositoryId: repository.repositoryId,
        projectId: null,
        linkedById: workspace.adminUser.id,
      }),
    );
    const installations = await listGithubInstallations(db, workspace.organizationId);

    await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: githubFetch(stub),
    });

    const pulls = await db
      .select()
      .from(schema.githubPullRequest)
      .where(eq(schema.githubPullRequest.organizationId, workspace.organizationId));
    expect(pulls).toHaveLength(1);
    expect(pulls[0]?.number).toBe(73);
    expect(pulls[0]?.headSha).toBe('abc123');
    expect(
      await db
        .select()
        .from(schema.gitLink)
        .where(eq(schema.gitLink.organizationId, workspace.organizationId)),
    ).toHaveLength(0);
  });

  it('leaves the cache in place when GitHub is unreachable', async () => {
    await install(workspace, PRIMARY);
    const installations = await listGithubInstallations(db, workspace.organizationId);

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: (() =>
        Promise.reject(new Error('network down'))) as unknown as typeof globalThis.fetch,
    });

    expect(refreshed).toBe(0);
    expect(await listGithubCatalogue(db, workspace.organizationId)).toHaveLength(2);
  });

  it('keeps the catalogue when the snapshot would be truncated, rather than pruning to it', async () => {
    await install(workspace, PRIMARY);
    const installations = await listGithubInstallations(db, workspace.organizationId);
    const endless = ((input: string) => {
      const url = String(input);
      if (url.includes('/access_tokens')) {
        return Promise.resolve(new Response(JSON.stringify({ token: 'ghs_x' }), { status: 201 }));
      }
      const page = Number(new URL(url).searchParams.get('page') ?? '1');
      const start = (page - 1) * 100;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            total_count: 1_000_000,
            repositories: Array.from({ length: 100 }, (_unused, index) => ({
              id: 5_000_000 + start + index,
              full_name: `mbhatt/bulk-${start + index}`,
            })),
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof globalThis.fetch;

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: endless,
    });

    expect(refreshed).toBe(0);
    const catalogue = await listGithubCatalogue(db, workspace.organizationId);
    expect(catalogue.map((entry) => entry.fullName).sort()).toEqual([
      'mbhatt/ai-gateway',
      'mbhatt/magic-experiments',
    ]);
  });

  it('skips a suspended installation', async () => {
    await install(workspace, PRIMARY);
    await db
      .update(schema.githubInstallation)
      .set({ status: 'suspended' })
      .where(eq(schema.githubInstallation.organizationId, workspace.organizationId));
    const installations = await listGithubInstallations(db, workspace.organizationId);

    const refreshed = await refreshWorkspaceRepositories({
      installations,
      force: true,
      config: CONFIG,
      fetch: (() =>
        Promise.reject(new Error('should not be called'))) as unknown as typeof globalThis.fetch,
    });

    expect(refreshed).toBe(0);
  });
});
