import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { User, UserRole } from '../models/User';
import { cacheGet } from '../config/redis';

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
  userRole?: UserRole;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : req.cookies?.accessToken;

    if (!token) {
      sendError(res, 'No authentication token provided', 401);
      return;
    }

    const payload = verifyAccessToken(token);

    // Check if token is blacklisted (logout)
    const blacklisted = await cacheGet(`blacklist:${payload.sessionId}`);
    if (blacklisted) {
      sendError(res, 'Token has been revoked', 401);
      return;
    }

    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
      sendError(res, 'User not found or inactive', 401);
      return;
    }

    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 'Token has expired', 401);
    } else if (error.name === 'JsonWebTokenError') {
      sendError(res, 'Invalid token', 401);
    } else {
      sendError(res, 'Authentication failed', 401);
    }
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const user = await User.findByPk(payload.userId);
      if (user && user.isActive) {
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
      }
    } catch {
      // Ignore token errors for optional auth
    }
  }
  next();
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!roles.includes(req.userRole!)) {
      sendError(res, 'Forbidden - insufficient permissions', 403);
      return;
    }
    next();
  };
};

export const requireInstructor = requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN);
export const requireAdmin = requireRole(UserRole.ADMIN);
