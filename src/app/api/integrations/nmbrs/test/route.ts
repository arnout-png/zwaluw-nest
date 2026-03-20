import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCompanies, type NmbrsCredentials } from '@/lib/nmbrs';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const username = process.env.NMBRS_USERNAME;
  const token = process.env.NMBRS_TOKEN;
  const domain = process.env.NMBRS_DOMAIN;
  const sandbox = process.env.NMBRS_SANDBOX === 'true';

  if (!username || !token || !domain) {
    return NextResponse.json(
      { ok: false, error: 'NMBRS_USERNAME, NMBRS_TOKEN en NMBRS_DOMAIN zijn niet ingesteld.' },
      { status: 400 }
    );
  }

  const creds: NmbrsCredentials = { username, token, domain, sandbox };

  try {
    const companies = await getCompanies(creds);
    return NextResponse.json({
      ok: true,
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
