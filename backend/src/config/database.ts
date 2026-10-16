import 'dotenv/config';
import { Sequelize } from 'sequelize-typescript';
import { logger } from '../utils/logger';

const {
  DB_HOST = 'localhost',
  DB_PORT = '6868',
  DB_NAME = 'kinetiq_academy',
  DB_USER = 'blinkpostuser',
  DB_PASSWORD = 'blinkpostpassword',
  DB_POOL_MAX = '20',
  DB_POOL_MIN = '2',
  NODE_ENV = 'development',
} = process.env;

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: DB_HOST,
  port: parseInt(DB_PORT),
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  logging: NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: parseInt(DB_POOL_MAX),
    min: parseInt(DB_POOL_MIN),
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
    paranoid: true, // soft deletes
  },
});

export const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL connected successfully');
    await sequelize.sync({ alter: false }); // Never auto-alter - manage schema via migrations/scripts
    logger.info('✅ Database models synchronized');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};
