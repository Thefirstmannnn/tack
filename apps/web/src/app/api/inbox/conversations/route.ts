import { listInboxConversations } from '@tack/core';
import { handle, searchParamsOf } from '@/lib/api/handler.ts';

export async function GET(request: Request): Promise<Response> {
  return await handle((principal) => listInboxConversations(principal, searchParamsOf(request)));
}
