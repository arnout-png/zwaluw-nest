import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getIp } from '@/lib/audit';
import { isIsoDate } from '@/lib/dates';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('EmployeeProfile')
    .select(
      `id, userId, dateOfBirth, address, city, postalCode, phonePersonal,
       emergencyName, emergencyPhone, startDate, department,
       leaveBalanceDays, leaveUsedDays, createdAt, updatedAt`
    )
    .eq('userId', session.userId)
    .maybeSingle();

  if (error) {
    console.error('GET /api/profile error:', error.message);
    return NextResponse.json({ error: 'Kan profiel niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

const PROFILE_KEYS = [
  'address', 'city', 'postalCode', 'phonePersonal',
  'emergencyName', 'emergencyPhone', 'dateOfBirth',
] as const;

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // Fields employees can update themselves
  const allowedProfileFields: Record<string, string | null> = {};
  for (const key of PROFILE_KEYS) {
    if (key in body && body[key] !== undefined) {
      const raw = body[key];
      if (raw !== null && typeof raw !== 'string') {
        return NextResponse.json({ error: `Ongeldige waarde voor ${key}.` }, { status: 400 });
      }
      const value = (raw ?? '').trim().slice(0, 200);
      allowedProfileFields[key] = value || null;
    }
  }
  if (allowedProfileFields.dateOfBirth) {
    const dob = allowedProfileFields.dateOfBirth.slice(0, 10);
    if (!isIsoDate(dob)) {
      return NextResponse.json({ error: 'Ongeldige geboortedatum.' }, { status: 400 });
    }
    allowedProfileFields.dateOfBirth = dob;
  }

  const wantsPasswordChange = !!(body.currentPassword || body.newPassword);
  const newName = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';

  if (Object.keys(allowedProfileFields).length === 0 && !newName && !wantsPasswordChange) {
    return NextResponse.json({ error: 'Geen velden om bij te werken.' }, { status: 400 });
  }

  const changedFields: string[] = [];

  // Update EmployeeProfile fields (profiel aanmaken als het nog niet bestaat;
  // anders "lukte" opslaan zonder dat er iets werd bewaard)
  if (Object.keys(allowedProfileFields).length > 0) {
    const { data: existing } = await supabaseAdmin
      .from('EmployeeProfile')
      .select('id, address, city, postalCode, phonePersonal, emergencyName, emergencyPhone, dateOfBirth')
      .eq('userId', session.userId)
      .maybeSingle();

    for (const [key, value] of Object.entries(allowedProfileFields)) {
      const before = (existing as Record<string, unknown> | null)?.[key] ?? null;
      const beforeNorm = key === 'dateOfBirth' && typeof before === 'string' ? before.slice(0, 10) : before;
      if (beforeNorm !== value) changedFields.push(key);
    }

    const { error: profileError } = existing
      ? await supabaseAdmin
          .from('EmployeeProfile')
          .update({ ...allowedProfileFields, updatedAt: new Date().toISOString() })
          .eq('userId', session.userId)
      : await supabaseAdmin
          .from('EmployeeProfile')
          .insert({ userId: session.userId, ...allowedProfileFields });

    if (profileError) {
      console.error('PATCH /api/profile profile error:', profileError.message);
      return NextResponse.json({ error: 'Kan profiel niet bijwerken.' }, { status: 500 });
    }
  }

  // Update display name on User table
  if (newName && newName !== session.name) {
    const { error: nameError } = await supabaseAdmin
      .from('User')
      .update({ name: newName, updatedAt: new Date().toISOString() })
      .eq('id', session.userId);

    if (nameError) {
      console.error('PATCH /api/profile name error:', nameError.message);
      return NextResponse.json({ error: 'Kan naam niet bijwerken.' }, { status: 500 });
    }
    changedFields.push('name');
  }

  // Password change
  if (wantsPasswordChange) {
    if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
      return NextResponse.json({ error: 'Huidig en nieuw wachtwoord zijn verplicht.' }, { status: 400 });
    }

    // Verify current password
    const { data: userRow } = await supabaseAdmin
      .from('User')
      .select('passwordHash')
      .eq('id', session.userId)
      .single();

    if (!userRow?.passwordHash) {
      return NextResponse.json({ error: 'Kan wachtwoord niet verifiëren.' }, { status: 400 });
    }

    const valid = await bcrypt.compare(body.currentPassword, userRow.passwordHash as string);
    if (!valid) {
      await logAudit({ userId: session.userId, action: 'PASSWORD_CHANGE_FAILED', entity: 'User', entityId: session.userId, ipAddress: getIp(request) });
      return NextResponse.json({ error: 'Huidig wachtwoord is onjuist.' }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens zijn.' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(body.newPassword, 12);
    const { error: pwError } = await supabaseAdmin
      .from('User')
      .update({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .eq('id', session.userId);

    if (pwError) {
      console.error('PATCH /api/profile password error:', pwError.message);
      return NextResponse.json({ error: 'Kan wachtwoord niet bijwerken.' }, { status: 500 });
    }
    await logAudit({ userId: session.userId, action: 'PASSWORD_CHANGE', entity: 'User', entityId: session.userId, ipAddress: getIp(request) });
  }

  // AVG: wie wijzigde welke persoonsgegevens (alleen veldnamen, geen waarden)
  if (changedFields.length > 0) {
    await logAudit({
      userId: session.userId,
      action: 'UPDATE',
      entity: 'EmployeeProfile',
      entityId: session.userId,
      details: { fields: changedFields },
      ipAddress: getIp(request),
    });
  }

  return NextResponse.json({ success: true });
}
