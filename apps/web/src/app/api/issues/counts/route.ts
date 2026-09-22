import { getIssueCounts } from '@tack/core';
import { issueFilterSchema } from '@tack/shared/validators';
import { handle, searchParamsOf } from '@/lib/api/handler.ts';

export async function GET(request: Request): Promise<Response> {
  return await handle(async (principal) => {
    const filter = issueFilterSchema.parse(searchParamsOf(request));
    const rows = await getIssueCounts(principal, filter);

    const byState: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byState[row.stateId] = row.total;
      total += row.total;
    }
    return { total, byState };
  });
}
