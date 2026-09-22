import { findDuplicateIssues } from '@tack/core';
import { duplicateIssueQuerySchema } from '@tack/shared/validators';
import { handle, searchParamsOf } from '@/lib/api/handler.ts';

export async function GET(request: Request): Promise<Response> {
  return await handle(async (principal) => {
    const input = duplicateIssueQuerySchema.parse(searchParamsOf(request));
    const duplicates = await findDuplicateIssues(principal, input);
    return { duplicates };
  });
}
