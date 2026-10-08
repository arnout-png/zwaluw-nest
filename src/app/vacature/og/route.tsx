import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { getActiveJob } from '@/lib/vacature';
import { clean, formatHours, formatSalary } from '@/lib/vacature-format';

/**
 * GET /vacature/og[?slug=...] — 1200×630 deelafbeelding (og:image) voor
 * vacatures zonder eigen foto, en voor het vacatureoverzicht.
 *
 * Facebook wil minimaal 600×315 en bij voorkeur 1200×630 (1,91:1); met een
 * vaste maat kan de preview direct bij de eerste share renderen.
 */
let logoDataUri: string | null | undefined;

async function loadLogo(): Promise<string | null> {
  if (logoDataUri !== undefined) return logoDataUri;
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'logo.png'));
    logoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    logoDataUri = null;
  }
  return logoDataUri;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  const job = slug ? await getActiveJob(slug) : null;

  const title = job?.title ?? 'Werken bij Zwaluw Comfortsanitair';
  const facts = job
    ? [clean(job.location), formatHours(job.hoursPerWeek), formatSalary(job.salaryRange)].filter(Boolean).join('  ·  ')
    : 'Help mensen veilig en zelfstandig thuis te blijven wonen';
  const logo = await loadLogo();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #196961 0%, #0f4a44 100%)',
          padding: '64px 72px',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logo ? (
            <div style={{ display: 'flex', background: '#ffffff', borderRadius: 14, padding: '14px 22px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} width={265} height={60} alt="" />
            </div>
          ) : (
            <div style={{ fontSize: 34, fontWeight: 700 }}>Zwaluw Comfortsanitair</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#a7f0e5',
              marginBottom: 18,
            }}
          >
            {job ? 'Vacature' : 'Vacatures'}
          </div>
          <div style={{ display: 'flex', fontSize: title.length > 28 ? 64 : 76, fontWeight: 700, lineHeight: 1.1 }}>
            {title}
          </div>
          {facts && (
            <div style={{ display: 'flex', fontSize: 30, marginTop: 24, color: '#ffdcbf' }}>{facts}</div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#cfe9e5' }}>
          werkenbijzwaluwcomfortsanitair.nl
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    }
  );
}
