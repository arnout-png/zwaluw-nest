import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

/**
 * Google Calendar helper for ZwaluwNest
 *
 * Uses OAuth 2.0 per-employee refresh tokens stored in EmployeeProfile.
 *
 * Required env vars (OAuth app credentials):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   NEXT_PUBLIC_APP_URL    — used to build the OAuth redirect URI
 *
 * Per employee (stored in EmployeeProfile):
 *   googleRefreshToken     — encrypted refresh token
 *   googleCalendarId       — the calendar ID to use (usually 'primary')
 *   googleSyncEnabled      — feature flag
 */

function getOAuthClient(refreshToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function buildCalendarClient(refreshToken: string) {
  const auth = getOAuthClient(refreshToken);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Build the Google OAuth2 authorization URL.
 * Redirect the user here; after granting access, Google redirects to /callback.
 */
export function getGoogleAuthUrl(state?: string): string {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  );

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force consent to always get a refresh_token
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    state,
  });
}

/**
 * Exchange an authorization code for tokens and return them.
 */
export async function exchangeCode(code: string): Promise<{ refreshToken: string; accessToken: string }> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  );

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('No refresh_token returned — did you prompt consent?');
  return { refreshToken: tokens.refresh_token, accessToken: tokens.access_token ?? '' };
}

/**
 * Create a Google Calendar event for an appointment.
 */
export async function createCalendarEvent(opts: {
  refreshToken: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
}): Promise<string | null> {
  try {
    const cal = buildCalendarClient(opts.refreshToken);
    const event: calendar_v3.Schema$Event = {
      summary: opts.summary,
      description: opts.description,
      location: opts.location,
      start: { dateTime: opts.startIso, timeZone: 'Europe/Amsterdam' },
      end: { dateTime: opts.endIso, timeZone: 'Europe/Amsterdam' },
    };

    if (opts.attendeeEmail) {
      event.attendees = [{ email: opts.attendeeEmail }];
    }

    const res = await cal.events.insert({ calendarId: opts.calendarId, requestBody: event });
    return res.data.id ?? null;
  } catch (err) {
    console.error('Google Calendar createEvent error:', err);
    return null;
  }
}

/**
 * Update an existing calendar event.
 */
export async function updateCalendarEvent(opts: {
  refreshToken: string;
  calendarId: string;
  eventId: string;
  summary: string;
  startIso: string;
  endIso: string;
  location?: string;
}): Promise<void> {
  try {
    const cal = buildCalendarClient(opts.refreshToken);
    await cal.events.patch({
      calendarId: opts.calendarId,
      eventId: opts.eventId,
      requestBody: {
        summary: opts.summary,
        start: { dateTime: opts.startIso, timeZone: 'Europe/Amsterdam' },
        end: { dateTime: opts.endIso, timeZone: 'Europe/Amsterdam' },
        location: opts.location,
      },
    });
  } catch (err) {
    console.error('Google Calendar updateEvent error:', err);
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteCalendarEvent(opts: {
  refreshToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  try {
    const cal = buildCalendarClient(opts.refreshToken);
    await cal.events.delete({ calendarId: opts.calendarId, eventId: opts.eventId });
  } catch (err) {
    console.error('Google Calendar deleteEvent error:', err);
  }
}

/**
 * Create an out-of-office "all day" event for approved leave.
 */
export async function createOOOEvent(opts: {
  refreshToken: string;
  calendarId: string;
  employeeName: string;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
}): Promise<string | null> {
  const leaveLabels: Record<string, string> = {
    VACATION: 'Vakantie', SICK: 'Ziek', PERSONAL: 'Persoonlijk', UNPAID: 'Onbetaald', SPECIAL: 'Bijzonder verlof',
  };
  const label = leaveLabels[opts.leaveType] ?? opts.leaveType;

  // Google Calendar all-day events use date (not dateTime), and endDate is exclusive
  const endDateExclusive = new Date(opts.endDate);
  endDateExclusive.setDate(endDateExclusive.getDate() + 1);
  const endStr = endDateExclusive.toISOString().split('T')[0];

  try {
    const cal = buildCalendarClient(opts.refreshToken);
    const res = await cal.events.insert({
      calendarId: opts.calendarId,
      requestBody: {
        summary: `🏖️ ${label} — ${opts.employeeName}`,
        start: { date: opts.startDate },
        end: { date: endStr },
        transparency: 'transparent', // show as free but visible
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error('Google Calendar OOO event error:', err);
    return null;
  }
}

/**
 * Get busy slots from a user's calendar for a given date range.
 * Useful for planner availability view.
 */
export async function getBusySlots(opts: {
  refreshToken: string;
  calendarId: string;
  fromIso: string;
  toIso: string;
}): Promise<Array<{ start: string; end: string }>> {
  try {
    const cal = buildCalendarClient(opts.refreshToken);
    const res = await cal.freebusy.query({
      requestBody: {
        timeMin: opts.fromIso,
        timeMax: opts.toIso,
        items: [{ id: opts.calendarId }],
      },
    });
    const busy = res.data.calendars?.[opts.calendarId]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: b.start!, end: b.end! }));
  } catch (err) {
    console.error('Google Calendar freebusy error:', err);
    return [];
  }
}
