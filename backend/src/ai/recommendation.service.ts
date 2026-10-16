import { Course, CourseStatus, Enrollment } from '../models/Course';
import { Onboarding } from '../models/Onboarding';
import { User } from '../models/User';
import { AnalyticsEvent } from '../models/Transaction';
import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';

class AIService {
  /**
   * Generate personalized course recommendations based on:
   * 1. User onboarding interests & goals
   * 2. Already enrolled courses (exclude)
   * 3. Similar courses to what user is studying
   * 4. Popular courses as fallback
   */
  async getRecommendations(userId: string, limit = 8): Promise<Course[]> {
    const cacheKey = `recommendations:${userId}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const [onboarding, enrolledCourses] = await Promise.all([
      Onboarding.findOne({ where: { userId } }),
      Enrollment.findAll({ where: { userId }, attributes: ['courseId'] }),
    ]);

    const enrolledIds = enrolledCourses.map(e => e.courseId);
    const whereExclude: any = { status: CourseStatus.PUBLISHED };
    if (enrolledIds.length > 0) {
      whereExclude.id = { [Op.notIn]: enrolledIds };
    }

    let recommendations: Course[] = [];

    // Strategy 1: Match by onboarding interests/level
    if (onboarding?.selectedInterests && onboarding.selectedInterests.length > 0) {
      const interestBased = await Course.findAll({
        where: {
          ...whereExclude,
          [Op.or]: onboarding.selectedInterests.map(interest => ({
            category: { [Op.iLike]: `%${interest}%` },
          })),
        },
        include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
        order: [['avgRating', 'DESC'], ['totalEnrollments', 'DESC']],
        limit: Math.ceil(limit * 0.6),
      });
      recommendations.push(...interestBased);
    }

    // Strategy 2: Match by level preference
    if (onboarding?.experienceLevel && recommendations.length < limit) {
      const levelMap: Record<string, string> = {
        beginner: 'beginner',
        intermediate: 'intermediate',
        advanced: 'advanced',
      };
      const level = levelMap[onboarding.experienceLevel.toLowerCase()] || 'all_levels';

      const levelBased = await Course.findAll({
        where: {
          ...whereExclude,
          level,
          id: { [Op.notIn]: [...enrolledIds, ...recommendations.map(r => r.id)] },
        },
        include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
        order: [['avgRating', 'DESC']],
        limit: Math.ceil(limit * 0.3),
      });
      recommendations.push(...levelBased);
    }

    // Strategy 3: Popular courses as fallback
    if (recommendations.length < limit) {
      const excludeIds = [...enrolledIds, ...recommendations.map(r => r.id)];
      const popular = await Course.findAll({
        where: {
          ...whereExclude,
          id: excludeIds.length > 0 ? { [Op.notIn]: excludeIds } : undefined,
        },
        include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
        order: [['totalEnrollments', 'DESC'], ['avgRating', 'DESC']],
        limit: limit - recommendations.length,
      });
      recommendations.push(...popular);
    }

    // Deduplicate and limit
    const seen = new Set<string>();
    const unique = recommendations.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, limit);

    await cacheSet(cacheKey, JSON.stringify(unique), 600); // 10 min cache
    return unique;
  }

  /**
   * Get trending courses (by recent enrollments and high rating).
   */
  async getTrending(limit = 6): Promise<Course[]> {
    const cacheKey = `trending:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const courses = await Course.findAll({
      where: { status: CourseStatus.PUBLISHED },
      include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
      order: [['totalEnrollments', 'DESC'], ['avgRating', 'DESC']],
      limit,
    });

    await cacheSet(cacheKey, JSON.stringify(courses), 300); // 5 min
    return courses;
  }

  /**
   * Get courses similar to a given course (same category or tags overlap).
   */
  async getSimilarCourses(courseId: string, limit = 4): Promise<Course[]> {
    const cacheKey = `similar:${courseId}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const course = await Course.findByPk(courseId);
    if (!course) return [];

    const where: any = {
      status: CourseStatus.PUBLISHED,
      id: { [Op.ne]: courseId },
    };

    const orConditions: any[] = [];
    if (course.category) {
      orConditions.push({ category: course.category });
    }
    if (course.level) {
      orConditions.push({ level: course.level });
    }
    if (course.tags && course.tags.length > 0) {
      orConditions.push({ tags: { [Op.overlap]: course.tags } });
    }

    if (orConditions.length > 0) {
      where[Op.or] = orConditions;
    }

    const similar = await Course.findAll({
      where,
      include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
      order: [['avgRating', 'DESC'], ['totalEnrollments', 'DESC']],
      limit,
    });

    await cacheSet(cacheKey, JSON.stringify(similar), 600);
    return similar;
  }

  /**
   * Generate an AI-powered search using full-text matching.
   * In production, this would integrate with OpenAI embeddings.
   */
  async semanticSearch(query: string, limit = 10): Promise<Course[]> {
    const cacheKey = `search:${query.slice(0, 50)}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const results = await Course.findAll({
      where: {
        status: CourseStatus.PUBLISHED,
        [Op.or]: [
          { title: { [Op.iLike]: `%${query}%` } },
          { shortDescription: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          ...keywords.map(kw => ({ tags: { [Op.contains]: [kw] } })),
        ],
      },
      include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName', 'avatarUrl'] }],
      order: [['avgRating', 'DESC'], ['totalEnrollments', 'DESC']],
      limit,
    });

    await cacheSet(cacheKey, JSON.stringify(results), 120); // 2 min
    return results;
  }

  /**
   * Track a learning event for analytics.
   */
  async trackEvent(userId: string | undefined, eventName: string, properties?: Record<string, any>, sessionId?: string, ipAddress?: string, userAgent?: string) {
    try {
      await AnalyticsEvent.create({
        userId,
        eventName,
        properties,
        sessionId,
        ipAddress,
        userAgent,
      });
    } catch (err) {
      logger.error('Analytics track error:', err);
    }
  }
}

export const aiService = new AIService();
