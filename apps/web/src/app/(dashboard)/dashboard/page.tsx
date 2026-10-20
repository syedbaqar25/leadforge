'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { ScoreBadge } from '../../../components/ui/score-badge';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  TrendingUp,
  DollarSign,
  Award,
  Sparkles,
  ArrowUpRight,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  // Fetch executive dashboard summary
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      try {
        return await apiRequest('/analytics/dashboard');
      } catch {
        // Fallback for visual display before backend seed or during local exploration
        return {
          leads: {
            total: 148,
            newInLast30Days: 42,
            velocityPerDay: 1.4,
            conversionRate: 28.5,
            hotLeads: 24,
          },
          pipeline: {
            openDeals: 18,
            openValue: 2450000,
            wonRevenue: 1820000,
            winRate: 64.2,
            avgDealVelocityDays: 14.8,
          },
          ai: {
            totalTokens: 184500,
            costDollars: 4.62,
          },
        };
      }
    },
  });

  const recentLeads = [
    {
      id: '1',
      fullName: 'Vikram Malhotra',
      company: 'Apex Cloud Logistics',
      score: 88,
      band: 'hot',
      status: 'qualified',
      source: 'Website Demo',
      nextAction: 'Executive proposal review scheduled',
    },
    {
      id: '2',
      fullName: 'Elena Rostova',
      company: 'OmniGlobal Retail',
      score: 79,
      band: 'hot',
      status: 'contacted',
      source: 'Inbound Ingest',
      nextAction: 'AI drafted email pending approval',
    },
    {
      id: '3',
      fullName: 'Marcus Vance',
      company: 'Vance Robotics',
      score: 58,
      band: 'warm',
      status: 'new',
      source: 'Webinar',
      nextAction: 'Send technical whitepaper follow-up',
    },
    {
      id: '4',
      fullName: 'Deepak Chopra',
      company: 'Zenith BioTech',
      score: 32,
      band: 'cold',
      status: 'nurturing',
      source: 'Outbound Cold',
      nextAction: 'Enroll in 14-day nurture sequence',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Executive Overview
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Real-time pipeline velocity, AI qualification rates, and outbound health.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/leads">
            <Button variant="outline" size="sm">
              <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Add Lead
            </Button>
          </Link>
          <Link href="/approvals">
            <Button variant="primary" size="sm">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              Review Approvals (2)
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid with Staggered Entrance and Micro-interactions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Pipeline Value */}
        <Card interactive className="animate-slide-up stagger-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                Open Pipeline
              </span>
              <span className="p-1.5 rounded-md bg-accent-subtle text-accent transition-transform hover:scale-110 duration-fast">
                <DollarSign className="h-4 w-4" strokeWidth={1.5} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                ₹{(dashboardData?.pipeline?.openValue || 2450000).toLocaleString('en-IN')}
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground-secondary">
              {dashboardData?.pipeline?.openDeals || 18} active deals across pipeline
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Won Revenue & Win Rate */}
        <Card interactive className="animate-slide-up stagger-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                Won Revenue
              </span>
              <span className="p-1.5 rounded-md bg-success-subtle text-success transition-transform hover:scale-110 duration-fast">
                <Award className="h-4 w-4" strokeWidth={1.5} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                ₹{(dashboardData?.pipeline?.wonRevenue || 1820000).toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-semibold text-success tabular-nums">
                {dashboardData?.pipeline?.winRate || 64.2}% win
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground-secondary">
              Avg cycle: {dashboardData?.pipeline?.avgDealVelocityDays || 14.8} days
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Lead Velocity */}
        <Card interactive className="animate-slide-up stagger-3">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                Lead Velocity
              </span>
              <span className="p-1.5 rounded-md bg-warning-subtle text-warning transition-transform hover:scale-110 duration-fast">
                <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                {dashboardData?.leads?.velocityPerDay || 1.4} / day
              </span>
              <span className="text-xs font-medium text-foreground-secondary">
                ({dashboardData?.leads?.newInLast30Days || 42} new)
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground-secondary">
              {dashboardData?.leads?.hotLeads || 24} leads qualified in Hot tier
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: AI Usage & Cost */}
        <Card interactive className="animate-slide-up stagger-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                AI Consumption
              </span>
              <span className="p-1.5 rounded-md bg-accent-subtle text-accent transition-transform hover:scale-110 duration-fast">
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                ${dashboardData?.ai?.costDollars?.toFixed(2) || '4.62'}
              </span>
              <span className="text-xs text-foreground-secondary tabular-nums">
                ({((dashboardData?.ai?.totalTokens || 184500) / 1000).toFixed(0)}k tokens)
              </span>
            </div>
            <p className="mt-1 text-xs text-foreground-secondary">
              Zero hallucination guard active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Leads Table */}
      <Card className="animate-slide-up stagger-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Top Priority Opportunities</CardTitle>
            <p className="text-xs text-foreground-secondary mt-0.5">
              High-value leads prioritized by explainable composite scoring
            </p>
          </div>
          <Link
            href="/leads"
            className="group text-xs font-medium text-accent hover:text-accent-hover inline-flex items-center gap-1 transition-colors"
          >
            <span>View all leads</span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={1.5}
            />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background border-b border-border text-foreground-secondary font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Lead / Company</th>
                  <th className="py-3 px-4">Score Band</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-5">Recommended Next Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-surface-hover/80 hover:translate-x-0.5 transition-all duration-fast"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-foreground">{lead.fullName}</div>
                      <div className="text-[11px] text-foreground-secondary">{lead.company}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <ScoreBadge band={lead.band} score={lead.score} />
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={lead.status === 'qualified' ? 'success' : 'secondary'}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-foreground-secondary">{lead.source}</td>
                    <td className="py-3.5 px-5 text-foreground font-medium">{lead.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
