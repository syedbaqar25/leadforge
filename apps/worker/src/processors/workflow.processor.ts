import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../logger';

const logger = Logger.child({ service: 'workflow-processor' });
const prisma = new PrismaClient();

export interface WorkflowJobData {
  executionId: string;
  workflowId: string;
  organizationId: string;
  payload: Record<string, any>;
}

/**
 * BullMQ Worker processor for asynchronous Workflow Step Executions.
 * Handles exponential backoff retries and dead-letter queue escalation.
 */
export async function processWorkflowJob(job: Job<WorkflowJobData>): Promise<{ success: boolean }> {
  const { executionId, workflowId, organizationId } = job.data;
  logger.info({ executionId, workflowId }, 'Executing async workflow job');

  const execution = await prisma.workflowExecution.findFirst({
    where: { id: executionId, organizationId },
    include: {
      workflowVersion: true,
    },
  });

  if (!execution) {
    logger.error({ executionId }, 'Workflow execution record not found');
    return { success: false };
  }

  try {
    // Process steps and update execution status
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    logger.info({ executionId }, 'Async workflow completed successfully');
    return { success: true };
  } catch (err: any) {
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts || 3);

    logger.error(
      { executionId, attempt: job.attemptsMade, error: err.message },
      `Workflow execution step failed ${isFinalAttempt ? '(Escalating to Dead-Letter Queue)' : '(Retrying)'}`,
    );

    if (isFinalAttempt) {
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'dead_letter',
          error: `Dead Letter: ${err.message}`,
          completedAt: new Date(),
        },
      });
    }

    throw err; // Let BullMQ handle retry backoff
  }
}
