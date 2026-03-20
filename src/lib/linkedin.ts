/**
 * LinkedIn Lead Gen Forms API helper
 *
 * Requires Marketing Developer Platform access and the
 * r_ads_leadgen_automation OAuth scope.
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/lead-gen/lead-gen-forms-response-api
 */

export interface LinkedInLeadFormResponse {
  id: string;
  submittedAt: number; // epoch ms
  campaignId?: string;
  formId?: string;
  formValues: Array<{
    questionId: string;
    questionType: string;
    answer: {
      values: string[];
    };
  }>;
}

export interface ParsedLead {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  leadCampaignId?: string;
}

/** Fetch lead form responses from LinkedIn API */
export async function getLinkedInLeads(
  accessToken: string,
  campaignId?: string,
  startTimeMs?: number
): Promise<LinkedInLeadFormResponse[]> {
  const params = new URLSearchParams({
    q: 'owner',
    sortBy: 'DATE_SUBMITTED',
  });

  if (campaignId) params.set('campaign', `urn:li:sponsoredCampaign:${campaignId}`);
  if (startTimeMs) params.set('dateRange.start.day', String(startTimeMs));

  const res = await fetch(`https://api.linkedin.com/v2/adFormResponses?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return (json.elements ?? []) as LinkedInLeadFormResponse[];
}

/** Map a LinkedIn lead form response to a candidate-like object */
export function parseLeadToCandidate(lead: LinkedInLeadFormResponse): ParsedLead {
  const get = (questionType: string) =>
    lead.formValues.find((v) => v.questionType === questionType)?.answer.values[0] ?? '';

  const firstName = get('FIRST_NAME') || get('firstName');
  const lastName = get('LAST_NAME') || get('lastName');
  const email = get('EMAIL') || get('emailAddress');
  const phone = get('PHONE_NUMBER') || get('phoneNumber') || undefined;

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || undefined,
    leadCampaignId: lead.campaignId,
  };
}

/** Build the LinkedIn OAuth authorization URL */
export function buildLinkedInAuthUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID ?? '';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/integrations/linkedin/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'r_ads_leadgen_automation r_ads r_organization_social',
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

/** Exchange an OAuth authorization code for an access token */
export async function exchangeLinkedInCode(code: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.LINKEDIN_CLIENT_ID ?? '';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? '';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/integrations/linkedin/callback`;

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token exchange failed ${res.status}: ${text}`);
  }

  return res.json();
}

/** Verify a LinkedIn webhook event signature (HMAC-SHA256) */
export async function verifyLinkedInWebhookSignature(
  body: string,
  signatureHeader: string
): Promise<boolean> {
  const secret = process.env.LINKEDIN_WEBHOOK_SECRET ?? '';
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // LinkedIn sends the signature as "sha256=<hex>" or just "<hex>"
  const hexSig = signatureHeader.replace(/^sha256=/, '');
  const sigBytes = Buffer.from(hexSig, 'hex');

  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body));
}
