import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, auditDiff, getIp } from '@/lib/audit';
import { parsePermissions } from '@/types';

const ROLES = ['ADMIN', 'MANAGER', 'PLANNER', 'ADVISEUR', 'MONTEUR', 'CALLCENTER', 'BACKOFFICE', 'WAREHOUSE'];

async function countOtherActiveAdmins(excludeId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('User')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'ADMIN')
    .eq('isActive', true)
    .neq('id', excludeId);
  return count ?? 0;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, role, isActive, phonePersonal, jobTitle, permissions } = body as {
    name?: string;
    role?: string;
    isActive?: boolean;
    phonePersonal?: string;
    jobTitle?: string;
    permissions?: string;
  };

  const { data: before } = await supabaseAdmin
    .from('User')
    .select('id, name, role, isActive, jobTitle, permissions')
    .eq('id', id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: 'Gebruiker niet gevonden.' }, { status: 404 });

  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Ongeldige rol.' }, { status: 400 });
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'Naam mag niet leeg zijn.' }, { status: 400 });
  }
  if (permissions !== undefined && permissions !== null && permissions !== '') {
    try {
      JSON.parse(permissions);
    } catch {
      return NextResponse.json({ error: 'Ongeldige rechten.' }, { status: 400 });
    }
  }

  // Niet jezelf buitensluiten, en altijd minstens één actieve beheerder houden.
  const losesAdmin =
    before.role === 'ADMIN' && before.isActive &&
    ((role !== undefined && role !== 'ADMIN') || isActive === false);
  if (losesAdmin) {
    if (id === session.userId) {
      return NextResponse.json(
        { error: 'Je kunt je eigen beheerdersrol niet intrekken of je eigen account deactiveren.' },
        { status: 400 }
      );
    }
    if ((await countOtherActiveAdmins(id)) === 0) {
      return NextResponse.json({ error: 'Er moet minstens één actieve beheerder overblijven.' }, { status: 400 });
    }
  }

  // Update User fields
  const userUpdate: Record<string, unknown> = {};
  if (name !== undefined) userUpdate.name = name.trim();
  if (role !== undefined) userUpdate.role = role;
  if (isActive !== undefined) userUpdate.isActive = !!isActive;
  if (jobTitle !== undefined) userUpdate.jobTitle = jobTitle.trim() || null;
  if (permissions !== undefined) userUpdate.permissions = permissions || null;

  if (Object.keys(userUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from('User')
      .update({ ...userUpdate, updatedAt: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('PATCH user error:', error.message);
      return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
    }
  }

  // Update EmployeeProfile.phonePersonal if provided
  let phoneChanged = false;
  if (phonePersonal !== undefined) {
    const newPhone = phonePersonal.trim() || null;
    const { data: profile } = await supabaseAdmin
      .from('EmployeeProfile')
      .select('id, phonePersonal')
      .eq('userId', id)
      .maybeSingle();

    if (profile) {
      if ((profile.phonePersonal ?? null) !== newPhone) {
        phoneChanged = true;
        const { error } = await supabaseAdmin
          .from('EmployeeProfile')
          .update({ phonePersonal: newPhone, updatedAt: new Date().toISOString() })
          .eq('userId', id);
        if (error) console.error('PATCH employeeProfile error:', error.message);
      }
    } else {
      // Create a minimal profile if none exists
      phoneChanged = !!newPhone;
      const { error } = await supabaseAdmin
        .from('EmployeeProfile')
        .insert({ userId: id, phonePersonal: newPhone });
      if (error) console.error('PATCH employeeProfile insert error:', error.message);
    }
  }

  const diff = auditDiff(before as Record<string, unknown>, userUpdate);
  if (diff.permissions) {
    // Leesbaarder dan twee JSON-strings
    diff.permissions = {
      from: parsePermissions(before.permissions as string | null),
      to: parsePermissions((userUpdate.permissions as string | null) ?? null),
    };
  }
  if (phoneChanged) diff.phonePersonal = { from: '***', to: '***' };
  if (Object.keys(diff).length > 0) {
    await logAudit({
      userId: session.userId,
      action: diff.role || diff.permissions || diff.isActive ? 'PERMISSION_CHANGE' : 'UPDATE',
      entity: 'User',
      entityId: id,
      details: diff,
      ipAddress: getIp(req),
    });
  }

  const { data: updated } = await supabaseAdmin
    .from('User')
    .select('id, email, name, role, isActive, createdAt, updatedAt')
    .eq('id', id)
    .single();

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (session.userId === id) {
    return NextResponse.json({ error: 'Je kunt je eigen account niet verwijderen.' }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from('User')
    .select('id, email, role, isActive')
    .eq('id', id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Gebruiker niet gevonden.' }, { status: 404 });

  if (target.role === 'ADMIN' && target.isActive && (await countOtherActiveAdmins(id)) === 0) {
    return NextResponse.json({ error: 'Er moet minstens één actieve beheerder overblijven.' }, { status: 400 });
  }

  // De database heeft geen foreign keys: een verwijdering "lukte" altijd en liet
  // contracten, verlof, dossier, afspraken en notities als wezen achter
  // (zo zijn 14 van de 15 contracten nu aan niemand meer gekoppeld). HR-gegevens
  // hebben een wettelijke bewaarplicht, dus weigeren we zolang er iets aan hangt.
  const { data: profile } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', id)
    .maybeSingle();

  const head = { count: 'exact' as const, head: true };
  const checks: [string, PromiseLike<{ count: number | null }>][] = [
    ['kandidaatnotities', supabaseAdmin.from('CandidateNote').select('id', head).eq('authorId', id)],
    ['belregistraties', supabaseAdmin.from('CallLog').select('id', head).eq('userId', id)],
    ['toegewezen kandidaten', supabaseAdmin.from('Candidate').select('id', head).eq('assignedToId', id).is('deletedAt', null)],
    ['screeningantwoorden', supabaseAdmin.from('ScreeningAnswer').select('id', head).eq('answeredById', id)],
    ['dossieraantekeningen (als auteur)', supabaseAdmin.from('DossierEntry').select('id', head).eq('loggedById', id)],
    ['vacatures', supabaseAdmin.from('JobOpening').select('id', head).eq('createdById', id)],
    ['scripts', supabaseAdmin.from('ScreeningScript').select('id', head).eq('createdById', id)],
    ['checklists', supabaseAdmin.from('InterviewChecklist').select('id', head).eq('createdById', id)],
    ['roltoewijzingen', supabaseAdmin.from('RoleAssignment').select('roleType', head).eq('userId', id)],
  ];
  if (profile) {
    const epId = profile.id as string;
    checks.push(
      ['contracten', supabaseAdmin.from('Contract').select('id', head).eq('employeeProfileId', epId)],
      ['verlofaanvragen', supabaseAdmin.from('LeaveRequest').select('id', head).eq('employeeProfileId', epId)],
      ['dossier', supabaseAdmin.from('DossierEntry').select('id', head).eq('employeeProfileId', epId)],
      ['ziekmeldingen', supabaseAdmin.from('SickTracker').select('id', head).eq('employeeProfileId', epId)],
      ['afspraken', supabaseAdmin.from('Appointment').select('id', head).eq('employeeProfileId', epId)],
    );
  }

  const counts = await Promise.all(checks.map(([, q]) => q));
  const blocking = checks
    .map(([label], i) => ({ label, count: counts[i].count ?? 0 }))
    .filter((c) => c.count > 0);

  if (blocking.length > 0) {
    return NextResponse.json(
      {
        error:
          `Gebruiker heeft nog gekoppelde gegevens (${blocking.map((b) => `${b.count} ${b.label}`).join(', ')}). ` +
          'Zet de gebruiker op Inactief in plaats van verwijderen.',
      },
      { status: 409 }
    );
  }

  // Eerst de gebruiker, dan pas het (lege) profiel: zo blijft er bij een fout
  // geen half verwijderde medewerker achter.
  const { error } = await supabaseAdmin.from('User').delete().eq('id', id);
  if (error) {
    console.error('DELETE user error:', error.message);
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Gebruiker heeft nog gekoppelde gegevens. Zet de gebruiker op Inactief in plaats van verwijderen.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 500 });
  }
  if (profile) {
    await supabaseAdmin.from('EmployeeProfile').delete().eq('id', profile.id);
  }
  await supabaseAdmin.from('Notification').delete().eq('userId', id);

  await logAudit({
    userId: session.userId,
    action: 'DELETE',
    entity: 'User',
    entityId: id,
    details: { email: target.email, role: target.role },
    ipAddress: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
