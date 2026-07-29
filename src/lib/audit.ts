import { supabaseAdmin } from './supabase';

/**
 * Log an action to the AuditLog table.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function logAudit(opts: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await supabaseAdmin.from('AuditLog').insert({
      userId: opts.userId,
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId ?? null,
      details: opts.details ? JSON.stringify(opts.details) : null,
      ipAddress: opts.ipAddress ?? null,
    });
  } catch (err) {
    console.error('[Audit] Failed to log:', opts.action, opts.entity, err);
  }
}

/** Extract IP address from request headers */
export function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
