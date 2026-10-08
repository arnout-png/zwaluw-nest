import { supabaseAdmin } from './supabase';
import { parsePermissions, type UserPermissions } from '@/types';
import type { SessionPayload } from './auth';

/** Rollen die standaard verlof van anderen mogen beoordelen. */
export const LEAVE_MANAGER_ROLES = ['ADMIN', 'MANAGER', 'PLANNER'];

/** Leest de per-gebruiker extra rechten (User.permissions) vers uit de database. */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const { data } = await supabaseAdmin
    .from('User')
    .select('permissions')
    .eq('id', userId)
    .maybeSingle();
  return parsePermissions((data?.permissions as string | null) ?? null);
}

/**
 * Mag deze gebruiker verlofaanvragen van anderen zien en beoordelen?
 * Rol-standaard óf het vinkje "Verlof anderen goedkeuren" in Gebruikers.
 * (Dat vinkje werd tot nu toe nergens gecontroleerd.)
 */
export async function canManageLeave(session: SessionPayload): Promise<boolean> {
  if (LEAVE_MANAGER_ROLES.includes(session.role)) return true;
  return (await getUserPermissions(session.userId)).canManageLeave;
}
