export type Role = 'owner' | 'admin' | 'sales_manager' | 'salesperson';
export type LeadStatus =
  'new' | 'contacted' | 'qualified' | 'unqualified' | 'nurturing' | 'converted' | 'lost';
export type DealStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'meeting_scheduled'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';
export type TaskType = 'call' | 'meeting' | 'email' | 'demo' | 'follow_up';
export type ScoreBand = 'hot' | 'warm' | 'cold';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'whatsapp';
export type MessageStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'bounced';
export type WorkflowTrigger =
  | 'lead_created'
  | 'score_changed'
  | 'stage_entered'
  | 'reply_received'
  | 'task_overdue'
  | 'deal_won'
  | 'deal_lost'
  | 'timer_expired';
export type CustomFieldType = 'text' | 'number' | 'date' | 'select';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  total?: number;
}
