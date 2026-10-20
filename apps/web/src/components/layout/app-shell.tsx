'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Bell, Search } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground font-body">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-16 border-b border-border bg-surface px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 w-96">
            <div className="relative w-full">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="Search leads, deals, or ask AI assistant..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="relative p-2 rounded-md hover:bg-surface-hover text-foreground-secondary hover:text-foreground transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs text-foreground-secondary font-medium">v1.0.0-prod</span>
          </div>
        </header>

        {/* Main scrollable view */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
