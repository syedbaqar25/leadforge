'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Kanban,
  ShieldCheck,
  BookOpen,
  BarChart3,
  FileText,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/cn';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads & Scoring', icon: Users },
  { href: '/deals', label: 'Pipeline & Deals', icon: Kanban },
  { href: '/approvals', label: 'Approvals Queue', icon: ShieldCheck },
  { href: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { href: '/analytics', label: 'Analytics & Funnel', icon: BarChart3 },
  { href: '/audit-logs', label: 'Audit Trail', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-surface flex flex-col justify-between min-h-screen select-none">
      <div>
        {/* Brand header */}
        <div className="p-6 border-b border-border/80 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white font-display font-bold text-lg shadow-sm">
              L
            </span>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg tracking-tight text-foreground">
                Leadforge
              </span>
              <span className="text-[10px] tracking-wider uppercase text-foreground-secondary font-medium">
                Sales Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Tenant context pill */}
        <div className="px-4 py-3 mx-4 my-3 rounded-md bg-background border border-border/60 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
              Acme Corporation
            </span>
            <span className="text-[10px] text-foreground-secondary">Production Workspace</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-sm bg-success-subtle text-success border border-success/30 px-1.5 py-0.5 text-[10px] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-subtle" />
            Live
          </span>
        </div>

        {/* Navigation list */}
        <nav className="px-3 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-fast active:scale-[0.98]',
                  isActive
                    ? 'bg-accent-subtle text-accent font-semibold border-l-2 border-accent'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-surface-hover',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-fast group-hover:translate-x-0.5',
                    isActive ? 'text-accent' : 'text-foreground-secondary',
                  )}
                  strokeWidth={1.5}
                />
                <span className="transition-transform duration-fast group-hover:translate-x-0.5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer user profile */}
      <div className="p-4 border-t border-border/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-border-strong text-foreground font-semibold flex items-center justify-center text-xs">
            SB
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
              Sayed Baqar
            </span>
            <span className="text-[10px] text-foreground-secondary">Workspace Admin</span>
          </div>
        </div>
        <div
          title="AI Engine Active"
          className="flex items-center gap-1 text-[11px] text-accent font-medium"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        </div>
      </div>
    </aside>
  );
}
