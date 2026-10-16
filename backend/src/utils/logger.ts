import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { NODE_ENV = 'development' } = process.env;

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    silent: NODE_ENV === 'test',
  }),
];

if (NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
      format: logFormat,
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  transports,
});
