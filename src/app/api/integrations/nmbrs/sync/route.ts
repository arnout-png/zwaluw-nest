import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getCompanies, insertEmployee, type NmbrsCredentials } from '@/lib/nmbrs';

export async function POST(request: NextRequest) {
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
      { error: 'NMBRS_USERNAME, NMBRS_TOKEN en NMBRS_DOMAIN zijn niet ingesteld.' },
      { status: 400 }
    );
  }

  const creds: NmbrsCredentials = { username, token, domain, sandbox };

  let companyId: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.companyId) companyId = Number(body.companyId);
  } catch { /* ignore */ }

  try {
    // Get company
    const companies = await getCompanies(creds);
    if (companies.length === 0) {
      return NextResponse.json({ error: 'Geen bedrijven gevonden in Nmbrs.' }, { status: 404 });
    }
    const company = companyId
      ? companies.find((c) => c.id === companyId) ?? companies[0]
      : companies[0];

    // Get all ZwaluwNest employees without a Nmbrs ID
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('EmployeeProfile')
      .select(`
        id, userId, startDate, nmbrsEmployeeId,
        user:User!EmployeeProfile_userId_fkey (id, name, email)
      `)
      .is('nmbrsEmployeeId', null);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const profile of profiles ?? []) {
      const user = (profile as unknown as { user?: { name: string; email: string } }).user;
      if (!user) { skipped++; continue; }

      const nameParts = user.name.trim().split(' ');
      const firstName = nameParts[0] ?? user.name;
      const lastName = nameParts.slice(1).join(' ') || firstName;

      try {
        const p = profile as unknown as { id: string; startDate?: string };
        const nmbrsId = await insertEmployee(
          company.id,
          {
            firstName,
            lastName,
            email: user.email,
            hireDate: p.startDate ?? new Date().toISOString(),
          },
          creds
        );

        // Store Nmbrs ID back on the profile
        await supabaseAdmin
          .from('EmployeeProfile')
          .update({
            nmbrsEmployeeId: String(nmbrsId),
            nmbrsCompanyId: company.id,
            nmbrsLastSync: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .eq('id', p.id);

        synced++;
      } catch (err) {
        errors.push(`${user.name}: ${err instanceof Error ? err.message : 'Fout'}`);
      }
    }

    return NextResponse.json({
      ok: true,
      company: company.name,
      synced,
      skipped,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout';
    console.error('Nmbrs sync error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
