import { z } from 'zod';
import { logger } from '../utils/logger';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432'),
  DB_NAME: z.string().default('kinetiq_academy'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string(),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
});

export const validateEnv = (): void => {
  try {
    envSchema.parse(process.env);
    logger.info('✅ Environment configuration validated successfully.');
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
      logger.error(`❌ CRITICAL: Environment validation failed:\n${missingVars}`);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    } else {
      logger.error('❌ Unknown error during env validation', error);
    }
  }
};
