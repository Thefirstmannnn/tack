import { buildSyncAction, nextSyncId } from '@tack/core';
import { db, eq, schema } from '@tack/db';
import type { SyncAction } from '@tack/shared/events';
import { scopes } from '@tack/shared/events';

interface ProfileActor {
  readonly id: string;
  readonly name: string;
}

export async function republishMemberships(user: ProfileActor): Promise<readonly SyncAction[]> {
  const syncId = await nextSyncId(db);
  const memberships = await db
    .update(schema.member)
    .set({ syncId })
    .where(eq(schema.member.userId, user.id))
    .returning();

  return memberships.map((row) =>
    buildSyncAction({
      syncId: row.syncId,
      organizationId: row.organizationId,
      scopes: [scopes.organization(row.organizationId), scopes.user(row.userId)],
      action: 'update',
      model: 'member',
      modelId: row.id,
      data: row,
      actor: { type: 'user', id: user.id, name: user.name },
    }),
  );
}
