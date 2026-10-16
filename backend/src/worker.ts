import 'dotenv/config';
import { logger } from './utils/logger';
import { startEmailWorker, startCertificateWorker } from './jobs/queue';
import { connectRedis } from './config/redis';

const startWorkers = async () => {
  logger.info('⚙️ Starting standalone BullMQ worker process...');
  await connectRedis();

  try {
    startEmailWorker();
    startCertificateWorker();
    logger.info('✅ BullMQ email and certificate workers are running.');
  } catch (err) {
    logger.error('❌ Failed to start workers:', err);
    process.exit(1);
  }
};

startWorkers();
