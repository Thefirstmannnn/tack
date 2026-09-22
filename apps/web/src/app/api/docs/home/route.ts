import { docsHome } from '@tack/core';
import { handle, searchParamsOf } from '@/lib/api/handler.ts';

export async function GET(request: Request): Promise<Response> {
  return await handle(async (principal) => await docsHome(principal, searchParamsOf(request)));
}
