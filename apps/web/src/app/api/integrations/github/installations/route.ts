import { db } from '@tack/db';
import { removeGithubInstallation } from '@tack/services';
import { assertCan } from '@tack/shared/policy';
import { githubRemoveInstallationSchema } from '@tack/shared/validators';
import { apiContext, handleRoute, searchParamsOf } from '@/lib/api/handler.ts';

export async function DELETE(request: Request): Promise<Response> {
  return await handleRoute(async () => {
    const { principal } = await apiContext();
    assertCan(principal, 'integration:manage');
    const { installationId } = githubRemoveInstallationSchema.parse(searchParamsOf(request));
    const removed = await db.transaction(async (tx) =>
      removeGithubInstallation(tx, {
        organizationId: principal.organizationId,
        installationId,
      }),
    );
    return { removed };
  });
}
