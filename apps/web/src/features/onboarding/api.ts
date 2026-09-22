import type { OnboardingAdvanceInput } from '@tack/shared/validators';
import { apiRequest } from '@/lib/api/client.ts';
import type { OnboardingStatusView } from './types.ts';

export async function advanceStep(input: OnboardingAdvanceInput): Promise<OnboardingStatusView> {
  const { onboarding } = await apiRequest<{ onboarding: OnboardingStatusView }>('/api/onboarding', {
    method: 'PATCH',
    body: input,
  });
  return onboarding;
}
