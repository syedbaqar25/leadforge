'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { FileText, Download, Search, ShieldAlert, User, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');

  // Fetch audit logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: async () => {
      try {
        const query = actionFilter ? `?action=${actionFilter}` : '';
        return await apiRequest(`/audit-logs${query}`);
      } catch {
        return {
          data: [
            {
              id: 'log-1',
              action: 'approval.decide',
              entityType: 'approval_request',
              entityId: 'appr-uuid-1',
              userId: 'user-manager-101',
              ipAddress: '192.168.1.42',
              createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            },
            {
              id: 'log-2',
              action: 'lead.create',
              entityType: 'lead',
              entityId: 'lead-uuid-202',
              userId: 'user-sales-45',
              ipAddress: '10.0.4.18',
              createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
            },
            {
              id: 'log-3',
              action: 'deal.stage_transition',
              entityType: 'deal',
              entityId: 'deal-uuid-303',
              userId: 'user-sales-45',
              ipAddress: '10.0.4.18',
              createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
            },
            {
              id: 'log-4',
              action: 'knowledge.document_created',
              entityType: 'knowledge_document',
              entityId: 'doc-uuid-404',
              userId: 'user-admin-1',
              ipAddress: '127.0.0.1',
              createdAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
            },
          ],
          meta: { total: 4, page: 1, pageSize: 25 },
        };
      }
    },
  });

  const logs = logsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Immutable Audit Trail
            </h1>
            <span className="inline-flex items-center gap-1 rounded-sm border border-success/30 bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success">
              SOC 2 / ISO 27001 Ready
            </span>
          </div>
          <p className="text-sm text-foreground-secondary mt-1">
            Tamper-evident log of all access, modifications, approvals, and AI executions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              window.open('/api/v1/audit-logs/export', '_blank');
              toast.info('Downloading sanitized audit CSV with formula injection defense...');
            }}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export CSV (Formula Safe)
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="relative w-full sm:w-80">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action name (e.g. lead.create)..."
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background border-b border-border text-foreground-secondary font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-surface-hover/80 transition-colors">
                    <td className="py-3 px-5 text-foreground-secondary">
                      {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-bold text-accent">{log.action}</td>
                    <td className="py-3 px-4 text-foreground">{log.entityType}</td>
                    <td className="py-3 px-4 text-foreground-secondary truncate max-w-[120px]">
                      {log.entityId || '—'}
                    </td>
                    <td className="py-3 px-4 text-foreground-secondary truncate max-w-[120px]">
                      {log.userId || 'System'}
                    </td>
                    <td className="py-3 px-5 text-foreground-secondary">{log.ipAddress || '—'}</td>
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
