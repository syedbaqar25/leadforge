import { Logger } from './logger';

const logger = Logger.child({ service: 'worker' });

async function bootstrap(): Promise<void> {
  logger.info('Leadforge Worker starting...');
  // Queue processors will be registered here
  logger.info('Leadforge Worker started successfully');
}

bootstrap().catch((err) => {
  logger.fatal(err, 'Worker failed to start');
  process.exit(1);
});
