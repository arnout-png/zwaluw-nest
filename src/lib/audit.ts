import { supabaseAdmin } from './supabase';

/**
 * Log an action to the AuditLog table (AVG: wie wijzigde welke persoonsgegevens).
 * Errors are logged but never thrown, zodat een mislukte audit-regel de
 * eigenlijke actie niet blokkeert.
 */
export async function logAudit(opts: {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('AuditLog').insert({
      userId: opts.userId ?? null,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId ?? null,
      details: opts.details ? JSON.stringify(opts.details) : null,
      ipAddress: opts.ipAddress ?? null,
    });
    if (error) console.error('[Audit] Failed to log:', opts.action, opts.entity, error.message);
  } catch (err) {
    console.error('[Audit] Failed to log:', opts.action, opts.entity, err);
  }
}

/** Extract IP address from request headers */
export function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Geeft alleen de velden terug die echt veranderd zijn, voor in de audit-details.
 * Gevoelige waarden (wachtwoord-hashes, BSN, tokens) worden gemaskeerd.
 */
const MASKED_FIELDS = new Set(['passwordHash', 'bsn', 'googleRefreshToken']);

export function auditDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, to] of Object.entries(after)) {
    if (key === 'updatedAt') continue;
    const from = before?.[key];
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;
    diff[key] = MASKED_FIELDS.has(key) ? { from: '***', to: '***' } : { from: from ?? null, to: to ?? null };
  }
  return diff;
}
