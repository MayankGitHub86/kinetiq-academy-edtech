import Redis from 'ioredis';
import { logger } from '../utils/logger';

const {
  REDIS_HOST = 'localhost',
  REDIS_PORT = '6379',
} = process.env;

export let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: parseInt(REDIS_PORT),
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redisClient.on('connect', () => logger.info('✅ Redis connected'));
    redisClient.on('error', (err) => logger.warn('⚠️ Redis error (non-fatal):', err.message));
    redisClient.on('close', () => logger.warn('⚠️ Redis connection closed'));
  }
  return redisClient;
};

// Cache helper with fallback
export const cacheGet = async (key: string): Promise<string | null> => {
  try {
    const client = getRedisClient();
    return await client.get(key);
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: string, ttlSeconds = 3600): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, value);
  } catch {
    // Redis unavailable - continue without caching
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch {
    // ignore
  }
};

export const connectRedis = async (): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.connect();
  } catch (error) {
    logger.warn('⚠️ Redis unavailable - continuing without caching');
  }
};
