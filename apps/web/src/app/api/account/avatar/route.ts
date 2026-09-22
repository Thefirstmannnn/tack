import { avatarStorageKey, clearAvatar, isAvatarUrl, saveAvatar } from '@tack/core';
import { db, eq, schema } from '@tack/db';
import { storageDriver } from '@tack/services/storage';
import { unauthorized, validationFailed } from '@tack/shared/errors';
import { handleRoute, publish } from '@/lib/api/handler.ts';
import { republishMemberships } from '@/lib/api/profile-sync.ts';
import { getSession } from '@/lib/auth/session.ts';

async function currentImage(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ image: schema.user.image })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  return row?.image ?? null;
}

export async function POST(): Promise<Response> {
  return await handleRoute(async () => {
    const session = await getSession();
    if (session === null) throw unauthorized();
    const userId = session.user.id;

    const key = avatarStorageKey(userId);
    const stored = await storageDriver().stat(key);
    if (stored === null) throw validationFailed('That photo never reached storage.');

    const user = await saveAvatar(userId);
    await publish(await republishMemberships(user));

    return { user: { image: user.image } };
  });
}

export async function DELETE(): Promise<Response> {
  return await handleRoute(async () => {
    const session = await getSession();
    if (session === null) throw unauthorized();
    const userId = session.user.id;

    const hadAvatar = isAvatarUrl(await currentImage(userId));
    const user = await clearAvatar(userId);
    if (hadAvatar) await storageDriver().delete(avatarStorageKey(userId));
    await publish(await republishMemberships(user));

    return { user: { image: user.image } };
  });
}
