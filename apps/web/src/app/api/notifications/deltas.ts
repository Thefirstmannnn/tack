import { buildSyncAction } from '@tack/core';
import type { NotificationRecord } from '@tack/services/notifications';
import type { SyncAction, SyncActionKind } from '@tack/shared/events';
import { scopes } from '@tack/shared/events';
import type { Principal } from '@tack/shared/policy';

export function notificationActions(
  principal: Principal,
  actorName: string,
  action: SyncActionKind,
  rows: readonly NotificationRecord[],
): SyncAction[] {
  return rows.map((row) =>
    buildSyncAction({
      syncId: row.syncId,
      organizationId: row.organizationId,
      scopes: [scopes.user(row.userId)],
      action,
      model: 'notification',
      modelId: row.id,
      data: {
        id: row.id,
        syncId: row.syncId,
        visible: action !== 'delete' && row.dismissedAt === null,
      },
      actor: { type: 'user', id: principal.userId, name: actorName },
    }),
  );
}
