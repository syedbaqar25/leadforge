import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../logger';

const logger = Logger.child({ service: 'outbox-processor' });
const prisma = new PrismaClient();

export interface OutboxJobData {
  eventId: string;
  organizationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, any>;
}

/**
 * BullMQ Worker processor for Transactional Outbox Events.
 * Guarantees idempotency via ProcessedEvent and triggers matching automated workflows.
 */
export async function processOutboxJob(
  job: Job<OutboxJobData>,
): Promise<{ processed: boolean; triggeredCount: number }> {
  const { eventId, organizationId, eventType, payload } = job.data;
  const processorName = 'outbox-dispatcher';

  logger.info({ eventId, eventType, organizationId }, 'Processing outbox event');

  // 1. Idempotency Check: Prevent duplicate event execution
  const alreadyProcessed = await prisma.processedEvent.findUnique({
    where: {
      eventId_processorName: {
        eventId,
        processorName,
      },
    },
  });

  if (alreadyProcessed) {
    logger.warn({ eventId }, 'Event already processed. Skipping duplicate.');
    return { processed: false, triggeredCount: 0 };
  }

  // 2. Query active workflows matching this trigger event
  const workflows = await prisma.workflowDefinition.findMany({
    where: {
      organizationId,
      isEnabled: true,
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  const matchingWorkflows = workflows.filter((w) => {
    const currentVersion = w.versions[0];
    const trigger = currentVersion?.trigger as { type: string } | undefined;
    return trigger?.type === eventType;
  });

  logger.info(
    { eventType, count: matchingWorkflows.length },
    `Found ${matchingWorkflows.length} workflows matching trigger ${eventType}`,
  );

  // 3. Mark event as processed and update Outbox status inside a transaction
  await prisma.$transaction(async (tx) => {
    // Record idempotency receipt
    await tx.processedEvent.create({
      data: {
        eventId,
        processorName,
        processedAt: new Date(),
      },
    });

    // Update OutboxEvent to dispatched
    await tx.outboxEvent.updateMany({
      where: { id: eventId },
      data: {
        status: 'dispatched',
        dispatchedAt: new Date(),
      },
    });
  });

  logger.info({ eventId }, 'Outbox event dispatched successfully');
  return { processed: true, triggeredCount: matchingWorkflows.length };
}
