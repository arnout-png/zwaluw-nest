import twilio from 'twilio';

// Lazy Twilio client initialization
let _twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  if (!_twilioClient) {
    _twilioClient = twilio(sid, token);
  }
  return _twilioClient;
}

// Normalize Dutch phone numbers to E.164 format
function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-().]/g, '');
  if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2);
  else if (normalized.startsWith('0')) normalized = '+31' + normalized.slice(1);
  else if (!normalized.startsWith('+')) normalized = '+31' + normalized;
  return normalized;
}

export async function sendAppointmentSMS(opts: {
  to: string;
  candidateName: string;
  date: string;   // "maandag 7 april"
  time: string;   // "14:00"
  location: string;
}): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !from) {
    console.warn('[SMS] Twilio niet geconfigureerd — SMS overgeslagen voor', opts.to);
    return;
  }

  const firstName = opts.candidateName.split(' ')[0];
  const body =
    `Hoi ${firstName}! Je sollicitatiegesprek bij Zwaluw Comfortsanitair is bevestigd ` +
    `op ${opts.date} om ${opts.time} uur op ${opts.location}. Tot dan! — Team Zwaluw`;

  const to = normalizePhone(opts.to);

  await getTwilio().messages.create({ from, to, body });
}
