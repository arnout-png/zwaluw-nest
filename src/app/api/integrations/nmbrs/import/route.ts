import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getCompanies, getEmployeesFromNmbrs, type NmbrsCredentials } from '@/lib/nmbrs';

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

  // Allow optional companyId override from request body
  let companyId: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.companyId) companyId = Number(body.companyId);
  } catch { /* ignore */ }

  try {
    // Get company list and pick the first (or specified) company
    const companies = await getCompanies(creds);
    if (companies.length === 0) {
      return NextResponse.json({ error: 'Geen bedrijven gevonden in Nmbrs.' }, { status: 404 });
    }
    const company = companyId
      ? companies.find((c) => c.id === companyId) ?? companies[0]
      : companies[0];

    // Fetch all employees from Nmbrs
    const nmbrsEmployees = await getEmployeesFromNmbrs(company.id, creds);

    // Get existing user emails to skip duplicates
    const { data: existingUsers } = await supabaseAdmin
      .from('User')
      .select('email');
    const existingEmails = new Set((existingUsers ?? []).map((u: { email: string }) => u.email.toLowerCase()));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const emp of nmbrsEmployees) {
      const email = emp.email?.toLowerCase().trim();
      if (!email) {
        skipped++;
        continue;
      }
      if (existingEmails.has(email)) {
        skipped++;
        continue;
      }

      try {
        const fullName = [emp.firstName, emp.prefixLastName, emp.lastName]
          .filter(Boolean)
          .join(' ');

        // Create User record
        const { data: user, error: userError } = await supabaseAdmin
          .from('User')
          .insert({
            email,
            name: fullName,
            passwordHash: '', // No password — admin must set later
            role: 'ADVISEUR', // Default role; admin can update
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (userError || !user) {
          errors.push(`${fullName} (${email}): ${userError?.message ?? 'Onbekende fout'}`);
          continue;
        }

        // Create EmployeeProfile
        const { error: profileError } = await supabaseAdmin
          .from('EmployeeProfile')
          .insert({
            userId: user.id,
            nmbrsEmployeeId: String(emp.employeeId),
            nmbrsCompanyId: company.id,
            nmbrsLastSync: new Date().toISOString(),
            startDate: emp.hireDate ? new Date(emp.hireDate).toISOString() : null,
            leaveBalanceDays: 25,
            leaveUsedDays: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

        if (profileError) {
          errors.push(`Profiel fout voor ${fullName}: ${profileError.message}`);
        } else {
          imported++;
          existingEmails.add(email);
        }
      } catch (err) {
        errors.push(`${emp.firstName} ${emp.lastName}: ${err instanceof Error ? err.message : 'Fout'}`);
      }
    }

    return NextResponse.json({
      ok: true,
      company: company.name,
      total: nmbrsEmployees.length,
      imported,
      skipped,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout';
    console.error('Nmbrs import error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
