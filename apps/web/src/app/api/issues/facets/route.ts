import { getIssueFacets } from '@tack/core';
import { issueFilterSchema } from '@tack/shared/validators';
import { handle, searchParamsOf } from '@/lib/api/handler.ts';

export async function GET(request: Request): Promise<Response> {
  return await handle(async (principal) => {
    const filter = issueFilterSchema.parse(searchParamsOf(request));
    return await getIssueFacets(principal, filter);
  });
}
