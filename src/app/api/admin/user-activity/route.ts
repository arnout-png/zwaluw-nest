import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface UserActivityMetrics {
  userId: string;
  name: string;
  email: string;
  role: string;
  loginCount: number;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  activeDays: number;
  totalActiveMinutes: number;
  avgSessionMinutes: number;
  lastSeen: string | null;
  dailyActivity: { date: string; actions: number; minutes: number }[];
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });

  const days = Number(new URL(request.url).searchParams.get('days') || 30);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Fetch all audit logs in period
  const { data: logs } = await supabaseAdmin
    .from('AuditLog')
    .select('userId, action, createdAt')
    .gte('createdAt', since)
    .not('userId', 'is', null)
    .order('createdAt', { ascending: true });

  if (!logs?.length) return NextResponse.json({ data: [], period: days });

  // Fetch all users
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, name, email, role')
    .eq('isActive', true);

  const userMap = Object.fromEntries(
    ((users ?? []) as { id: string; name: string; email: string; role: string }[]).map(u => [u.id, u])
  );

  // Group logs by user
  const byUser = new Map<string, { action: string; createdAt: string }[]>();
  for (const log of logs as { userId: string; action: string; createdAt: string }[]) {
    if (!byUser.has(log.userId)) byUser.set(log.userId, []);
    byUser.get(log.userId)!.push({ action: log.action, createdAt: log.createdAt });
  }

  const results: UserActivityMetrics[] = [];

  for (const [userId, userLogs] of byUser) {
    const user = userMap[userId];
    if (!user) continue;

    // Action breakdown
    const actionBreakdown: Record<string, number> = {};
    for (const log of userLogs) {
      actionBreakdown[log.action] = (actionBreakdown[log.action] ?? 0) + 1;
    }

    const loginCount = actionBreakdown['LOGIN'] ?? 0;
    const totalActions = userLogs.length;

    // Calculate sessions: a session starts at LOGIN and ends at the last action
    // before a gap of >30 minutes or the next LOGIN
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min inactivity = session end
    let totalActiveMs = 0;
    let sessionCount = 0;
    let sessionStart: number | null = null;
    let lastActionTime: number | null = null;

    for (const log of userLogs) {
      const t = new Date(log.createdAt).getTime();

      if (sessionStart === null) {
        // Start new session
        sessionStart = t;
        lastActionTime = t;
        sessionCount++;
      } else if (t - lastActionTime! > SESSION_GAP_MS) {
        // Gap too large — close previous session, start new one
        totalActiveMs += lastActionTime! - sessionStart;
        sessionStart = t;
        lastActionTime = t;
        sessionCount++;
      } else {
        lastActionTime = t;
      }
    }
    // Close last session
    if (sessionStart !== null && lastActionTime !== null) {
      totalActiveMs += lastActionTime - sessionStart;
    }

    // Add minimum 1 minute per session (single-action sessions show as 0ms)
    const totalActiveMinutes = Math.max(Math.round(totalActiveMs / 60000), sessionCount);
    const avgSessionMinutes = sessionCount > 0 ? Math.round(totalActiveMinutes / sessionCount) : 0;

    // Active days
    const activeDaysSet = new Set(userLogs.map(l => l.createdAt.split('T')[0]));

    // Daily activity breakdown
    const dailyMap = new Map<string, { actions: number; firstAction: number; lastAction: number }>();
    for (const log of userLogs) {
      const day = log.createdAt.split('T')[0];
      const t = new Date(log.createdAt).getTime();
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { actions: 0, firstAction: t, lastAction: t });
      }
      const d = dailyMap.get(day)!;
      d.actions++;
      if (t < d.firstAction) d.firstAction = t;
      if (t > d.lastAction) d.lastAction = t;
    }

    const dailyActivity = [...dailyMap.entries()]
      .map(([date, d]) => ({
        date,
        actions: d.actions,
        minutes: Math.max(1, Math.round((d.lastAction - d.firstAction) / 60000)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const lastSeen = userLogs.length > 0 ? userLogs[userLogs.length - 1].createdAt : null;

    results.push({
      userId,
      name: user.name,
      email: user.email,
      role: user.role,
      loginCount,
      totalActions,
      actionBreakdown,
      activeDays: activeDaysSet.size,
      totalActiveMinutes,
      avgSessionMinutes,
      lastSeen,
      dailyActivity,
    });
  }

  // Sort by total actions descending
  results.sort((a, b) => b.totalActions - a.totalActions);

  return NextResponse.json({ data: results, period: days });
}
