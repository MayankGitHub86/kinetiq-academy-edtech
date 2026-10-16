import { User } from '../models/User';
import { Course, Enrollment, LessonProgress } from '../models/Course';
import { Notification, Certificate } from '../models/Transaction';
import { Onboarding } from '../models/Onboarding';
import { createError } from '../middleware/errorHandler';
import { cacheGet, cacheSet } from '../config/redis';
import { Op } from 'sequelize';

class UserService {
  async getProfile(userId: string) {
    const user = await User.findByPk(userId, {
      include: [{ model: Onboarding }],
    });
    if (!user) throw createError('User not found', 404);
    return user.toSafeJSON();
  }

  async updateProfile(userId: string, data: any) {
    const user = await User.findByPk(userId);
    if (!user) throw createError('User not found', 404);

    const allowedFields = ['firstName', 'lastName', 'bio', 'phone', 'timezone', 'avatarUrl', 'preferences'];
    const updateData: any = {};
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    await user.update(updateData);
    return user.toSafeJSON();
  }

  async getDashboard(userId: string) {
    const cacheKey = `dashboard:${userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const [enrollments, recentActivity, notifications] = await Promise.all([
      Enrollment.findAll({
        where: { userId, isActive: true },
        include: [{ model: Course, attributes: ['id', 'title', 'slug', 'thumbnailUrl', 'totalLessons'] }],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      }),
      LessonProgress.findAll({
        where: { userId, isCompleted: true },
        order: [['updatedAt', 'DESC']],
        limit: 5,
      }),
      Notification.findAll({
        where: { userId, isRead: false },
        order: [['createdAt', 'DESC']],
        limit: 5,
      }),
    ]);

    const totalCourses = enrollments.length;
    const completedCourses = enrollments.filter(e => e.progressPercent >= 100).length;
    const totalWatchedSeconds = await LessonProgress.sum('watchedSeconds', { where: { userId } }) || 0;

    const dashboard = {
      stats: {
        totalEnrolledCourses: totalCourses,
        completedCourses,
        inProgressCourses: totalCourses - completedCourses,
        totalHoursLearned: Math.round(totalWatchedSeconds / 3600),
        unreadNotifications: notifications.length,
      },
      enrollments,
      recentActivity,
      notifications,
    };

    await cacheSet(cacheKey, JSON.stringify(dashboard), 60);
    return dashboard;
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const { count, rows } = await Notification.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { notifications: rows, total: count };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await Notification.findOne({ where: { id: notificationId, userId } });
    if (!notification) throw createError('Notification not found', 404);
    await notification.update({ isRead: true });
    return notification;
  }

  async markAllNotificationsRead(userId: string) {
    await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
  }

  async completeOnboarding(userId: string, data: Record<string, any>) {
    let onboarding = await Onboarding.findOne({ where: { userId } });
    if (!onboarding) {
      onboarding = await Onboarding.create({ userId, ...data, completedStatus: true });
    } else {
      await onboarding.update({ ...data, completedStatus: true });
    }
    const user = await User.findByPk(userId);
    return { onboarding, user: user?.toSafeJSON() };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findByPk(userId);
    if (!user) throw createError('User not found', 404);
    if (!user.passwordHash) throw createError('Cannot change password for OAuth accounts', 400);

    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) throw createError('Current password is incorrect', 400);

    await user.update({ passwordHash: newPassword });
  }

  async getCertificates(userId: string) {
    return Certificate.findAll({
      where: { userId },
      include: [{ model: Course, attributes: ['id', 'title', 'slug', 'thumbnailUrl'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  async getEnrolledCourses(userId: string, page = 1, limit = 12) {
    const { count, rows } = await Enrollment.findAndCountAll({
      where: { userId, isActive: true },
      include: [
        {
          model: Course,
          attributes: ['id', 'title', 'slug', 'thumbnailUrl', 'totalLessons', 'level', 'avgRating'],
          include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { enrollments: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) };
  }
}

export const userService = new UserService();
