import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { google } from 'googleapis';

function getGmailClient() {
  const credBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS not set');
  const credentials = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf-8'));
  const sender = process.env.GMAIL_SENDER ?? 'noreply@veiligdouchen.nl';
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: sender,
  });
  return { gmail: google.gmail({ version: 'v1', auth }), sender };
}

function buildHtml(opts: {
  isBug: boolean;
  subject: string;
  senderName: string;
  description: string;
  url: string;
  screenshot: string | null;
}) {
  const { isBug, subject, senderName, description, url, screenshot } = opts;

  const screenshotBlock = screenshot
    ? `<div style="margin-top:16px;">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;font-weight:600;">SCREENSHOT</p>
        <img src="${screenshot}" style="max-width:100%;border-radius:8px;border:1px solid #363848;" />
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#1e2028;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#252732;border-radius:12px;border:1px solid #363848;overflow:hidden;">
    <tr>
      <td style="background:#14151b;padding:20px 32px;border-bottom:1px solid #363848;">
        <span style="font-size:20px;">${isBug ? '🐛' : '✨'}</span>
        <span style="color:#fff;font-size:14px;font-weight:600;margin-left:10px;">ZwaluwNest — ${isBug ? 'Bug melding' : 'Functiewens'}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-radius:8px;border:1px solid #363848;overflow:hidden;margin-bottom:16px;">
          <tr style="background:#1e2028;">
            <td style="padding:10px 16px;color:#9ca3af;font-size:12px;width:120px;">Type</td>
            <td style="padding:10px 16px;color:#e8e9ed;font-size:13px;font-weight:500;">${isBug ? '🐛 Bug' : '✨ Functiewens'}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#9ca3af;font-size:12px;">Ingediend door</td>
            <td style="padding:10px 16px;color:#e8e9ed;font-size:13px;">${senderName}</td>
          </tr>
          <tr style="background:#1e2028;">
            <td style="padding:10px 16px;color:#9ca3af;font-size:12px;">Pagina</td>
            <td style="padding:10px 16px;color:#68b0a6;font-size:12px;font-family:monospace;">${url}</td>
          </tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;font-weight:600;">BESCHRIJVING</p>
        <div style="background:#1e2028;border-radius:8px;padding:16px;border:1px solid #363848;">
          <p style="color:#e8e9ed;font-size:14px;margin:0;line-height:1.6;white-space:pre-wrap;">${description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
        ${screenshotBlock}
      </td>
    </tr>
    <tr>
      <td style="background:#1e2028;padding:16px 32px;border-top:1px solid #363848;text-align:center;">
        <p style="color:#6b7280;font-size:12px;margin:0;">Automatisch gegenereerd door ZwaluwNest</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });

  let body: { type: 'bug' | 'feature'; description: string; screenshot?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  const { type, description, screenshot, url } = body;
  if (!description?.trim()) {
    return NextResponse.json({ error: 'Beschrijving is verplicht.' }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? 'arnout@veiligdouchen.nl';
  const isBug = type === 'bug';
  const subject = isBug
    ? `[ZwaluwNest Bug] ${description.slice(0, 60)}${description.length > 60 ? '…' : ''}`
    : `[ZwaluwNest Wens] ${description.slice(0, 60)}${description.length > 60 ? '…' : ''}`;

  // Limit screenshot to 5MB to stay well within Gmail's 25MB message limit
  const screenshotForEmail = screenshot && screenshot.length < 5_000_000 ? screenshot : null;

  const html = buildHtml({
    isBug,
    subject,
    senderName: session.name ?? session.email,
    description,
    url: url ?? '–',
    screenshot: screenshotForEmail,
  });

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    console.log('[Feedback] No email credentials — received:', { type, description, url, hasSS: !!screenshot });
    return NextResponse.json({ success: true });
  }

  try {
    const { gmail, sender } = getGmailClient();
    const message = [
      `From: ZwaluwNest <${sender}>`,
      `To: ${adminEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      '',
      html,
    ].join('\r\n');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(message).toString('base64url') },
    });
  } catch (err) {
    // Email failed — log content so it's recoverable from Vercel logs
    console.error('[Feedback] Gmail send failed:', String(err));
    console.log('[Feedback] Content:', JSON.stringify({ type, description, url, sender: session.name }));
  }

  return NextResponse.json({ success: true });
}
