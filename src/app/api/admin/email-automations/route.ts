import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { EMAIL_AUTOMATION_CATALOG, getAllAutomationConfigs, upsertAutomationConfig } from '@/lib/email-automations';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) return NextResponse.json({ error: 'Alleen admins.' }, { status: 403 });

  const configs = await getAllAutomationConfigs();
  return NextResponse.json(configs);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) return NextResponse.json({ error: 'Alleen admins.' }, { status: 403 });

  const body = await request.json();
  const { key, ...patch } = body as {
    key: string;
    enabled?: boolean;
    customSubject?: string | null;
    customIntro?: string | null;
  };

  if (!key || !EMAIL_AUTOMATION_CATALOG.some((d) => d.key === key)) {
    return NextResponse.json({ error: 'Onbekende automatisering.' }, { status: 400 });
  }

  // Alleen bekende velden doorlaten
  const clean: { enabled?: boolean; customSubject?: string | null; customIntro?: string | null } = {};
  if (typeof patch.enabled === 'boolean') clean.enabled = patch.enabled;
  if (patch.customSubject !== undefined) clean.customSubject = patch.customSubject ? String(patch.customSubject).slice(0, 200) : null;
  if (patch.customIntro !== undefined) clean.customIntro = patch.customIntro ? String(patch.customIntro).slice(0, 5000) : null;

  await upsertAutomationConfig(key, clean);
  return NextResponse.json({ success: true });
}
