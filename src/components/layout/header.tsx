'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import type { Notification, CandidateStatus } from '@/types';

interface SearchResult {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: CandidateStatus;
  jobTitle?: string | null;
}

const SEARCH_STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: 'Nieuw', CONTACTED: 'Gecontacteerd', PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar', INTERVIEW: 'Gesprek', RESERVE_BANK: 'Reserve',
  HIRED: 'Aangenomen', REJECTED: 'Afgewezen',
};
const SEARCH_STATUS_COLORS: Record<string, string> = {
  NEW_LEAD: 'bg-blue-500/15 text-blue-300', CONTACTED: 'bg-cyan-500/15 text-cyan-300',
  PRE_SCREENING: 'bg-yellow-500/15 text-yellow-300', SCREENING_DONE: 'bg-orange-500/15 text-orange-300',
  INTERVIEW: 'bg-purple-500/15 text-purple-300', RESERVE_BANK: 'bg-teal-500/15 text-teal-300',
  HIRED: 'bg-green-500/15 text-green-300', REJECTED: 'bg-red-500/15 text-red-300',
};

interface HeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ title, breadcrumbs }: HeaderProps) {
  const { name, role } = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSearch = ['ADMIN', 'MANAGER', 'PLANNER'].includes(role);

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Fetch notifications on mount
  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setNotifications(json.data);
      })
      .catch(() => {/* non-fatal */});
  }, []);

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notification-panel]')) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search: debounced fetch
  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(json => { setSearchResults(json.data ?? []); setSearchOpen(true); })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  }, []);

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(val), 300);
  }

  function handleSearchSelect(id: string) {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    router.push(`/dashboard/werving/${id}`);
  }

  // Close search on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleBellClick() {
    setShowNotifications(!showNotifications);
    // Mark all as read when opening
    if (!showNotifications && unreadCount > 0) {
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {/*non-fatal*/});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#363848] bg-[#1e2028]/95 backdrop-blur-sm px-4 lg:px-6">
      {/* Left: title + breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0 pl-10 lg:pl-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <svg className="h-3 w-3 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <span className={i === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-[#9ca3af]'}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-base font-semibold text-white truncate">{title}</h1>
        )}
      </div>

      {/* Right: search + notifications + avatar */}
      <div className="flex items-center gap-3">
        {/* Global search */}
        {canSearch && (
          <div className="relative hidden sm:block" ref={searchRef}>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
                placeholder="Zoek kandidaat…"
                className="w-48 lg:w-64 pl-8 pr-3 py-1.5 rounded-lg border border-[#363848] bg-[#14151b] text-sm text-white placeholder-[#6b7280] focus:border-[#68b0a6] focus:outline-none transition-colors"
              />
              {searchLoading && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-[#68b0a6] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Search results dropdown */}
            {searchOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#363848] bg-[#252732] shadow-xl z-50">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-[#9ca3af]">
                    Geen resultaten voor &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto py-1">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSearchSelect(r.id)}
                        className="w-full px-4 py-2.5 text-left hover:bg-[#1e2028] transition-colors flex items-start gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{r.name}</span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SEARCH_STATUS_COLORS[r.status] ?? 'bg-[#363848] text-[#9ca3af]'}`}>
                              {SEARCH_STATUS_LABELS[r.status] ?? r.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#9ca3af]">
                            {r.phone && <span>{r.phone}</span>}
                            {r.phone && r.email && <span>·</span>}
                            <span className="truncate">{r.email}</span>
                          </div>
                          {r.jobTitle && (
                            <div className="text-[10px] text-[#6b7280] mt-0.5">{r.jobTitle}</div>
                          )}
                        </div>
                        <svg className="h-4 w-4 text-[#363848] shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notification bell */}
        <div className="relative" data-notification-panel>
          <button
            onClick={handleBellClick}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#252732] hover:text-white transition-colors"
            aria-label="Meldingen"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#f7a247] text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-10 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#363848] bg-[#252732] shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#363848]">
                <span className="text-sm font-medium text-white">Meldingen</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-[#68b0a6]">{unreadCount} ongelezen</span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[#9ca3af]">
                  Geen meldingen
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-[#363848] last:border-0 ${
                        !n.isRead ? 'bg-[#68b0a6]/5' : ''
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{n.title}</div>
                      <div className="text-xs text-[#9ca3af] mt-0.5">{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#68b0a6]/20 text-xs font-bold text-[#68b0a6]">
          {initials}
        </div>
      </div>
    </header>
  );
}
