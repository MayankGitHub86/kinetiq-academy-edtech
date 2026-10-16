import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { verifyAccessToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  const tokens = await authService.register(req.body);
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  sendCreated(res, { accessToken: tokens.accessToken, user: tokens.user }, 'Registration successful');
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const tokens = await authService.login(req.body);
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  sendSuccess(res, { accessToken: tokens.accessToken, user: tokens.user }, 'Login successful');
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const token = req.headers.authorization?.slice(7) || req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      await authService.logout(payload.sessionId);
    } catch { /* ignore */ }
  }
  res.clearCookie('refreshToken');
  sendSuccess(res, null, 'Logged out successfully');
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) {
    sendError(res, 'No refresh token provided', 401);
    return;
  }
  const tokens = await authService.refreshTokens(token);
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  sendSuccess(res, { accessToken: tokens.accessToken, user: tokens.user });
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  await authService.verifyEmail(req.params.token as string);
  sendSuccess(res, null, 'Email verified successfully');
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  await authService.requestPasswordReset(req.body.email);
  sendSuccess(res, null, 'If this email exists, a reset link has been sent');
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  await authService.resetPassword(req.params.token as string, req.body.password);
  sendSuccess(res, null, 'Password reset successfully');
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  sendSuccess(res, req.user!.toSafeJSON());
};
