/**
 * Eén bron voor welke rol standaard welke pagina in het menu ziet.
 * Gebruikt door de sidebar, het rechtenscherm (Gebruikers) en de paginacontroles,
 * zodat "extra menu-items" per gebruiker ook echt toegang geven.
 */
import type { UserPermissions } from '@/types';

export const ALL_ROLES = ['ADMIN', 'MANAGER', 'PLANNER', 'ADVISEUR', 'MONTEUR', 'CALLCENTER', 'BACKOFFICE', 'WAREHOUSE'];

export interface NavAccess {
  href: string;
  label: string;
  roles: string[];
  /**
   * Kan als extra menu-item aan een gebruiker met een andere rol worden gegeven.
   * Beheerpagina's (Gebruikers, Instellingen, Activiteiten) en de werving-
   * pagina's (die hun eigen rolcontroles hebben) niet: daar zou het menu-item
   * alleen naar een doorverwijzing leiden.
   */
  grantable: boolean;
}

export const NAV_ACCESS: NavAccess[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['ADMIN', 'MANAGER', 'PLANNER', 'ADVISEUR', 'CALLCENTER', 'BACKOFFICE', 'WAREHOUSE'], grantable: true },
  { href: '/dashboard/werving', label: 'Werving', roles: ['ADMIN', 'MANAGER'], grantable: false },
  { href: '/dashboard/werving/templates', label: 'Scripts & Checklists', roles: ['ADMIN', 'MANAGER'], grantable: false },
  { href: '/dashboard/werving/vacatures', label: 'Vacatures', roles: ['ADMIN', 'MANAGER'], grantable: false },
  { href: '/dashboard/agenda', label: 'Agenda', roles: ['ADMIN', 'MANAGER', 'PLANNER'], grantable: true },
  { href: '/dashboard/mijn-werk', label: 'Mijn Werk', roles: ['MONTEUR'], grantable: true },
  { href: '/dashboard/mijn-verlof', label: 'Mijn Verlof', roles: ['MONTEUR', 'ADVISEUR', 'CALLCENTER', 'BACKOFFICE', 'WAREHOUSE'], grantable: true },
  { href: '/dashboard/rapportage', label: 'Rapportage', roles: ['ADMIN', 'MANAGER', 'PLANNER'], grantable: true },
  { href: '/dashboard/profiel', label: 'Mijn profiel', roles: ALL_ROLES, grantable: false },
  { href: '/dashboard/activiteiten', label: 'Activiteiten', roles: ['ADMIN'], grantable: false },
  { href: '/dashboard/gebruikers', label: 'Gebruikers', roles: ['ADMIN'], grantable: false },
  { href: '/dashboard/instellingen', label: 'Instellingen', roles: ['ADMIN', 'MANAGER'], grantable: false },
  { href: '/dashboard/handleiding', label: 'Handleiding', roles: ALL_ROLES, grantable: false },
];

export function navRoles(href: string): string[] {
  return NAV_ACCESS.find((n) => n.href === href)?.roles ?? [];
}

/** Rol-standaard óf (voor toekenbare pagina's) een extra menu-item voor deze gebruiker. */
export function hasPageAccess(role: string, permissions: UserPermissions | null | undefined, href: string): boolean {
  const item = NAV_ACCESS.find((n) => n.href === href);
  if (!item) return false;
  if (item.roles.includes(role)) return true;
  return item.grantable && !!permissions?.extraNav?.includes(href);
}
