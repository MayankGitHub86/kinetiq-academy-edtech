import { Op } from 'sequelize';
import slugify from 'slugify';
import { Course, Section, Lesson, Enrollment, LessonProgress, Review, CourseStatus } from '../models/Course';
import { User, UserRole } from '../models/User';
import { AnalyticsEvent } from '../models/Transaction';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sendEnrollmentConfirmation } from '../utils/email';
import { certificateService } from './certificate.service';

interface CourseFilters {
  page?: number;
  limit?: number;
  category?: string;
  level?: string;
  search?: string;
  isFree?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
}

class CourseService {
  async getCourses(filters: CourseFilters = {}) {
    const {
      page = 1,
      limit = 12,
      category,
      level,
      search,
      isFree,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
    } = filters;

    const cacheKey = `courses:${JSON.stringify(filters)}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: any = { status: CourseStatus.PUBLISHED };
    if (category) where.category = category;
    if (level) where.level = level;
    if (typeof isFree === 'boolean') where.isFree = isFree;
    if (minPrice !== undefined) where.price = { ...where.price, [Op.gte]: minPrice };
    if (maxPrice !== undefined) where.price = { ...where.price, [Op.lte]: maxPrice };
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { shortDescription: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [search] } },
      ];
    }

    const orderMap: Record<string, any> = {
      newest: [['createdAt', 'DESC']],
      popular: [['totalEnrollments', 'DESC']],
      rating: [['avgRating', 'DESC']],
      price_asc: [['price', 'ASC']],
      price_desc: [['price', 'DESC']],
      createdAt: [['createdAt', 'DESC']],
    };

    const { count, rows } = await Course.findAndCountAll({
      where,
      include: [
        { model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] },
      ],
      order: orderMap[sortBy] || orderMap.newest,
      limit,
      offset: (page - 1) * limit,
    });

    const result = { courses: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) };
    await cacheSet(cacheKey, JSON.stringify(result), 300); // 5 min cache
    return result;
  }

  async getCourseBySlug(slug: string, userId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const whereClause: any = isUuid 
      ? { [Op.or]: [{ slug }, { id: slug }], status: CourseStatus.PUBLISHED }
      : { slug, status: CourseStatus.PUBLISHED };

    const course = await Course.findOne({
      where: whereClause,
      include: [
        { model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl', 'bio'] },
        {
          model: Section,
          include: [
            {
              model: Lesson,
              attributes: ['id', 'title', 'type', 'durationMinutes', 'orderIndex', 'isFree', 'isPublished', 'videoUrl', 'content', 'metadata'],
            },
          ],
          order: [['orderIndex', 'ASC']],
        },
        {
          model: Review,
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
          limit: 10,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!course) throw createError('Course not found', 404);

    let isEnrolled = false;
    let userProgress = null;

    if (userId) {
      const enrollment = await Enrollment.findOne({ where: { userId, courseId: course.id } });
      isEnrolled = !!enrollment;
      if (enrollment) {
        userProgress = { progressPercent: enrollment.progressPercent, lastLessonId: enrollment.lastLessonId };
      }
    }

    return { course, isEnrolled, userProgress };
  }

  async createCourse(instructorId: string, data: Partial<Course>) {
    const slug = slugify(data.title || '', { lower: true, strict: true });
    const existingSlug = await Course.findOne({ where: { slug } });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const course = await Course.create({
      ...data,
      instructorId,
      slug: finalSlug,
      status: CourseStatus.DRAFT,
    });

    return course;
  }

  async updateCourse(courseId: string, instructorId: string, data: Partial<Course>) {
    const course = await Course.findByPk(courseId);
    if (!course) throw createError('Course not found', 404);
    if (course.instructorId !== instructorId) throw createError('Forbidden', 403);

    await course.update(data);
    await cacheDel(`courses:*`);
    return course;
  }

  async publishCourse(courseId: string, instructorId: string) {
    const course = await Course.findByPk(courseId, { include: [Section] });
    if (!course) throw createError('Course not found', 404);
    if (course.instructorId !== instructorId) throw createError('Forbidden', 403);

    const lessonCount = await Lesson.count({ where: { courseId } });
    if (lessonCount < 1) throw createError('Course must have at least 1 lesson', 400);

    await course.update({ status: CourseStatus.PUBLISHED, publishedAt: new Date() });
    return course;
  }

  async enrollStudent(userId: string, courseId: string) {
    const course = await Course.findByPk(courseId);
    if (!course) throw createError('Course not found', 404);

    const existing = await Enrollment.findOne({ where: { userId, courseId } });
    if (existing) throw createError('Already enrolled', 409);

    const enrollment = await Enrollment.create({ userId, courseId });
    await course.increment('totalEnrollments');

    // Send enrollment confirmation email (non-blocking)
    const student = await User.findByPk(userId);
    if (student) {
      sendEnrollmentConfirmation(
        student.email,
        student.firstName || 'there',
        course.title,
        course.slug
      ).catch(() => {});
    }

    logger.info(`Student ${userId} enrolled in course ${courseId}`);
    return enrollment;
  }

  async updateLessonProgress(userId: string, lessonId: string, courseId: string, data: {
    isCompleted?: boolean;
    watchedSeconds?: number;
    playbackPosition?: number;
  }) {
    let progress = await LessonProgress.findOne({ where: { userId, lessonId } });
    if (!progress) {
      progress = await LessonProgress.create({ userId, lessonId, courseId, ...data });
    } else {
      await progress.update({
        ...data,
        completedAt: data.isCompleted ? new Date() : progress.completedAt,
      });
    }

    // Recalculate overall course progress
    const totalLessons = await Lesson.count({ where: { courseId, isPublished: true } });
    const completedLessons = await LessonProgress.count({ where: { userId, courseId, isCompleted: true } });
    const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    await Enrollment.update(
      { progressPercent, lastLessonId: lessonId },
      { where: { userId, courseId } }
    );

    // Auto-issue certificate if course is 100% complete
    if (progressPercent >= 100 && data.isCompleted) {
      certificateService.checkAndIssueCertificate(userId, courseId).catch((err) => {
        logger.error('Certificate auto-issue failed:', err);
      });
    }

    return { progress, progressPercent };
  }

  async getCourseCategories() {
    const cacheKey = 'course:categories';
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const results = await Course.findAll({
      where: { status: CourseStatus.PUBLISHED },
      attributes: ['category'],
      group: ['category'],
    });

    const categories = results.map(r => r.category).filter(Boolean);
    await cacheSet(cacheKey, JSON.stringify(categories), 3600);
    return categories;
  }

  async submitReview(userId: string, courseId: string, rating: number, comment?: string) {
    const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
    if (!enrollment) throw createError('You must be enrolled to review this course', 403);

    const existing = await Review.findOne({ where: { userId, courseId } });
    if (existing) {
      await existing.update({ rating, comment });
    } else {
      await Review.create({ userId, courseId, rating, comment });
    }

    // Recalculate avg rating
    const reviews = await Review.findAll({ where: { courseId, isVisible: true } });
    const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    await Course.update(
      { avgRating: Math.round(avgRating * 100) / 100, totalReviews: reviews.length },
      { where: { id: courseId } }
    );

    return existing || await Review.findOne({ where: { userId, courseId } });
  }

  async getLesson(courseId: string, lessonId: string, userId?: string) {
    const lesson = await Lesson.findOne({
      where: { id: lessonId, courseId },
    });
    if (!lesson) throw createError('Lesson not found', 404);
    const { VideoAsset } = await import('../models/AiLearning');
    const videoAsset = await VideoAsset.findOne({ where: { lessonId } });
    return {
      ...lesson.toJSON(),
      videoAsset,
    };
  }
}

export const courseService = new CourseService();
