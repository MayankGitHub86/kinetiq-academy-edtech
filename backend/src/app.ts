import 'express-async-errors';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { errorHandler, notFound } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth.routes';
import courseRoutes from './routes/course.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import adminRoutes from './routes/admin.routes';
import liveRoutes from './routes/live.routes';
import analyticsRoutes from './routes/analytics.routes';
import path from 'path';
import onboardingRoutes from './routes/onboarding.routes';
import paymentRoutes from './routes/payment.routes';
import quizRoutes from './routes/quiz.routes';
import aiRoutes from './ai/ai.routes';
import aiContentRoutes from './routes/aiContent.routes';
import learningProjectRoutes from './routes/learningProject.routes';

export const createApp = (): Application => {
  const app = express();

  // ─── Security ──────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ─── CORS ──────────────────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500').split(',');
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // ─── Body Parsing ──────────────────────────────────────────
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ─── Compression ───────────────────────────────────────────
  app.use(compression());

  // ─── Logging ───────────────────────────────────────────────
  app.use(morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
    skip: (req) => req.url === '/health',
  }));

  // ─── Global Rate Limiting ──────────────────────────────────
  app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.url === '/health',
  }));

  // ─── Trust Proxy ───────────────────────────────────────────
  app.set('trust proxy', 1);

  // ─── Health Check ──────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    let dbStatus = 'ok';
    let redisStatus = 'ok';

    try {
      const { sequelize } = await import('./config/database');
      await sequelize.authenticate();
    } catch {
      dbStatus = 'disconnected';
    }

    try {
      const { redisClient } = await import('./config/redis');
      if (!redisClient || redisClient.status !== 'ready') {
        redisStatus = 'unavailable';
      }
    } catch {
      redisStatus = 'unavailable';
    }

    const isHealthy = dbStatus === 'ok';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      service: 'Kinetiq Academy API',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  });

  // ─── API Routes ────────────────────────────────────────────
  const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/courses`, courseRoutes);
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/upload`, uploadRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/live`, liveRoutes);
  app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
  app.use(`${API_PREFIX}/onboarding`, onboardingRoutes);
  app.use(`${API_PREFIX}/payments`, paymentRoutes);
  // Static files for educational media, videos, and thumbnails
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Accept-Ranges', 'bytes');
    },
  }));

  app.use(`${API_PREFIX}/quiz`, quizRoutes);
  app.use(`${API_PREFIX}/ai`, aiContentRoutes);
  app.use(`${API_PREFIX}/ai`, aiRoutes);
  app.use(`${API_PREFIX}/learning-projects`, learningProjectRoutes);

  // ─── API Info ──────────────────────────────────────────────
  app.get(`${API_PREFIX}`, (req, res) => {
    res.json({
      name: 'Kinetiq Academy API',
      version: 'v1',
      endpoints: {
        auth: `${API_PREFIX}/auth`,
        courses: `${API_PREFIX}/courses`,
        users: `${API_PREFIX}/users`,
        upload: `${API_PREFIX}/upload`,
        admin: `${API_PREFIX}/admin`,
        live: `${API_PREFIX}/live`,
        analytics: `${API_PREFIX}/analytics`,
        onboarding: `${API_PREFIX}/onboarding`,
        payments: `${API_PREFIX}/payments`,
        quiz: `${API_PREFIX}/quiz`,
        ai: `${API_PREFIX}/ai`,
      },
    });
  });

  // ─── Error Handling ────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
