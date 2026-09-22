import { acceptInvite, advanceOnboarding } from '@tack/core';
import { unauthorized } from '@tack/shared/errors';
import { onboardingJoinSchema } from '@tack/shared/validators';
import { headers } from 'next/headers';
import { handleRoute, publish, readJson } from '@/lib/api/handler.ts';
import { auth } from '@/lib/auth/server.ts';
import { getSession } from '@/lib/auth/session.ts';

export async function POST(request: Request): Promise<Response> {
  return await handleRoute(async () => {
    const session = await getSession();
    if (session === null) throw unauthorized();
    const { inviteIds } = onboardingJoinSchema.parse(await readJson(request));

    let organizationId: string | null = null;
    for (const inviteId of inviteIds) {
      const accepted = await acceptInvite(inviteId, session.user.id);
      await publish(accepted.actions);
      organizationId = accepted.organizationId;
    }

    if (organizationId !== null) {
      await auth.api.setActiveOrganization({
        body: { organizationId },
        headers: await headers(),
      });
    }

    const onboarding = await advanceOnboarding(session.user.id, { step: 'invite' });
    return { onboarding, organizationId };
  });
}
