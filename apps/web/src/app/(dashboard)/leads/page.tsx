'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { ScoreBadge } from '../../../components/ui/score-badge';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Search, Plus, Download, Sparkles, Phone, Mail, Building, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [bandFilter, setBandFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Lead Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [budget, setBudget] = useState('50000');

  // Fetch leads from API with fallback
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', search, bandFilter],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (bandFilter !== 'all') params.append('scoreBand', bandFilter);
        return await apiRequest(`/leads?${params.toString()}`);
      } catch {
        return {
          data: [
            {
              id: 'lead-1',
              fullName: 'Ananya Deshmukh',
              emailRaw: 'ananya@zenithfintech.io',
              phoneRaw: '+91 98201 44552',
              company: 'Zenith FinTech',
              status: 'qualified',
              score: 92,
              scoreBand: 'hot',
              budgetAmount: 1200000,
              budgetCurrency: 'INR',
              source: 'Website Demo',
              assignedTo: { name: 'Sarah Rep' },
              createdAt: new Date().toISOString(),
            },
            {
              id: 'lead-2',
              fullName: 'Robert Sterling',
              emailRaw: 'r.sterling@sterlingcorp.com',
              phoneRaw: '+1 415 889 2011',
              company: 'Sterling Global',
              status: 'contacted',
              score: 84,
              scoreBand: 'hot',
              budgetAmount: 2500000,
              budgetCurrency: 'INR',
              source: 'Inbound Ingest',
              assignedTo: { name: 'Vikram Manager' },
              createdAt: new Date().toISOString(),
            },
            {
              id: 'lead-3',
              fullName: 'Priya Narayanan',
              emailRaw: 'priya@cloudflow.ai',
              phoneRaw: '+91 97110 32441',
              company: 'Cloudflow Systems',
              status: 'new',
              score: 62,
              scoreBand: 'warm',
              budgetAmount: 450000,
              budgetCurrency: 'INR',
              source: 'Referral',
              assignedTo: null,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'lead-4',
              fullName: 'Daniel Craig',
              emailRaw: 'dcraig@omnimatrix.uk',
              phoneRaw: '+44 20 7946 0912',
              company: 'OmniMatrix UK',
              status: 'nurturing',
              score: 28,
              scoreBand: 'cold',
              budgetAmount: null,
              budgetCurrency: 'INR',
              source: 'Cold List',
              assignedTo: null,
              createdAt: new Date().toISOString(),
            },
          ],
          meta: { total: 4, page: 1, pageSize: 25 },
        };
      }
    },
  });

  // Mutation to create lead
  const createLeadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/leads', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          company,
          phone,
          budgetAmount: Number(budget) || 0,
          source: 'manual_web',
        }),
      });
    },
    onSuccess: () => {
      toast.success('Lead created and qualified successfully!');
      setIsCreateOpen(false);
      setFullName('');
      setEmail('');
      setCompany('');
      setPhone('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create lead');
    },
  });

  // Mutation to qualify lead with AI
  const qualifyLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      return await apiRequest(`/ai/leads/${leadId}/qualify`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast.success(
        `AI Analysis complete: Score ${data.score} (${data.scoreBand.toUpperCase()}). Decision: ${data.qualificationSummary}`,
      );
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'AI Qualification failed');
    },
  });

  const leads = leadsData?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Leads & Intelligence
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Centralized customer profiles with explainable AI multi-factor scoring.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open('/api/v1/leads/export', '_blank');
              toast.info('Exporting sanitized leads CSV...');
            }}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Create Lead
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name, email, company..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground placeholder:text-foreground-tertiary transition-all duration-normal focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        {/* Score Band Filter Pills with Micro-interactions */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
          <span className="text-foreground-secondary text-xs mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
            Band:
          </span>
          {['all', 'hot', 'warm', 'cold'].map((band) => (
            <button
              key={band}
              onClick={() => setBandFilter(band)}
              className={`px-2.5 py-1 rounded-sm text-xs capitalize transition-all duration-fast active:scale-95 hover:-translate-y-0.5 cursor-pointer select-none ${
                bandFilter === band
                  ? 'bg-accent text-white font-medium shadow-xs'
                  : 'bg-surface border border-border text-foreground hover:bg-surface-hover hover:border-border-strong'
              }`}
            >
              {band}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background border-b border-border text-foreground-secondary font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Lead & Company</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">AI Score</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leads.map((lead: any) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-surface-hover/80 hover:translate-x-0.5 transition-all duration-fast"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-foreground">{lead.fullName}</div>
                      <div className="flex items-center gap-1 text-[11px] text-foreground-secondary">
                        <Building className="h-3 w-3" strokeWidth={1.5} />
                        {lead.company || 'Individual'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      {lead.emailRaw && (
                        <div className="flex items-center gap-1 text-foreground-secondary">
                          <Mail className="h-3 w-3" strokeWidth={1.5} />
                          <span>{lead.emailRaw}</span>
                        </div>
                      )}
                      {lead.phoneRaw && (
                        <div className="flex items-center gap-1 text-foreground-secondary">
                          <Phone className="h-3 w-3" strokeWidth={1.5} />
                          <span>{lead.phoneRaw}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <ScoreBadge band={lead.scoreBand} score={lead.score} />
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={lead.status === 'qualified' ? 'success' : 'secondary'}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-foreground">
                      {lead.budgetAmount
                        ? `₹${Number(lead.budgetAmount).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-foreground-secondary">
                      {lead.source || 'Direct'}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => qualifyLeadMutation.mutate(lead.id)}
                        isLoading={qualifyLeadMutation.isPending}
                        title="Run AI Qualification Engine"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                        AI Qualify
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Lead Modal Dialog with Smooth Backdrop & Pop Animations */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-modal-backdrop">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-lg p-6 space-y-5 animate-modal-content">
            <div className="border-b border-border/80 pb-3">
              <h2 className="font-display text-xl font-bold text-foreground">Capture New Lead</h2>
              <p className="text-xs text-foreground-secondary mt-1">
                Enter customer contact details for automatic deduplication and AI scoring.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground transition-all duration-normal focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. vikram@apexlogistics.com"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground transition-all duration-normal focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Apex Cloud Logistics"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98201 44552"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Budget (INR)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/80">
              <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => createLeadMutation.mutate()}
                isLoading={createLeadMutation.isPending}
                disabled={!fullName || !email}
              >
                Save & Score Lead
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
