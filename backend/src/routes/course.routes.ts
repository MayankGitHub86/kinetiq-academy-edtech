import { Router } from 'express';
import { body, param } from 'express-validator';
import * as courseController from '../controllers/course.controller';
import { authenticate, optionalAuth, requireInstructor } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// GET /api/v1/courses - Public
router.get('/', optionalAuth, courseController.getCourses);

// GET /api/v1/courses/categories - Public
router.get('/categories', courseController.getCategories);

// GET /api/v1/courses/:slug - Public (with optional auth for enrollment status)
router.get('/:slug', optionalAuth, courseController.getCourse);

// POST /api/v1/courses - Instructor/Admin only
router.post(
  '/',
  authenticate,
  requireInstructor,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('shortDescription').trim().notEmpty().withMessage('Short description required'),
  ],
  validate,
  courseController.createCourse
);

// PATCH /api/v1/courses/:id - Instructor/Admin only
router.patch(
  '/:id',
  authenticate,
  requireInstructor,
  courseController.updateCourse
);

// POST /api/v1/courses/:id/publish - Instructor/Admin only
router.post(
  '/:id/publish',
  authenticate,
  requireInstructor,
  courseController.publishCourse
);

// POST /api/v1/courses/:id/enroll - Student
router.post('/:id/enroll', authenticate, courseController.enrollInCourse);

// POST /api/v1/courses/:id/review - Student
router.post(
  '/:id/review',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  courseController.submitReview
);

// GET /api/v1/courses/:courseId/lessons/:lessonId
router.get(
  '/:courseId/lessons/:lessonId',
  optionalAuth,
  courseController.getLesson
);

// PATCH /api/v1/courses/:courseId/lessons/:lessonId/progress
router.patch(
  '/:courseId/lessons/:lessonId/progress',
  authenticate,
  courseController.updateProgress
);

export default router;
