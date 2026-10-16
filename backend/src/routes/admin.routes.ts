import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { User, UserRole } from '../models/User';
import { Course, Enrollment } from '../models/Course';
import { Order } from '../models/Transaction';
import { sendSuccess, sendError } from '../utils/response';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';

const router = Router();

// All admin routes require admin role
router.use(authenticate, requireAdmin);

// GET /api/v1/admin/stats
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const [totalUsers, totalCourses, totalEnrollments, totalRevenue] = await Promise.all([
    User.count({ where: { deletedAt: null } }),
    Course.count({ where: { deletedAt: null } }),
    Enrollment.count(),
    Order.sum('amount', { where: { status: 'completed' } }),
  ]);

  const recentUsers = await User.findAll({
    order: [['createdAt', 'DESC']],
    limit: 10,
    attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt'],
  });

  sendSuccess(res, {
    stats: { totalUsers, totalCourses, totalEnrollments, totalRevenue: totalRevenue || 0 },
    recentUsers,
  });
});

// GET /api/v1/admin/users
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const role = req.query.role as UserRole;

  const where: any = {};
  if (role) where.role = role;
  if (search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['passwordHash', 'emailVerificationToken', 'passwordResetToken'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  sendSuccess(res, rows, 'Users retrieved', 200, { total: count, page, limit });
});

// PATCH /api/v1/admin/users/:id/status
router.patch('/users/:id/status', async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.params.id as string);
  if (!user) { sendError(res, 'User not found', 404); return; }
  await user.update({ isActive: req.body.isActive });
  sendSuccess(res, user.toSafeJSON(), 'User status updated');
});

// PATCH /api/v1/admin/users/:id/role
router.patch('/users/:id/role', async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.params.id as string);
  if (!user) { sendError(res, 'User not found', 404); return; }
  if (!Object.values(UserRole).includes(req.body.role)) { sendError(res, 'Invalid role', 400); return; }
  await user.update({ role: req.body.role });
  sendSuccess(res, user.toSafeJSON(), 'User role updated');
});

// GET /api/v1/admin/courses
router.get('/courses', async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const { count, rows } = await Course.findAndCountAll({
    include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    paranoid: false,
  });

  sendSuccess(res, rows, 'Courses retrieved', 200, { total: count, page, limit });
});

// DELETE /api/v1/admin/courses/:id
router.delete('/courses/:id', async (req: Request, res: Response): Promise<void> => {
  const course = await Course.findByPk(req.params.id as string);
  if (!course) { sendError(res, 'Course not found', 404); return; }
  await course.destroy();
  sendSuccess(res, null, 'Course deleted');
});

export default router;
