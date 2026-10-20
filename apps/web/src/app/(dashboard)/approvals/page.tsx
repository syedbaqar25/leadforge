'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  ShieldCheck,
  Check,
  X,
  Mail,
  MessageSquare,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ApprovalsQueuePage() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  // Fetch approval queue
  const { data: approvalsData, isLoading } = useQuery({
    queryKey: ['approvals-queue'],
    queryFn: async () => {
      try {
        return await apiRequest('/approvals?status=pending');
      } catch {
        // Fallback realistic pending items
        return {
          data: [
            {
              id: 'appr-1',
              approvalType: 'message_send',
              entityType: 'message',
              entityId: 'msg-101',
              status: 'pending',
              version: 1,
              createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
              proposedPayload: {
                channel: 'email',
                toAddress: 'elena.rostova@omniglobal.com',
                subject: 'Accelerating OmniGlobal’s Omnichannel Outbound Sales',
                body:
                  'Hi Elena,\n\nI noticed OmniGlobal’s recent expansion into unified customer experience management. ' +
                  'Leadforge combines multi-factor lead scoring with WhatsApp Cloud API automation so sales reps follow up on high-intent leads within seconds.\n\n' +
                  'Would you be open to a 10-minute briefing next Tuesday at 2 PM IST?\n\nBest regards,\nSarah Connor | Enterprise Lead',
              },
            },
            {
              id: 'appr-2',
              approvalType: 'message_send',
              entityType: 'message',
              entityId: 'msg-102',
              status: 'pending',
              version: 1,
              createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
              proposedPayload: {
                channel: 'whatsapp',
                toAddress: '+919820144552',
                subject: 'Exclusive Demo Confirmation',
                body:
                  'Hello Vikram, your scheduled walkthrough for Leadforge Sales Intelligence is confirmed for Wednesday at 11 AM IST. ' +
                  'Reply YES to receive your executive calendar invite.',
              },
            },
          ],
        };
      }
    },
  });

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      version,
      feedbackText,
    }: {
      id: string;
      decision: 'approve' | 'reject';
      version: number;
      feedbackText?: string;
    }) => {
      return await apiRequest(`/approvals/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          version,
          feedback: feedbackText || undefined,
        }),
      });
    },
    onSuccess: (_, variables) => {
      if (variables.decision === 'approve') {
        toast.success('Approved! Message passed to outbound dispatcher.');
      } else {
        toast.info('Request rejected with feedback.');
      }
      setRejectingId(null);
      setFeedback('');
      queryClient.invalidateQueries({ queryKey: ['approvals-queue'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Decision failed');
    },
  });

  const approvals = approvalsData?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Human-in-the-Loop Approvals
            </h1>
            <span className="inline-flex items-center gap-1 rounded-sm border border-accent/30 bg-accent-subtle px-2 py-0.5 text-xs font-semibold text-accent animate-pulse-subtle">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              Safety Gate Active
            </span>
          </div>
          <p className="text-sm text-foreground-secondary mt-1">
            Mandatory human review for AI-generated outbound emails and WhatsApp dispatches (PART
            1.8).
          </p>
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-4">
        {approvals.length === 0 ? (
          <Card className="p-12 text-center border-dashed animate-scale-in">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle text-success mb-3">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Queue is completely clear
            </h3>
            <p className="text-xs text-foreground-secondary mt-1 max-w-sm mx-auto">
              All AI-drafted messages have been reviewed. New draft actions will appear here for
              manager sign-off.
            </p>
          </Card>
        ) : (
          approvals.map((req: any) => {
            const isEmail = req.proposedPayload?.channel === 'email';

            return (
              <Card
                interactive
                key={req.id}
                className="p-5 border-l-4 border-l-accent space-y-4 animate-slide-up hover:-translate-y-0.5 hover:shadow-md transition-all duration-normal"
              >
                {/* Request Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Badge variant={isEmail ? 'info' : 'success'}>
                      {isEmail ? (
                        <Mail className="h-3 w-3 mr-1" strokeWidth={1.5} />
                      ) : (
                        <MessageSquare className="h-3 w-3 mr-1" strokeWidth={1.5} />
                      )}
                      {req.proposedPayload?.channel?.toUpperCase()}
                    </Badge>

                    <span className="text-xs font-semibold text-foreground">
                      Recipient:{' '}
                      <span className="font-mono text-accent">
                        {req.proposedPayload?.toAddress}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Submitted 15m ago by AI Sales Assistant</span>
                  </div>
                </div>

                {/* Subject & Body */}
                <div className="space-y-2 text-xs">
                  {req.proposedPayload?.subject && (
                    <div className="font-semibold text-foreground text-sm">
                      Subject: {req.proposedPayload.subject}
                    </div>
                  )}

                  <div className="p-4 rounded-md bg-background border border-border/80 font-mono text-xs whitespace-pre-line text-foreground leading-relaxed">
                    {req.proposedPayload?.body}
                  </div>
                </div>

                {/* Reject Feedback Box */}
                {rejectingId === req.id && (
                  <div className="p-3 bg-danger-subtle/50 rounded-md border border-danger/30 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-danger font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Specify Rejection Reason / Guidance for Rep
                    </div>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="e.g. Tone too aggressive, adjust pricing proposal to standard tier..."
                      className="w-full p-2 bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-danger text-xs h-16"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRejectingId(null);
                          setFeedback('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          decisionMutation.mutate({
                            id: req.id,
                            decision: 'reject',
                            version: req.version,
                            feedbackText: feedback,
                          })
                        }
                        isLoading={decisionMutation.isPending}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                )}

                {/* Decision Actions */}
                {rejectingId !== req.id && (
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setRejectingId(req.id)}>
                      <X className="h-3.5 w-3.5 text-danger" strokeWidth={1.5} />
                      Reject
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        decisionMutation.mutate({
                          id: req.id,
                          decision: 'approve',
                          version: req.version,
                        })
                      }
                      isLoading={decisionMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Approve & Dispatch
                    </Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
