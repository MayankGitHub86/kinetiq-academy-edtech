import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/v1/users/me
router.get('/me', userController.getProfile);

// PATCH /api/v1/users/me
router.patch('/me', userController.updateProfile);

// GET /api/v1/users/dashboard
router.get('/dashboard', userController.getDashboard);

// GET /api/v1/users/courses - enrolled courses
router.get('/courses', userController.getEnrolledCourses);

// GET /api/v1/users/notifications
router.get('/notifications', userController.getNotifications);

// PATCH /api/v1/users/notifications/:id/read
router.patch('/notifications/:id/read', userController.markNotificationRead);

// POST /api/v1/users/notifications/read-all
router.post('/notifications/read-all', userController.markAllNotificationsRead);

// POST /api/v1/users/onboarding
router.post('/onboarding', userController.completeOnboarding);

// POST /api/v1/users/change-password
router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  userController.changePassword
);

// GET /api/v1/users/certificates
router.get('/certificates', userController.getCertificates);

export default router;
