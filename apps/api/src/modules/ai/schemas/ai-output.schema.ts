import { z } from 'zod';

export const leadAnalysisSchema = z.object({
  qualificationScore: z.number().min(0).max(100),
  summary: z.string().min(10),
  keyPainPoints: z.array(z.string()).min(1),
  buyingIntentIndicators: z.array(z.string()),
  potentialObjections: z.array(z.string()),
  recommendedNextAction: z.string().min(5),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'urgent']),
});

export type LeadAnalysisOutput = z.infer<typeof leadAnalysisSchema>;

export const messageDraftSchema = z.object({
  channel: z.enum(['email', 'whatsapp']),
  subject: z.string().nullable().optional(),
  body: z.string().min(10),
  keyHighlights: z.array(z.string()).default([]),
  callToAction: z.string().min(3),
  estimatedReadSeconds: z.number().min(5).max(300),
});

export type MessageDraftOutput = z.infer<typeof messageDraftSchema>;
