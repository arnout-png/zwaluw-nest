import { Resend } from 'resend';

// Lazy initialization — Resend throws at construction if the key is missing.
// All send functions are no-ops when RESEND_API_KEY is not set.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'ZwaluwNest <noreply@zwaluw.nl>';

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

// ─── Email templates ───────────────────────────────────────────────────────────

export async function sendLeaveApprovedEmail(opts: {
  to: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
}) {
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

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Verlof goedgekeurd — ${opts.days} dag${opts.days !== 1 ? 'en' : ''} ${label.toLowerCase()}`,
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

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Verlofaanvraag afgewezen — ${label}`,
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

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `${urgent ? '[URGENT] ' : ''}Contract ${opts.employeeName} verloopt over ${opts.daysLeft} dagen`,
    html: htmlWrapper(content, 'Contract verloopt'),
    text: `Contract van ${opts.employeeName} verloopt over ${opts.daysLeft} dagen op ${opts.endDate}.`,
  });
}

export async function sendNewCandidateEmail(opts: {
  to: string;
  candidateName: string;
  email: string;
  phone?: string;
  source: string;
  campaignId?: string;
  portalUrl: string;
}) {
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Nieuwe kandidaat via ${opts.source} 🎯</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Er is een nieuwe kandidaat binnengekomen via de Facebook Lead Ads campagne.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Naam</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.candidateName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">E-mail</td>
        <td style="padding:12px 16px;color:#68b0a6;font-size:13px;">${opts.email}</td>
      </tr>
      ${opts.phone ? `
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Telefoon</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;">${opts.phone}</td>
      </tr>` : ''}
      <tr ${opts.phone ? '' : 'style="background:#1e2028;"'}>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Bron</td>
        <td style="padding:12px 16px;color:#f7a247;font-size:13px;">${opts.source}</td>
      </tr>
      ${opts.campaignId ? `
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Campagne ID</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:12px;font-family:monospace;">${opts.campaignId}</td>
      </tr>` : ''}
    </table>
    ${btn('Bekijk in Werving Kanban', opts.portalUrl)}
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Nieuwe kandidaat: ${opts.candidateName} (${opts.source})`,
    html: htmlWrapper(content, 'Nieuwe kandidaat'),
    text: `Nieuwe kandidaat via ${opts.source}: ${opts.candidateName} (${opts.email}). Bekijk in ZwaluwNest: ${opts.portalUrl}`,
  });
}

export async function sendPoortwachterEmail(opts: {
  to: string;
  employeeName: string;
  week: number;
  sickSince: string;
  action: string;
}) {
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

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `[Poortwachter] Week ${opts.week} actie vereist — ${opts.employeeName}`,
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
  const url = `${opts.baseUrl}/screening/${opts.token}`;
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Uitnodiging — Pre-screening Veilig Douchen</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;">
      Hallo ${opts.name},<br /><br />
      Bedankt voor je interesse in een functie bij Veilig Douchen. We nodigen je uit om de pre-screening in te vullen.
      Dit duurt ongeveer 5 minuten.
    </p>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">
      De link is 7 dagen geldig. Je hoeft geen account aan te maken.
    </p>
    ${btn('Start pre-screening →', url)}
    <p style="color:#6b7280;font-size:11px;margin-top:16px;">
      Of kopieer deze link: <span style="color:#68b0a6;">${url}</span>
    </p>
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Uitnodiging pre-screening — Veilig Douchen',
    html: htmlWrapper(content, 'Pre-screening uitnodiging'),
    text: `Hallo ${opts.name}, vul je pre-screening in via: ${url} (geldig 7 dagen)`,
  });
}

export async function sendReviewRequestEmail(opts: {
  to: string;
  customerName: string;
  reviewUrl: string;
}) {
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Tevreden over uw nieuwe douche? ⭐</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Beste ${opts.customerName},<br /><br />
      Bedankt voor uw keuze voor Veilig Douchen! We hopen dat u tevreden bent met uw nieuwe doucheaanpassing.
      We stellen het zeer op prijs als u een review achterlaat.
    </p>
    ${btn('Laat een review achter →', opts.reviewUrl)}
    <p style="color:#6b7280;font-size:12px;margin-top:16px;">
      Het invullen duurt minder dan een minuut.
    </p>
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Hoe was uw ervaring met Veilig Douchen?',
    html: htmlWrapper(content, 'Review verzoek'),
    text: `Beste ${opts.customerName}, laat een review achter via: ${opts.reviewUrl}`,
  });
}

export async function sendInterviewInviteEmail(opts: {
  to: string;
  candidateName: string;
  recruiterName?: string;
}) {
  const firstName = opts.candidateName.split(' ')[0];
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Uitnodiging gesprek — Veilig Douchen</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;">
      Hallo ${firstName},<br /><br />
      Goed nieuws! Na het beoordelen van jouw profiel nodigen we je uit voor een gesprek bij Veilig Douchen.
      We zijn erg benieuwd naar jouw achtergrond en motivatie.<br /><br />
      ${opts.recruiterName ? `<strong style="color:#fff;">${opts.recruiterName}</strong> neemt binnenkort contact met je op om een datum en tijdstip af te spreken.` : 'Een van onze recruiters neemt binnenkort contact met je op om een datum en tijdstip af te spreken.'}
    </p>
    <div style="background:#1e2028;border-radius:8px;padding:16px;margin-top:16px;">
      <p style="color:#9ca3af;font-size:13px;margin:0;">
        <strong style="color:#fff;">Wat kun je verwachten?</strong><br />
        • Een kennismakingsgesprek van ongeveer 45 minuten<br />
        • We bespreken de functie, de arbeidsvoorwaarden en jouw wensen<br />
        • Gelegenheid om al je vragen te stellen
      </p>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin-top:16px;">
      Heb je vragen? Neem gerust contact op via <a href="mailto:info@veiligdouchen.nl" style="color:#68b0a6;">info@veiligdouchen.nl</a>.
    </p>
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Uitnodiging gesprek — Veilig Douchen',
    html: htmlWrapper(content, 'Uitnodiging gesprek'),
    text: `Hallo ${firstName}, goed nieuws! Je bent uitgenodigd voor een gesprek bij Veilig Douchen. ${opts.recruiterName ?? 'Een recruiter'} neemt binnenkort contact op.`,
  });
}

export async function sendAppointmentConfirmationCandidate(opts: {
  to: string;
  candidateName: string;
  date: string;
  time: string;
  location: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Afspraak bevestigd ✓</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Hoi ${opts.candidateName},<br /><br />
      Geweldig! Je sollicitatiegesprek bij Veilig Douchen is bevestigd. We kijken ernaar uit je te ontmoeten.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Datum</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.date}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Tijd</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.time} uur</td>
      </tr>
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Locatie</td>
        <td style="padding:12px 16px;color:#68b0a6;font-size:13px;">${opts.location}</td>
      </tr>
    </table>
    <p style="color:#9ca3af;font-size:13px;margin-top:20px;">
      Neem gerust contact op als je vragen hebt of de afspraak moet verzetten:<br />
      <a href="mailto:info@veiligdouchen.nl" style="color:#68b0a6;">info@veiligdouchen.nl</a>
    </p>
    <p style="color:#9ca3af;font-size:13px;margin-top:8px;">
      Tot dan! — Team Veilig Douchen
    </p>
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Afspraak bevestigd — ${opts.date} om ${opts.time} uur`,
    html: htmlWrapper(content, 'Afspraak bevestigd'),
    text: `Hoi ${opts.candidateName}, je sollicitatiegesprek is bevestigd op ${opts.date} om ${opts.time} uur op ${opts.location}. Tot dan! — Team Veilig Douchen`,
  });
}

export async function sendAppointmentNotificationInternal(opts: {
  to: string;
  candidateName: string;
  candidatePhone: string | null;
  date: string;
  time: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Afspraak ingepland 📅</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      Er is een sollicitatiegesprek ingepland via de werving pipeline.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;">
      <tr style="background:#1e2028;">
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Kandidaat</td>
        <td style="padding:12px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${opts.candidateName}</td>
      </tr>
      ${opts.candidatePhone ? `
      <tr>
        <td style="padding:12px 16px;color:#9ca3af;font-size:13px;">Telefoon</td>
        <td style="padding:12px 16px;color:#68b0a6;font-size:13px;">${opts.candidatePhone}</td>
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

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: `Afspraak ingepland: ${opts.candidateName} — ${opts.date} ${opts.time}`,
    html: htmlWrapper(content, 'Afspraak ingepland'),
    text: `Afspraak ingepland voor ${opts.candidateName} op ${opts.date} om ${opts.time} uur.`,
  });
}

export async function sendRejectionEmail(opts: {
  to: string;
  candidateName: string;
}) {
  const firstName = opts.candidateName.split(' ')[0];
  const content = `
    <h2 style="color:#fff;font-size:20px;margin:0 0 8px;">Terugkoppeling sollicitatie — Veilig Douchen</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;">
      Hallo ${firstName},<br /><br />
      Bedankt voor je interesse in een functie bij Veilig Douchen en de tijd die je hebt gestoken in je sollicitatie.<br /><br />
      Na zorgvuldige overweging hebben we besloten om je sollicitatie niet verder in behandeling te nemen.
      Dit is een moeilijke beslissing, want we hebben veel enthousiaste kandidaten ontvangen.<br /><br />
      We wensen je veel succes bij je zoektocht naar een passende functie.
    </p>
    <div style="background:#1e2028;border-radius:8px;padding:16px;margin-top:16px;">
      <p style="color:#9ca3af;font-size:13px;margin:0;">
        Mocht er in de toekomst een passende vacature ontstaan, dan houden we je graag in gedachten.
      </p>
    </div>
  `;

  return getResend().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Terugkoppeling sollicitatie — Veilig Douchen',
    html: htmlWrapper(content, 'Terugkoppeling sollicitatie'),
    text: `Hallo ${firstName}, bedankt voor je sollicitatie bij Veilig Douchen. Na zorgvuldige overweging hebben we besloten je sollicitatie niet verder in behandeling te nemen. Veel succes.`,
  });
}
