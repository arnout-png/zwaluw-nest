import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  sendContractExpiryEmail,
  sendNewCandidateEmail,
  sendPoortwachterEmail,
  sendPrescreeningEmail,
  sendReviewRequestEmail,
  sendInterviewInviteEmail,
  sendAppointmentConfirmationCandidate,
  sendAppointmentNotificationInternal,
  sendRejectionEmail,
} from '@/lib/email';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Alleen admins.' }, { status: 403 });

  const to = 'arnout@veiligdouchen.nl';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zwaluw-portal.vercel.app';
  const results: { event: string; status: 'ok' | 'error'; error?: string }[] = [];

  async function run(event: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      results.push({ event, status: 'ok' });
    } catch (e) {
      results.push({ event, status: 'error', error: String(e) });
    }
  }

  await run('leave_approved', () =>
    sendLeaveApprovedEmail({
      to, name: 'Arnout van der Berg', type: 'VACATION',
      startDate: '2 juni 2025', endDate: '6 juni 2025', days: 5,
    })
  );

  await run('leave_rejected', () =>
    sendLeaveRejectedEmail({
      to, name: 'Arnout van der Berg', type: 'PERSONAL',
      startDate: '10 juni 2025', endDate: '11 juni 2025', days: 2,
    })
  );

  await run('contract_expiry_urgent', () =>
    sendContractExpiryEmail({
      to, employeeName: 'Jan de Vries', endDate: '15 april 2025', daysLeft: 10,
    })
  );

  await run('contract_expiry_normal', () =>
    sendContractExpiryEmail({
      to, employeeName: 'Sophie van den Berg', endDate: '1 juni 2025', daysLeft: 45,
    })
  );

  await run('new_candidate', () =>
    sendNewCandidateEmail({
      to, candidateName: 'Test Kandidaat', email: 'test@example.com',
      phone: '06-12345678', source: 'FACEBOOK', campaignId: 'camp_test_123',
      portalUrl: `${baseUrl}/dashboard/werving`,
    })
  );

  await run('poortwachter_week6', () =>
    sendPoortwachterEmail({
      to, employeeName: 'Pieter Bakker', week: 6,
      sickSince: '10 februari 2025',
      action: 'Probleemanalyse en plan van aanpak opstellen samen met bedrijfsarts.',
    })
  );

  await run('prescreening_invite', () =>
    sendPrescreeningEmail({
      to, name: 'Test Kandidaat',
      token: 'test-token-abc123', baseUrl,
    })
  );

  await run('review_request', () =>
    sendReviewRequestEmail({
      to, customerName: 'Familie de Boer',
      reviewUrl: 'https://g.page/r/veiligdouchen',
    })
  );

  await run('interview_invite', () =>
    sendInterviewInviteEmail({
      to, candidateName: 'Test Kandidaat', recruiterName: 'Arnout van der Berg',
    })
  );

  await run('appointment_confirmation_candidate', () =>
    sendAppointmentConfirmationCandidate({
      to, candidateName: 'Test Kandidaat',
      date: 'maandag 7 april 2025', time: '10:00', location: 'Kantoor Veilig Douchen, Hoofdstraat 1',
    })
  );

  await run('appointment_notification_internal', () =>
    sendAppointmentNotificationInternal({
      to, candidateName: 'Test Kandidaat',
      candidatePhone: '06-12345678',
      date: 'maandag 7 april 2025', time: '10:00',
    })
  );

  await run('rejection', () =>
    sendRejectionEmail({ to, candidateName: 'Test Kandidaat' })
  );

  const failed = results.filter((r) => r.status === 'error');
  return NextResponse.json({ results, sent: results.length - failed.length, failed: failed.length });
}
