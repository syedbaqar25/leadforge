'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Building2, Users, Key, Shield, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const teamMembers = [
    { name: 'Sayed Baqar Abbas', email: 'admin@leadforge.dev', role: 'owner', status: 'active' },
    {
      name: 'Vikram Malhotra',
      email: 'v.malhotra@leadforge.dev',
      role: 'sales_manager',
      status: 'active',
    },
    {
      name: 'Sarah Connor',
      email: 's.connor@leadforge.dev',
      role: 'salesperson',
      status: 'active',
    },
  ];

  const apiKeys = [
    {
      name: 'Production CRM Webhook Key',
      prefix: 'lf_live_9a7b',
      scopes: ['lead:create', 'lead:read:own'],
      createdAt: '2026-10-18',
    },
    {
      name: 'Inbound Form Integration',
      prefix: 'lf_live_3c2d',
      scopes: ['lead:create'],
      createdAt: '2026-10-19',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-border/80 pb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Workspace Settings
        </h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Manage organization preferences, role-based team permissions, and API credentials.
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Organization Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <CardTitle className="text-base">Organization Profile</CardTitle>
            </div>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Default localization and currency formatting for pipeline calculations
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  readOnly
                  value="Acme Corporation"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Workspace Slug</label>
                <input
                  type="text"
                  readOnly
                  value="acme-corp"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Default Currency</label>
                <input
                  type="text"
                  readOnly
                  value="INR (₹) — Indian Rupee"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Default Timezone</label>
                <input
                  type="text"
                  readOnly
                  value="Asia/Kolkata (IST +5:30)"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-border/60">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span className="font-semibold text-foreground">AI Sales Automation Engine</span>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <CardTitle className="text-base">Team Members & RBAC</CardTitle>
              </div>
              <p className="text-xs text-foreground-secondary mt-0.5">
                Role-based access permissions enforcing tenant isolation (PART 1.2)
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Invite team modal')}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Invite Member
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-background border-b border-border text-foreground-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-5">Member</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {teamMembers.map((m) => (
                    <tr key={m.email} className="hover:bg-surface-hover/80 transition-colors">
                      <td className="py-3 px-5">
                        <div className="font-semibold text-foreground">{m.name}</div>
                        <div className="text-[11px] text-foreground-secondary">{m.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">
                          {m.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <Badge variant="success">{m.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <CardTitle className="text-base">API Keys & Inbound Integrations</CardTitle>
              </div>
              <p className="text-xs text-foreground-secondary mt-0.5">
                Scoped API tokens hashed at rest for webhook ingestion
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => toast.info('Generating new API key...')}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Generate API Key
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60 text-xs">
              {apiKeys.map((k) => (
                <div
                  key={k.prefix}
                  className="p-4 flex items-center justify-between hover:bg-surface-hover/80 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-foreground">{k.name}</div>
                    <div className="text-[11px] text-foreground-secondary font-mono mt-0.5">
                      Prefix: <span className="font-bold text-accent">{k.prefix}••••••••••••</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded-sm bg-background border border-border text-[10px] font-mono text-foreground-secondary"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
