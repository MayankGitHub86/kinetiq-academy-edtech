import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { sequelize } from './config/database';
import { connectRedis } from './config/redis';
import { initializeStorage } from './config/storage';
import { logger } from './utils/logger';
import { models } from './models';
import { Server as SocketIOServer } from 'socket.io';
import { startEmailWorker, startCertificateWorker } from './jobs/queue';

import { validateEnv } from './config/envValidator';

const PORT = parseInt(process.env.PORT || '4000');

const bootstrap = async () => {
  try {
    validateEnv();
    logger.info('🚀 Starting Kinetiq Academy API...');

    // ─── Connect to Redis (non-fatal) ──────────────────────
    await connectRedis();

    // ─── Connect to Database ────────────────────────────────
    // Register models with sequelize
    sequelize.addModels(models);
    const { connectDB } = await import('./config/database');
    await connectDB();

    // ─── Initialize Storage Buckets ─────────────────────────
    try {
      await initializeStorage();
    } catch (err) {
      logger.warn('⚠️ Storage initialization failed (non-fatal):', err);
    }

    // ─── Create HTTP Server ─────────────────────────────────
    const app = createApp();
    const httpServer = http.createServer(app);

    // ─── WebSocket (Socket.IO) ──────────────────────────────
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5500').split(','),
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      logger.debug(`Socket connected: ${socket.id}`);

      socket.on('join:course', (courseId: string) => {
        socket.join(`course:${courseId}`);
        logger.debug(`Socket ${socket.id} joined course:${courseId}`);
      });

      socket.on('join:live', (sessionId: string) => {
        socket.join(`live:${sessionId}`);
      });

      socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
      });
    });

    // Make io available globally
    (global as any).io = io;

    // ─── Start Server ───────────────────────────────────────
    httpServer.listen(PORT, () => {
      logger.info(`✅ Server running on http://localhost:${PORT}`);
      logger.info(`✅ API available at http://localhost:${PORT}/api/v1`);
      logger.info(`✅ Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 Environment: ${process.env.NODE_ENV}`);

      // ─── Start Background Workers ──────────────────────────
      try {
        startEmailWorker();
        startCertificateWorker();
      } catch (workerErr) {
        logger.warn('⚠️ Background workers failed to start (non-fatal):', workerErr);
      }
    });

    // ─── Graceful Shutdown ──────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received - shutting down gracefully...`);
      httpServer.close(async () => {
        await sequelize.close();
        logger.info('✅ Server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Force closing after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

bootstrap();
