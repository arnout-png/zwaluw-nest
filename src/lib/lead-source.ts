/**
 * Vertaalt de herkomst van een sollicitant (utm-tags, click-id's, referrer)
 * naar Candidate.leadSource + leadCampaignId.
 *
 * Bronwaarden sluiten aan op wat het portal al kent (FACEBOOK, LINKEDIN,
 * INDEED, GOOGLE, OTHER, MANUAL); WEBSITE = direct/onbekend via het publieke
 * sollicitatieformulier (vroeger werd dat ten onrechte MANUAL/"Handmatig").
 */
import type { Attribution } from '@/lib/attribution';

export interface LeadSourceResult {
  leadSource: 'FACEBOOK' | 'LINKEDIN' | 'INDEED' | 'GOOGLE' | 'OTHER' | 'WEBSITE';
  leadCampaignId: string | null;
}

function host(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

export function sanitizeAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string | number> = {};
  const src = raw as Record<string, unknown>;
  for (const key of [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
    'fbclid', 'gclid', 'referrer', 'landingPage',
  ]) {
    const v = src[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 300);
  }
  if (typeof src.capturedAt === 'number' && Number.isFinite(src.capturedAt)) out.capturedAt = src.capturedAt;
  return out as Attribution;
}

export function classifyLeadSource(a: Attribution): LeadSourceResult {
  const source = (a.utm_source ?? '').toLowerCase();
  const refHost = host(a.referrer);
  const campaign = (a.utm_id ?? a.utm_campaign ?? '').slice(0, 200) || null;

  const isMeta =
    !!a.fbclid ||
    /^(fb|facebook|ig|instagram|meta|messenger|an|audience_network|threads)$/.test(source) ||
    /facebook|instagram/.test(source) ||
    /(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me|messenger\.com|threads\.net)$/.test(refHost);
  if (isMeta) return { leadSource: 'FACEBOOK', leadCampaignId: campaign };

  if (/linkedin/.test(source) || /(^|\.)(linkedin\.com|lnkd\.in)$/.test(refHost)) {
    return { leadSource: 'LINKEDIN', leadCampaignId: campaign };
  }
  if (/indeed/.test(source) || /(^|\.)indeed\./.test(refHost)) {
    return { leadSource: 'INDEED', leadCampaignId: campaign };
  }
  if (!!a.gclid || /google/.test(source) || /(^|\.)google\./.test(refHost)) {
    return { leadSource: 'GOOGLE', leadCampaignId: campaign };
  }
  if (source) return { leadSource: 'OTHER', leadCampaignId: campaign };
  return { leadSource: 'WEBSITE', leadCampaignId: campaign };
}

/** Leesbare samenvatting voor de kandidaatnotitie. */
export function describeAttribution(a: Attribution, result: LeadSourceResult): string | null {
  const parts: string[] = [];
  const label: Record<LeadSourceResult['leadSource'], string> = {
    FACEBOOK: 'Facebook/Instagram',
    LINKEDIN: 'LinkedIn',
    INDEED: 'Indeed',
    GOOGLE: 'Google',
    OTHER: 'Overig',
    WEBSITE: 'Website (direct)',
  };
  parts.push(`**Bron:** ${label[result.leadSource]}`);
  if (a.utm_source) parts.push(`utm_source: ${a.utm_source}`);
  if (a.utm_medium) parts.push(`utm_medium: ${a.utm_medium}`);
  if (a.utm_campaign) parts.push(`campagne: ${a.utm_campaign}`);
  if (a.utm_id) parts.push(`campagne-id: ${a.utm_id}`);
  if (a.utm_content) parts.push(`advertentie: ${a.utm_content}`);
  if (a.fbclid) parts.push('Facebook-klik (fbclid)');
  if (a.referrer) parts.push(`via: ${a.referrer}`);
  return parts.length > 1 || result.leadSource !== 'WEBSITE' ? parts.join(' · ') : null;
}
