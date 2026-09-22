import type { OnboardingState, OnboardingStep } from '@tack/shared/constants';

export type OnboardingStepOrDone = OnboardingStep | 'done';

export interface OnboardingStatusView {
  readonly name: string;
  readonly handle: string;
  readonly email: string;
  readonly image: string | null;
  readonly state: OnboardingState;
  readonly hasWorkspace: boolean;
  readonly completed: boolean;
  readonly step: OnboardingStepOrDone;
}

export interface PendingInviteView {
  readonly id: string;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly role: string;
}
