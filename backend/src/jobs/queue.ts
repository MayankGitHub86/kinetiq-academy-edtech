import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { logger } from '../utils/logger';
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail, sendEnrollmentConfirmation, sendCourseCompletionEmail, sendPaymentReceipt, sendLiveSessionReminder } from '../utils/email';
import { certificateService } from '../services/certificate.service';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// ─── Queues ───────────────────────────────────────────────────────────────────

export const emailQueue = new Queue('email', { connection });
export const certificateQueue = new Queue('certificate', { connection });
export const analyticsQueue = new Queue('analytics', { connection });
export const notificationQueue = new Queue('notification', { connection });

// ─── Job Type Definitions ──────────────────────────────────────────────────────

export type EmailJobData =
  | { type: 'welcome'; to: string; firstName: string }
  | { type: 'verification'; to: string; firstName: string; token: string }
  | { type: 'passwordReset'; to: string; firstName: string; token: string }
  | { type: 'enrollment'; to: string; firstName: string; courseTitle: string; courseSlug: string }
  | { type: 'completion'; to: string; firstName: string; courseTitle: string; certificateUrl?: string }
  | { type: 'receipt'; to: string; firstName: string; courseTitle: string; amount: number; currency: string; orderId: string }
  | { type: 'liveReminder'; to: string; firstName: string; sessionTitle: string; scheduledAt: string; joinUrl: string };

export type CertificateJobData = {
  userId: string;
  courseId: string;
};

// ─── Email Worker ──────────────────────────────────────────────────────────────

export const startEmailWorker = () => {
  const worker = new Worker<EmailJobData>(
    'email',
    async (job: Job<EmailJobData>) => {
      const { type } = job.data;
      switch (type) {
        case 'welcome':
          await sendWelcomeEmail(job.data.to, job.data.firstName);
          break;
        case 'verification':
          await sendVerificationEmail(job.data.to, job.data.firstName, job.data.token);
          break;
        case 'passwordReset':
          await sendPasswordResetEmail(job.data.to, job.data.firstName, job.data.token);
          break;
        case 'enrollment':
          await sendEnrollmentConfirmation(job.data.to, job.data.firstName, job.data.courseTitle, job.data.courseSlug);
          break;
        case 'completion':
          await sendCourseCompletionEmail(job.data.to, job.data.firstName, job.data.courseTitle, job.data.certificateUrl);
          break;
        case 'receipt':
          await sendPaymentReceipt(job.data.to, job.data.firstName, job.data.courseTitle, job.data.amount, job.data.currency, job.data.orderId);
          break;
        case 'liveReminder':
          await sendLiveSessionReminder(job.data.to, job.data.firstName, job.data.sessionTitle, new Date(job.data.scheduledAt), job.data.joinUrl);
          break;
        default:
          logger.warn(`Unknown email job type: ${(job.data as any).type}`);
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => logger.debug(`Email job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Email job ${job?.id} failed:`, err.message));

  logger.info('📮 Email worker started');
  return worker;
};

// ─── Certificate Worker ────────────────────────────────────────────────────────

export const startCertificateWorker = () => {
  const worker = new Worker<CertificateJobData>(
    'certificate',
    async (job: Job<CertificateJobData>) => {
      const { userId, courseId } = job.data;
      await certificateService.checkAndIssueCertificate(userId, courseId);
    },
    { connection, concurrency: 2 }
  );

  worker.on('completed', (job) => logger.debug(`Certificate job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Certificate job ${job?.id} failed:`, err.message));

  logger.info('🏆 Certificate worker started');
  return worker;
};

// ─── Helper: Queue email jobs ──────────────────────────────────────────────────

export const queueEmail = async (data: EmailJobData): Promise<void> => {
  try {
    await emailQueue.add(data.type, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  } catch (err) {
    logger.error('Failed to queue email job:', err);
    // Fall back to direct send
    switch (data.type) {
      case 'welcome': await sendWelcomeEmail(data.to, data.firstName).catch(() => {}); break;
      case 'enrollment': await sendEnrollmentConfirmation(data.to, data.firstName, data.courseTitle, data.courseSlug).catch(() => {}); break;
    }
  }
};

export const queueCertificate = async (userId: string, courseId: string): Promise<void> => {
  try {
    await certificateQueue.add('issue', { userId, courseId }, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 2000 },
      jobId: `cert:${userId}:${courseId}`, // Deduplicate
      removeOnComplete: 50,
    });
  } catch (err) {
    logger.error('Failed to queue certificate job:', err);
  }
};
