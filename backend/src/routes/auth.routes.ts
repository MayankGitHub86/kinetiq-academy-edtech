import { Router } from 'express';
import { body, param } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import rateLimit from 'express-rate-limit';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100'),
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  authController.register
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  authController.login
);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, authController.logout);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refreshToken);

// GET /api/v1/auth/me
router.get('/me', authenticate, authController.getMe);

// GET /api/v1/auth/verify-email/:token
router.get('/verify-email/:token', authController.verifyEmail);

// POST /api/v1/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.forgotPassword
);

// POST /api/v1/auth/reset-password/:token
router.post(
  '/reset-password/:token',
  authLimiter,
  [
    param('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  authController.resetPassword
);

export default router;
