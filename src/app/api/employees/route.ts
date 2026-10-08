import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getIp } from '@/lib/audit';
import { isIsoDate } from '@/lib/dates';

const ROLES = ['ADMIN', 'MANAGER', 'PLANNER', 'ADVISEUR', 'MONTEUR', 'CALLCENTER', 'BACKOFFICE', 'WAREHOUSE'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Alleen beheerders kunnen medewerkers aanmaken.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, role, password, jobTitle, department, startDate } = body;
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  // Personeel en Gebruikers sturen `phonePersonal` / `leaveBalanceDays`; de route
  // las alleen `phone` / `leaveBalance`, dus telefoon en verlofsaldo gingen verloren.
  const phone = (body.phonePersonal ?? body.phone) as string | undefined;
  const leaveBalanceRaw = body.leaveBalanceDays ?? body.leaveBalance;

  if (!email || !name || !role || !password) {
    return NextResponse.json(
      { error: 'E-mail, naam, rol en wachtwoord zijn verplicht.' },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Ongeldig e-mailadres.' }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: 'Ongeldige rol.' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Het wachtwoord moet minimaal 8 tekens zijn.' }, { status: 400 });
  }
  if (startDate && !isIsoDate(startDate)) {
    return NextResponse.json({ error: 'Ongeldige startdatum.' }, { status: 400 });
  }
  const leaveBalance = leaveBalanceRaw === undefined || leaveBalanceRaw === '' ? 25 : Number(leaveBalanceRaw);
  if (!Number.isFinite(leaveBalance) || leaveBalance < 0 || leaveBalance > 100) {
    return NextResponse.json({ error: 'Ongeldig verlofsaldo.' }, { status: 400 });
  }

  // Check if email already in use
  const { data: existing } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('email', email)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Dit e-mailadres is al in gebruik.' },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: newUser, error: userError } = await supabaseAdmin
    .from('User')
    .insert({
      email,
      name: String(name).trim(),
      jobTitle: typeof jobTitle === 'string' ? jobTitle.trim() || null : null,
      role,
      passwordHash,
      isActive: true,
    })
    .select('id, email, name, jobTitle, role, isActive, createdAt, updatedAt')
    .single();

  if (userError) {
    console.error('Create user error:', userError.message);
    return NextResponse.json({ error: 'Kan medewerker niet aanmaken.' }, { status: 500 });
  }

  // Create employee profile with real column names
  const { data: profile, error: epError } = await supabaseAdmin
    .from('EmployeeProfile')
    .insert({
      userId: newUser.id,
      department: typeof department === 'string' ? department.trim() || null : null,
      startDate: startDate || null,
      phonePersonal: typeof phone === 'string' ? phone.trim() || null : null,
      leaveBalanceDays: leaveBalance,
      leaveUsedDays: 0,
    })
    .select('id')
    .single();

  if (epError) {
    console.error('Create EmployeeProfile error:', epError.message);
    // User created but profile failed — still return success, profile can be added later
  }

  await logAudit({
    userId: session.userId,
    action: 'CREATE',
    entity: 'User',
    entityId: newUser.id,
    details: { email, role, profileCreated: !epError },
    ipAddress: getIp(request),
  });

  return NextResponse.json(
    { data: { ...newUser, employeeProfileId: (profile as { id: string } | null)?.id ?? null } },
    { status: 201 }
  );
}
