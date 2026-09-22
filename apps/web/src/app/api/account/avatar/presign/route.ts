import { avatarStorageKey } from '@tack/core';
import { storageDriver } from '@tack/services/storage';
import { avatarUploadSchema } from '@tack/shared/validators';
import { handle, readJson } from '@/lib/api/handler.ts';

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  return await handle(async (principal) => {
    const { contentType, size } = avatarUploadSchema.parse(body);
    const key = avatarStorageKey(principal.userId);
    const target = await storageDriver().createUploadTarget(key, contentType, size);
    return { upload: target };
  });
}
