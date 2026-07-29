'use client';

import { useState, useEffect, type ReactNode } from 'react';

type Tab = 'opvolging' | 'screening' | 'gesprek' | 'gegevens';

interface TabDef {
  key: Tab;
  label: string;
  icon: string;
  badge?: number;
  content: ReactNode;
  visible: boolean;
}

interface Props {
  tabs: TabDef[];
  defaultTab?: Tab;
}

const LS_KEY = 'candidate-detail-tab';

export function CandidateDetailTabs({ tabs, defaultTab }: Props) {
  const visibleTabs = tabs.filter(t => t.visible);
  const [active, setActive] = useState<Tab>(defaultTab ?? visibleTabs[0]?.key ?? 'opvolging');

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as Tab | null;
    if (saved && visibleTabs.some(t => t.key === saved)) {
      setActive(saved);
    }
  }, [visibleTabs]);

  function switchTab(tab: Tab) {
    setActive(tab);
    localStorage.setItem(LS_KEY, tab);
  }

  const activeTab = visibleTabs.find(t => t.key === active) ?? visibleTabs[0];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-[#1e2028] p-1 mb-5 overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active === tab.key
                ? 'bg-[#252732] text-white'
                : 'text-[#9ca3af] hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f7a247] px-1 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="space-y-5">
        {activeTab?.content}
      </div>
    </div>
  );
}
