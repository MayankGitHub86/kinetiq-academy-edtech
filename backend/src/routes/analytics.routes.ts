import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { AnalyticsEvent } from '../models/Transaction';
import { sendSuccess, sendError } from '../utils/response';
import { Enrollment, LessonProgress, Course } from '../models/Course';
import { User } from '../models/User';
import { Order } from '../models/Transaction';
import { sequelize } from '../config/database';
import { requireAdmin, requireInstructor } from '../middleware/auth';
import { Op } from 'sequelize';

const router = Router();

// POST /api/v1/analytics/track - Track client event
router.post('/track', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { eventName, properties, sessionId } = req.body;
  if (!eventName) { sendError(res, 'eventName is required', 400); return; }

  await AnalyticsEvent.create({
    userId: req.userId,
    eventName,
    properties,
    sessionId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  sendSuccess(res, null, 'Event tracked');
});

// GET /api/v1/analytics/instructor - Instructor analytics for their courses
router.get('/instructor', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const courses = await Course.findAll({
    where: { instructorId: req.userId! },
    attributes: ['id', 'title', 'totalEnrollments', 'avgRating', 'totalReviews', 'price'],
  });

  const courseIds = courses.map(c => c.id);

  const [totalRevenue, totalStudents, completionData] = await Promise.all([
    Order.sum('amount', { where: { courseId: { [Op.in]: courseIds }, status: 'completed' } }),
    Enrollment.count({ where: { courseId: { [Op.in]: courseIds } } }),
    LessonProgress.findAll({
      where: { courseId: { [Op.in]: courseIds }, isCompleted: true },
      attributes: [[sequelize.fn('COUNT', sequelize.col('id')), 'count'], 'courseId'],
      group: ['courseId'],
    }),
  ]);

  sendSuccess(res, {
    courses,
    totals: {
      revenue: totalRevenue || 0,
      students: totalStudents,
      courses: courses.length,
    },
    completionData,
  });
});

// GET /api/v1/analytics/platform - Admin platform analytics
router.get('/platform', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    newUsers,
    newEnrollments,
    revenue,
    topCourses,
    events,
  ] = await Promise.all([
    User.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
    Enrollment.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
    Order.sum('amount', { where: { status: 'completed', createdAt: { [Op.gte]: thirtyDaysAgo } } }),
    Course.findAll({
      order: [['totalEnrollments', 'DESC']],
      limit: 10,
      attributes: ['id', 'title', 'totalEnrollments', 'avgRating', 'price'],
    }),
    AnalyticsEvent.findAll({
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
      attributes: ['eventName', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['eventName'],
      order: [[sequelize.literal('count'), 'DESC']],
      limit: 20,
    }),
  ]);

  sendSuccess(res, {
    period: '30d',
    metrics: {
      newUsers,
      newEnrollments,
      revenue: revenue || 0,
    },
    topCourses,
    topEvents: events,
  });
});

export default router;
