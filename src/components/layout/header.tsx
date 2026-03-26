'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import type { Notification } from '@/types';

interface HeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ title, breadcrumbs }: HeaderProps) {
  const { name } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-3">
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
