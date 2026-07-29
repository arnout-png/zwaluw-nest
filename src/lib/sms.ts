// Telnyx SMS — pure fetch, no SDK dependency
// Env vars: TELNYX_API_KEY, TELNYX_PHONE_NUMBER

import { getAutomationConfig } from './email-automations';

const TELNYX_MESSAGES_URL = 'https://api.telnyx.com/v2/messages';

// Normalize Dutch phone numbers to E.164
function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-().]/g, '').replace(/^p:/, '');
  if (n.startsWith('00')) n = '+' + n.slice(2);
  else if (n.startsWith('0') && !n.startsWith('00')) n = '+31' + n.slice(1);
  else if (!n.startsWith('+')) n = '+31' + n;
  return n;
}

function isConfigured() {
  return !!(process.env.TELNYX_API_KEY && process.env.TELNYX_PHONE_NUMBER);
}

async function sendSMS(to: string, body: string): Promise<void> {
  if (!isConfigured()) {
    console.warn('[SMS] Telnyx niet geconfigureerd — SMS overgeslagen voor', to);
    return;
  }

  const normalized = normalizePhone(to);

  const res = await fetch(TELNYX_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.TELNYX_PHONE_NUMBER,
      to: normalized,
      text: body,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[SMS] Telnyx fout:', res.status, err);
  }
}

export async function sendAppointmentSMS(opts: {
  to: string;
  candidateName: string;
  date: string;
  time: string;
  location: string;
}): Promise<void> {
  const auto = await getAutomationConfig('sms_appointment_confirm');
  if (!auto.enabled) return;

  const firstName = opts.candidateName.split(' ')[0];
  const defaultBody =
    `Hoi ${firstName}! Je sollicitatiegesprek bij Zwaluw Comfortsanitair is bevestigd ` +
    `op ${opts.date} om ${opts.time} uur op ${opts.location}. Tot dan! — Team Zwaluw`;

  const body = auto.customIntro
    ? auto.customIntro
        .replace(/\{naam\}/g, firstName)
        .replace(/\{datum\}/g, opts.date)
        .replace(/\{tijd\}/g, opts.time)
        .replace(/\{locatie\}/g, opts.location)
    : defaultBody;

  await sendSMS(opts.to, body);
}

export async function sendScreeningInviteSMS(opts: {
  to: string;
  candidateName: string;
  url: string;
}): Promise<void> {
  const auto = await getAutomationConfig('sms_screening_invite');
  if (!auto.enabled) return;

  const firstName = opts.candidateName.split(' ')[0];
  const defaultBody =
    `Hoi ${firstName}, bedankt voor je interesse bij Zwaluw Comfortsanitair! ` +
    `Vul je pre-screening in (5 min): ${opts.url}`;

  const body = auto.customIntro
    ? auto.customIntro
        .replace(/\{naam\}/g, firstName)
        .replace(/\{url\}/g, opts.url)
    : defaultBody;

  await sendSMS(opts.to, body);
}
