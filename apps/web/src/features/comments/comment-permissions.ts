import type { OrgRole } from '@tack/shared/constants';
import { permissionsFor } from '@tack/shared/policy';

export function canModerateComments(role: OrgRole): boolean {
  return permissionsFor(role).includes('comment:delete:any');
}
