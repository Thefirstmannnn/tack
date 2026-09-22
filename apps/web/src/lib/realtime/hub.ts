import { createRealtimeHub, type RealtimeHub } from '@tack/realtime-server';

const globalForHub = globalThis as unknown as {
  tackRealtimeHub?: Promise<RealtimeHub> | undefined;
};

export function realtimeHub(): Promise<RealtimeHub> {
  const existing = globalForHub.tackRealtimeHub;
  if (existing !== undefined) return existing;
  const created = createRealtimeHub().catch((error: unknown) => {
    if (globalForHub.tackRealtimeHub === created) globalForHub.tackRealtimeHub = undefined;
    throw error;
  });
  globalForHub.tackRealtimeHub = created;
  return created;
}

export function redisConfigured(): boolean {
  const url = process.env['REDIS_URL'];
  return url !== undefined && url.length > 0;
}
