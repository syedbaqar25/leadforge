import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Logger } from './logger';
import { processOutboxJob } from './processors/outbox.processor';
import { processWorkflowJob } from './processors/workflow.processor';

const logger = Logger.child({ service: 'worker' });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
});

async function bootstrap(): Promise<void> {
  logger.info('Leadforge Worker starting...');

  // Try Redis connection gracefully (warn and fallback if Redis is offline during local test)
  try {
    await connection.connect();
    logger.info('Connected to Redis successfully');
  } catch (err: any) {
    logger.warn(
      `Redis connection unavailable (${err.message}). Worker will listen when Redis becomes reachable.`,
    );
  }

  // 1. Outbox Dispatcher Worker
  const outboxWorker = new Worker('outbox-queue', processOutboxJob, {
    connection,
    concurrency: 5,
  });

  outboxWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Outbox job completed');
  });

  outboxWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Outbox job failed');
  });

  // 2. Workflow Execution Worker
  const workflowWorker = new Worker('workflow-queue', processWorkflowJob, {
    connection,
    concurrency: 5,
  });

  workflowWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Workflow job completed');
  });

  workflowWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Workflow job failed');
  });

  logger.info('Leadforge Worker started and listening for jobs on outbox-queue and workflow-queue');

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Shutting down worker gracefully...');
    await outboxWorker.close();
    await workflowWorker.close();
    connection.disconnect();
    logger.info('Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.fatal(err, 'Worker failed to start');
  process.exit(1);
});
