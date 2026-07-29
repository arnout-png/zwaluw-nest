import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllAutomationConfigs, upsertAutomationConfig } from '@/lib/email-automations';

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

  if (!key) return NextResponse.json({ error: 'key vereist.' }, { status: 400 });

  await upsertAutomationConfig(key, patch);
  return NextResponse.json({ success: true });
}
