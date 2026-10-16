import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: Record<string, any>;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Record<string, any>
): Response => {
  const response: ApiResponse<T> = { success: true, data, message };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  error: string,
  statusCode = 400,
  message?: string
): Response => {
  return res.status(statusCode).json({
    success: false,
    error,
    message: message || error,
  });
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created'): Response => {
  return sendSuccess(res, data, message, 201);
};

export const paginationMeta = (
  total: number,
  page: number,
  limit: number
) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});
