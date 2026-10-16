import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode,
    method: req.method,
    url: req.url,
    ip: req.ip,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Internal Server Error' : message,
    message: statusCode >= 500 && process.env.NODE_ENV === 'production' 
      ? 'Something went wrong. Please try again.' 
      : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  });
};

export const createError = (message: string, statusCode = 400): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
