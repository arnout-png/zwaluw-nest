import { google } from 'googleapis';
import { getAutomationConfig } from './email-automations';

/**
 * Gmail API transport via Google Workspace service account + domain-wide delegation.
 *
 * Setup (one-time, in Google Cloud Console):
 *   1. Enable "Gmail API" on your project.
 *   2. Go to Google Workspace Admin > Security > API Controls > Domain-wide Delegation.
 *   3. Add the service account client_id with scope:
 *      https://www.googleapis.com/auth/gmail.send
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_CREDENTIALS  — already used for Sheets (base64 JSON)
 *   GMAIL_SENDER                        — e.g. noreply@veiligdouchen.nl
 */
function getGmailClient() {
  const credBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS not set');
  const credentials = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf-8'));
  const sender = process.env.GMAIL_SENDER ?? 'noreply@veiligdouchen.nl';

  const auth = new google.auth.JWT({
    email:   credentials.client_email,
    key:     credentials.private_key,
    scopes:  ['https://www.googleapis.com/auth/gmail.send'],
    subject: sender,   // impersonate this Workspace address
  });

  return { gmail: google.gmail({ version: 'v1', auth }), sender };
}

const FROM_NAME = 'ZwaluwNest';

/**
 * True zodra de Gmail-transport bruikbaar is. Gebruik dit als gate rond
 * verzendlogica — NIET `process.env.RESEND_API_KEY`; Resend is vervangen door
 * de Gmail API en die variabele bestaat niet meer.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
}

async function sendViaGmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Afzendernaam; standaard "ZwaluwNest" (intern). Kandidaatmails: CANDIDATE_FROM_NAME. */
  fromName?: string;
  replyTo?: string;
}): Promise<void> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    console.warn('[Email] GOOGLE_SERVICE_ACCOUNT_CREDENTIALS niet ingesteld — e-mail overgeslagen');
    return;
  }

  const { gmail, sender } = getGmailClient();

  // RFC 2047 encode subject for non-ASCII characters (em-dash, accents, etc.)
  const encodedSubject = `=?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`;

  // Build RFC 2822 MIME message
  // Header-injectie voorkomen: geen regeleinden in adres- of naamvelden.
  const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();
  const fromName = oneLine(opts.fromName ?? FROM_NAME);
  const encodedFrom = /^[\x20-\x7e]*$/.test(fromName)
    ? fromName
    : `=?UTF-8?B?${Buffer.from(fromName).toString('base64')}?=`;

  const message = [
    `From: ${encodedFrom} <${sender}>`,
    `To: ${oneLine(opts.to)}`,
    ...(opts.replyTo ? [`Reply-To: ${oneLine(opts.replyTo)}`] : []),
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    opts.html,
  ].join('\r\n');

  const encoded = Buffer.from(message).toString('base64url');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function htmlWrapper(content: string, title: string) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#1e2028;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#252732;border-radius:12px;border:1px solid #363848;overflow:hidden;">
    <tr>
      <td style="background:#14151b;padding:20px 32px;border-bottom:1px solid #363848;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:32px;height:32px;background:rgba(104,176,166,0.1);border-radius:8px;text-align:center;vertical-align:middle;">
              <span style="font-size:18px;">🐦</span>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#fff;font-size:14px;font-weight:600;">ZwaluwNest</div>
              <div style="color:#68b0a6;font-size:10px;letter-spacing:2px;text-transform:uppercase;">HR &amp; Ops</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="background:#1e2028;padding:16px 32px;border-top:1px solid #363848;text-align:center;">
        <p style="color:#6b7280;font-size:12px;margin:0;">
          Dit is een automatisch bericht van ZwaluwNest · Veilig Douchen
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#68b0a6;color:#14151b;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>`;
}

/** HTML-escape voor waarden die van buiten komen (namen, e-mailadressen, vrije tekst). */
export function esc(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Vrije tekst (bijv. een aangepaste intro uit de automatiseringsinstellingen) veilig als HTML. */
function escMultiline(value: string): string {
  return esc(value).replace(/\n/g, '<br />');
}

/** Afzendernaam en contactgegevens in mails aan sollicitanten. */
export const CANDIDATE_FROM_NAME = 'Zwaluw Comfortsanitair';
const CANDIDATE_CONTACT_EMAIL = 'info@veiligdouchen.nl';

/**
 * Licht, merk-neutraal kader voor mails aan sollicitanten. Het donkere
 * ZwaluwNest-kader hierboven is voor interne mails; een sollicitant kent
 * "ZwaluwNest" niet en hoort de werkgever te zien: Zwaluw Comfortsanitair.
 */
function candidateWrapper(content: string, title: string) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f3f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b1c1c;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e2e1;">
    <tr>
      <td style="background:#196961;padding:20px 32px;">
        <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">Zwaluw Comfortsanitair</div>
        <div style="color:#a7f0e5;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Werken bij</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;font-size:15px;line-height:1.6;color:#3f4947;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="background:#fbf9f8;padding:16px 32px;border-top:1px solid #eae8e7;text-align:center;">
        <p style="color:#6f7977;font-size:12px;margin:0;line-height:1.5;">
          Zwaluw Comfortsanitair · Nijverheidsweg 25, 3899 AD Zeewolde ·
          <a href="mailto:${CANDIDATE_CONTACT_EMAIL}" style="color:#196961;">${CANDIDATE_CONTACT_EMAIL}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function cBtn(label: string, url: string) {
  return `<a href="${esc(url)}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#196961;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${esc(label)}</a>`;
}

function cHeading(text: string) {
  return `<h2 style="color:#1b1c1c;font-size:20px;margin:0 0 16px;">${esc(text)}</h2>`;
}

// ─── Email templates ───────────────────────────────────────────────────────────

export async function sendLeaveApprovedEmail(opts: {
  to: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
}) {
  const auto = await getAutomationConfig('leave_approved');
  if (!auto.enabled) return;

  const leaveLabels: Record<string, string> = {
    VACATION: 'Vakantie', SICK: 'Ziekteverlof', PERSONAL: 'Persoonlijk verlof',
    UNPAID: 'Onbetaald verlof', SPECIAL: 'Bijzonder verlof',
  };
  const label = leaveLabels[opts.type] ?? opts.type;

  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Verlof goedgekeurd ✓</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">Hallo ${opts.name}, je verlofaanvraag is goedgekeurd.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Type</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${label}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Van</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.startDate}</td>
      </tr>
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Tot</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.endDate}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Dagen</td>
        <td style="padding:12px 16px;color:#68b0a6;font-size:13px;font-weight:600;">${opts.days} dag${opts.days !== 1 ? 'en' : ''}</td>
      </tr>
    </table>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `Verlof goedgekeurd — ${opts.days} dag${opts.days !== 1 ? 'en' : ''} ${label.toLowerCase()}`,
    html: htmlWrapper(content, 'Verlof goedgekeurd'),
    text: `Hallo ${opts.name}, je verlofaanvraag (${label}, ${opts.startDate} – ${opts.endDate}, ${opts.days} dagen) is goedgekeurd.`,
  });
}

export async function sendLeaveRejectedEmail(opts: {
  to: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
}) {
  const auto = await getAutomationConfig('leave_rejected');
  if (!auto.enabled) return;

  const leaveLabels: Record<string, string> = {
    VACATION: 'Vakantie', SICK: 'Ziekteverlof', PERSONAL: 'Persoonlijk verlof',
    UNPAID: 'Onbetaald verlof', SPECIAL: 'Bijzonder verlof',
  };
  const label = leaveLabels[opts.type] ?? opts.type;

  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Verlofaanvraag afgewezen</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Hallo ${opts.name}, helaas is je verlofaanvraag afgewezen.
      Neem contact op met je leidinggevende voor meer informatie.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Type</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;">${label}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Periode</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;">${opts.startDate} – ${opts.endDate}</td>
      </tr>
    </table>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `Verlofaanvraag afgewezen — ${label}`,
    html: htmlWrapper(content, 'Verlof afgewezen'),
    text: `Hallo ${opts.name}, je verlofaanvraag (${label}, ${opts.startDate} – ${opts.endDate}) is afgewezen. Neem contact op met je leidinggevende.`,
  });
}

export async function sendContractExpiryEmail(opts: {
  to: string;
  employeeName: string;
  endDate: string;
  daysLeft: number;
}) {
  const auto = await getAutomationConfig('contract_expiry');
  if (!auto.enabled) return;

  const urgent = opts.daysLeft <= 14;
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">
      ${urgent ? '⚠️ Urgent: ' : ''}Contract verloopt binnenkort
    </h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Het contract van <strong style="color:#e8e9ed;">${opts.employeeName}</strong> verloopt
      over <strong style="color:${urgent ? '#f87171' : '#f7a247'};">${opts.daysLeft} dagen</strong>
      op <strong style="color:#e8e9ed;">${opts.endDate}</strong>.
    </p>
    <p style="color:#9ca3af;font-size:13px;">
      Vergeet niet tijdig actie te ondernemen: verlenging, omzetting naar vast dienstverband, of beëindiging.
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `${urgent ? '[URGENT] ' : ''}Contract ${opts.employeeName} verloopt over ${opts.daysLeft} dagen`,
    html: htmlWrapper(content, 'Contract verloopt'),
    text: `Contract van ${opts.employeeName} verloopt over ${opts.daysLeft} dagen op ${opts.endDate}.`,
  });
}

export async function sendLeadSilenceEmail(opts: {
  to: string;
  daysQuiet: number;
  lastLeadDate: string;
  openVacancies: number;
  portalUrl: string;
}) {
  const auto = await getAutomationConfig('lead_silence');
  if (!auto.enabled) return;

  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">⚠️ De leadstroom lijkt stilgevallen</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Er is al <strong style="color:#f87171;">${opts.daysQuiet} dagen</strong> geen enkele nieuwe
      kandidaat binnengekomen, terwijl er
      <strong style="color:#e8e9ed;">${opts.openVacancies} vacature(s)</strong> openstaan.
      De laatste kandidaat kwam binnen op <strong style="color:#e8e9ed;">${opts.lastLeadDate}</strong>.
    </p>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">Controleer in deze volgorde:</p>
    <ol style="color:#9ca3af;font-size:13px;margin:0 0 24px;padding-left:20px;">
      <li style="margin-bottom:6px;">Leveren de campagnes nog uit, of staan ze op pauze of zonder budget?</li>
      <li style="margin-bottom:6px;">Komen er in Meta Events Manager nog PageView- en SubmitApplication-events binnen vanaf de vacaturepagina's?</li>
      <li>Werkt het sollicitatieformulier zelf nog? Doe zelf een testsollicitatie.</li>
    </ol>
    <a href="${opts.portalUrl}" style="display:inline-block;background:#196961;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
      Open de werving-module
    </a>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `Geen nieuwe kandidaten in ${opts.daysQuiet} dagen`,
    html: htmlWrapper(content, 'Leadstroom gestopt'),
    text: `Er is al ${opts.daysQuiet} dagen geen nieuwe kandidaat binnengekomen (laatste: ${opts.lastLeadDate}), terwijl er ${opts.openVacancies} vacature(s) openstaan. Controleer of de campagnes nog uitleveren, of Meta nog SubmitApplication-events ontvangt, en of het sollicitatieformulier werkt.`,
  });
}

export async function sendNewCandidateEmail(opts: {
  to: string;
  candidateName: string;
  email: string;
  phone?: string;
  source: string;
  campaignId?: string;
  jobTitle?: string;
  /** Extra regel bovenaan, bijv. "Aan jou toegewezen" of "Heropend na nieuwe sollicitatie". */
  intro?: string;
  portalUrl: string;
}) {
  const auto = await getAutomationConfig('new_candidate');
  if (!auto.enabled) return;

  const row = (label: string, value: string, shaded: boolean, color = '#e8e9ed') => `
      <tr${shaded ? ' style="background:#1e2028;"' : ''}>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">${label}</td>
        <td style="padding:12px 16px;color:${color};font-size:13px;">${value}</td>
      </tr>`;

  const rows: string[] = [];
  rows.push(row('Naam', `<strong>${esc(opts.candidateName)}</strong>`, true));
  if (opts.jobTitle) rows.push(row('Vacature', esc(opts.jobTitle), rows.length % 2 === 0));
  rows.push(row('E-mail', esc(opts.email), rows.length % 2 === 0, '#68b0a6'));
  if (opts.phone) rows.push(row('Telefoon', esc(opts.phone), rows.length % 2 === 0));
  rows.push(row('Bron', esc(opts.source), rows.length % 2 === 0, '#f7a247'));
  if (opts.campaignId) rows.push(row('Campagne', esc(opts.campaignId), rows.length % 2 === 0));

  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Nieuwe kandidaat: ${esc(opts.candidateName)} 🎯</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      ${esc(opts.intro ?? `Er is een nieuwe kandidaat binnengekomen via ${opts.source}.`)}
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      ${rows.join('')}
    </table>
    ${btn('Open kandidaat in ZwaluwNest', esc(opts.portalUrl))}
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `Nieuwe kandidaat: ${opts.candidateName}${opts.jobTitle ? ` — ${opts.jobTitle}` : ''} (${opts.source})`,
    html: htmlWrapper(content, 'Nieuwe kandidaat'),
    text: `Nieuwe kandidaat via ${opts.source}: ${opts.candidateName} (${opts.email}). Bekijk in ZwaluwNest: ${opts.portalUrl}`,
  });
}

/**
 * Ontvangstbevestiging aan de sollicitant, direct na het versturen van het
 * formulier op de vacaturepagina.
 */
export async function sendApplicationReceivedEmail(opts: {
  to: string;
  firstName: string;
  jobTitle: string;
}) {
  const auto = await getAutomationConfig('application_received');
  if (!auto.enabled) return;

  const defaultIntro =
    `Bedankt voor je sollicitatie als ${opts.jobTitle} bij Zwaluw Comfortsanitair! We hebben je gegevens goed ontvangen.\n\n` +
    'We nemen binnen twee werkdagen telefonisch contact met je op voor een kort kennismakingsgesprek. Houd je telefoon dus in de buurt — we bellen soms vanaf een afgeschermd nummer.';
  const intro = escMultiline(auto.customIntro ?? defaultIntro);

  const content = `
    ${cHeading('We hebben je sollicitatie ontvangen')}
    <p style="margin:0 0 16px;">Hoi ${esc(opts.firstName)},</p>
    <p style="margin:0 0 16px;">${intro}</p>
    <p style="margin:0 0 16px;">
      Heb je in de tussentijd een vraag, of wil je nog iets aanvullen (zoals je cv)? Antwoord dan gewoon op deze mail
      of mail naar <a href="mailto:${CANDIDATE_CONTACT_EMAIL}" style="color:#196961;">${CANDIDATE_CONTACT_EMAIL}</a>.
    </p>
    <p style="margin:24px 0 0;">Hartelijke groet,<br /><strong>Team Zwaluw Comfortsanitair</strong></p>
  `;

  return sendViaGmail({
    to: opts.to,
    fromName: CANDIDATE_FROM_NAME,
    replyTo: CANDIDATE_CONTACT_EMAIL,
    subject: auto.customSubject ?? `Bedankt voor je sollicitatie als ${opts.jobTitle}`,
    html: candidateWrapper(content, 'Sollicitatie ontvangen'),
    text: `Hoi ${opts.firstName}, bedankt voor je sollicitatie als ${opts.jobTitle} bij Zwaluw Comfortsanitair. We nemen binnen twee werkdagen telefonisch contact met je op.`,
  });
}

export async function sendPoortwachterEmail(opts: {
  to: string;
  employeeName: string;
  week: number;
  sickSince: string;
  action: string;
}) {
  const auto = await getAutomationConfig('poortwachter');
  if (!auto.enabled) return;

  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">⚠️ Poortwachter actie vereist — Week ${opts.week}</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      <strong style="color:#e8e9ed;">${opts.employeeName}</strong> is ziek sinds
      <strong style="color:#e8e9ed;">${opts.sickSince}</strong> en heeft nu week ${opts.week} bereikt
      in de Wet verbetering poortwachter.
    </p>
    <div style="background:#f7a247/10;border:1px solid #f7a247;border-radius:8px;padding:16px;margin-bottom:16px;">
      <p style="color:#f7a247;font-size:13px;font-weight:600;margin:0 0 4px;">Vereiste actie:</p>
      <p style="color:#e8e9ed;font-size:14px;margin:0;">${opts.action}</p>
    </div>
    <p style="color:#9ca3af;font-size:12px;">
      Verzuim tijdig bijhouden voorkomt boetes van het UWV.
      Zorg dat dit gedocumenteerd is in het poortwachter dossier.
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `[Poortwachter] Week ${opts.week} actie vereist — ${opts.employeeName}`,
    html: htmlWrapper(content, `Poortwachter Week ${opts.week}`),
    text: `Poortwachter week ${opts.week} actie vereist voor ${opts.employeeName} (ziek sinds ${opts.sickSince}). Actie: ${opts.action}`,
  });
}

export async function sendPrescreeningEmail(opts: {
  to: string;
  name: string;
  token: string;
  baseUrl: string;
}) {
  const auto = await getAutomationConfig('prescreening_invite');
  if (!auto.enabled) return;

  const url = `${opts.baseUrl}/screening/${opts.token}`;
  const introText = escMultiline(
    auto.customIntro ??
      'Bedankt voor je interesse in een functie bij Zwaluw Comfortsanitair. We nodigen je uit om de pre-screening in te vullen. Dit duurt ongeveer 5 minuten.'
  );

  const content = `
    ${cHeading('Uitnodiging pre-screening')}
    <p style="margin:0 0 16px;">Hoi ${esc(opts.name)},</p>
    <p style="margin:0 0 16px;">${introText}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#6f7977;">
      De link is 7 dagen geldig. Je hoeft geen account aan te maken.
    </p>
    ${cBtn('Start pre-screening →', url)}
    <p style="color:#6f7977;font-size:12px;margin-top:16px;word-break:break-all;">
      Werkt de knop niet? Kopieer deze link: <span style="color:#196961;">${esc(url)}</span>
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    fromName: CANDIDATE_FROM_NAME,
    replyTo: CANDIDATE_CONTACT_EMAIL,
    subject: auto.customSubject ?? 'Uitnodiging pre-screening — Zwaluw Comfortsanitair',
    html: candidateWrapper(content, 'Pre-screening uitnodiging'),
    text: `Hoi ${opts.name}, vul je pre-screening in via: ${url} (geldig 7 dagen)`,
  });
}

export async function sendReviewRequestEmail(opts: {
  to: string;
  customerName: string;
  reviewUrl: string;
}) {
  const auto = await getAutomationConfig('review_request');
  if (!auto.enabled) return;

  const introText = auto.customIntro
    ? auto.customIntro.replace(/\n/g, '<br />')
    : 'Bedankt voor uw keuze voor Veilig Douchen! We hopen dat u tevreden bent met uw nieuwe doucheaanpassing. We stellen het zeer op prijs als u een review achterlaat.';

  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Tevreden over uw nieuwe douche? ⭐</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Beste ${opts.customerName},<br /><br />
      ${introText}
    </p>
    ${btn('Laat een review achter →', opts.reviewUrl)}
    <p style="color:#6b7280;font-size:12px;margin-top:16px;">
      Het invullen duurt minder dan een minuut.
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? 'Hoe was uw ervaring met Veilig Douchen?',
    html: htmlWrapper(content, 'Review verzoek'),
    text: `Beste ${opts.customerName}, laat een review achter via: ${opts.reviewUrl}`,
  });
}

export async function sendInterviewInviteEmail(opts: {
  to: string;
  candidateName: string;
  recruiterName?: string;
}) {
  const auto = await getAutomationConfig('interview_invite');
  if (!auto.enabled) return;

  const firstName = opts.candidateName.split(' ')[0];
  const defaultIntro = 'Goed nieuws! Na het beoordelen van jouw profiel nodigen we je uit voor een gesprek bij Zwaluw Comfortsanitair. We zijn erg benieuwd naar jouw achtergrond en motivatie.';
  const introText = escMultiline(auto.customIntro ?? defaultIntro);
  const content = `
    ${cHeading('Uitnodiging voor een gesprek')}
    <p style="margin:0 0 16px;">Hoi ${esc(firstName)},</p>
    <p style="margin:0 0 16px;">${introText}</p>
    <p style="margin:0 0 16px;">
      ${opts.recruiterName ? `<strong>${esc(opts.recruiterName)}</strong> neemt binnenkort contact met je op om een datum en tijdstip af te spreken.` : 'Een van onze collega’s neemt binnenkort contact met je op om een datum en tijdstip af te spreken.'}
    </p>
    <div style="background:#f6f3f2;border-radius:8px;padding:16px;margin-top:16px;font-size:14px;">
      <strong>Wat kun je verwachten?</strong><br />
      • Een kennismakingsgesprek van ongeveer 45 minuten op ons kantoor in Zeewolde<br />
      • We bespreken de functie, de arbeidsvoorwaarden en jouw wensen<br />
      • Gelegenheid om al je vragen te stellen
    </div>
    <p style="margin:16px 0 0;font-size:14px;">
      Vragen? Mail gerust naar <a href="mailto:${CANDIDATE_CONTACT_EMAIL}" style="color:#196961;">${CANDIDATE_CONTACT_EMAIL}</a>.
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    fromName: CANDIDATE_FROM_NAME,
    replyTo: CANDIDATE_CONTACT_EMAIL,
    subject: auto.customSubject ?? 'Uitnodiging gesprek — Zwaluw Comfortsanitair',
    html: candidateWrapper(content, 'Uitnodiging gesprek'),
    text: `Hoi ${firstName}, goed nieuws! Je bent uitgenodigd voor een gesprek bij Zwaluw Comfortsanitair. ${opts.recruiterName ?? 'Een collega'} neemt binnenkort contact op.`,
  });
}

export async function sendAppointmentConfirmationCandidate(opts: {
  to: string;
  candidateName: string;
  date: string;
  time: string;
  location: string;
}) {
  const auto = await getAutomationConfig('appointment_candidate');
  if (!auto.enabled) return;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) return;
  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:10px 16px;color:#6f7977;font-size:14px;border-bottom:1px solid #eae8e7;">${label}</td>
        <td style="padding:10px 16px;color:#1b1c1c;font-size:14px;font-weight:600;border-bottom:1px solid #eae8e7;">${value}</td>
      </tr>`;
  const content = `
    ${cHeading('Je gesprek is ingepland ✓')}
    <p style="margin:0 0 16px;">Hoi ${esc(opts.candidateName)},</p>
    <p style="margin:0 0 20px;">Je sollicitatiegesprek bij Zwaluw Comfortsanitair is bevestigd. We kijken ernaar uit je te ontmoeten!</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #eae8e7;border-radius:8px;overflow:hidden;">
      ${row('Datum', esc(opts.date))}
      ${row('Tijd', `${esc(opts.time)} uur`)}
      ${row('Locatie', esc(opts.location))}
    </table>
    <p style="margin:20px 0 0;font-size:14px;">
      Moet de afspraak worden verzet, of heb je een vraag? Mail naar
      <a href="mailto:${CANDIDATE_CONTACT_EMAIL}" style="color:#196961;">${CANDIDATE_CONTACT_EMAIL}</a>.
    </p>
    <p style="margin:16px 0 0;">Tot dan!<br /><strong>Team Zwaluw Comfortsanitair</strong></p>
  `;

  return sendViaGmail({
    to: opts.to,
    fromName: CANDIDATE_FROM_NAME,
    replyTo: CANDIDATE_CONTACT_EMAIL,
    subject: auto.customSubject ?? `Afspraak bevestigd — ${opts.date} om ${opts.time} uur`,
    html: candidateWrapper(content, 'Afspraak bevestigd'),
    text: `Hoi ${opts.candidateName}, je sollicitatiegesprek is bevestigd op ${opts.date} om ${opts.time} uur op ${opts.location}. Tot dan! — Team Zwaluw Comfortsanitair`,
  });
}

export async function sendAppointmentNotificationInternal(opts: {
  to: string;
  candidateName: string;
  candidatePhone: string | null;
  date: string;
  time: string;
}) {
  const auto = await getAutomationConfig('appointment_internal');
  if (!auto.enabled) return;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) return;
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Afspraak ingepland 📅</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Er is een sollicitatiegesprek ingepland via de werving pipeline.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Kandidaat</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${esc(opts.candidateName)}</td>
      </tr>
      ${opts.candidatePhone ? `
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Telefoon</td>
        <td style="padding:12px 16px;color:#68b0a6;font-size:13px;">${esc(opts.candidatePhone)}</td>
      </tr>` : ''}
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Datum</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.date}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Tijd</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.time} uur</td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
      Kandidaat en recruiter ontvingen een bevestiging. Status is bijgewerkt naar Interview.
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    subject: auto.customSubject ?? `Afspraak ingepland: ${opts.candidateName} — ${opts.date} ${opts.time}`,
    html: htmlWrapper(content, 'Afspraak ingepland'),
    text: `Afspraak ingepland voor ${opts.candidateName} op ${opts.date} om ${opts.time} uur.`,
  });
}

export async function sendRejectionEmail(opts: {
  to: string;
  candidateName: string;
}) {
  const auto = await getAutomationConfig('rejection');
  if (!auto.enabled) return;

  const firstName = opts.candidateName.split(' ')[0];
  const defaultIntro = `Bedankt voor je interesse in een functie bij Zwaluw Comfortsanitair en de tijd die je hebt gestoken in je sollicitatie.\n\nNa zorgvuldige overweging hebben we besloten om je sollicitatie niet verder in behandeling te nemen. Dit is een moeilijke beslissing, want we hebben veel enthousiaste kandidaten ontvangen.\n\nWe wensen je veel succes bij je zoektocht naar een passende functie.`;
  const introText = escMultiline(auto.customIntro ?? defaultIntro);

  const content = `
    ${cHeading('Terugkoppeling op je sollicitatie')}
    <p style="margin:0 0 16px;">Hoi ${esc(firstName)},</p>
    <p style="margin:0 0 16px;">${introText}</p>
    <div style="background:#f6f3f2;border-radius:8px;padding:16px;margin-top:16px;font-size:14px;">
      Mocht er in de toekomst een passende vacature ontstaan, dan houden we je graag in gedachten.
    </div>
    <p style="margin:24px 0 0;">Hartelijke groet,<br /><strong>Team Zwaluw Comfortsanitair</strong></p>
  `;

  return sendViaGmail({
    to: opts.to,
    fromName: CANDIDATE_FROM_NAME,
    replyTo: CANDIDATE_CONTACT_EMAIL,
    subject: auto.customSubject ?? 'Terugkoppeling sollicitatie — Zwaluw Comfortsanitair',
    html: candidateWrapper(content, 'Terugkoppeling sollicitatie'),
    text: `Hoi ${firstName}, bedankt voor je sollicitatie bij Zwaluw Comfortsanitair. Na zorgvuldige overweging hebben we besloten je sollicitatie niet verder in behandeling te nemen. Veel succes.`,
  });
}

export async function sendPhoneCorrectEmail(opts: {
  to: string;
  name: string;
  token: string;
  baseUrl: string;
}) {
  const auto = await getAutomationConfig('phone_correct');
  if (!auto.enabled) return;

  const url = `${opts.baseUrl}/nummer-corrigeren/${opts.token}`;
  const introText = escMultiline(
    auto.customIntro ??
      'We probeerden je te bellen over je sollicitatie, maar het telefoonnummer dat we hebben lijkt niet te kloppen. Wil je je juiste nummer aan ons doorgeven?'
  );

  const content = `
    ${cHeading('Klopt je telefoonnummer?')}
    <p style="margin:0 0 16px;">Hoi ${esc(opts.name)},</p>
    <p style="margin:0 0 16px;">${introText}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#6f7977;">
      Via de knop hieronder geef je je juiste nummer door. De link is 7 dagen geldig.
    </p>
    ${cBtn('Nummer doorgeven →', url)}
    <p style="color:#6f7977;font-size:12px;margin-top:16px;word-break:break-all;">
      Werkt de knop niet? Kopieer deze link: <span style="color:#196961;">${esc(url)}</span>
    </p>
  `;

  return sendViaGmail({
    to: opts.to,
    fromName: CANDIDATE_FROM_NAME,
    replyTo: CANDIDATE_CONTACT_EMAIL,
    subject: auto.customSubject ?? 'Klopt je telefoonnummer? — Zwaluw Comfortsanitair',
    html: candidateWrapper(content, 'Telefoonnummer controleren'),
    text: `Hoi ${opts.name}, we probeerden je te bellen maar het nummer klopt niet. Geef je juiste nummer door via: ${url} (geldig 7 dagen)`,
  });
}
