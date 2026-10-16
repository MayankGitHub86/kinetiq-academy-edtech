import { Certificate } from '../models/Transaction';
import { Enrollment, Course, LessonProgress, Lesson } from '../models/Course';
import { User } from '../models/User';
import { Notification, NotificationType } from '../models/Transaction';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sendCourseCompletionEmail } from '../utils/email';
import crypto from 'crypto';

class CertificateService {
  /**
   * Check if user has completed the course and issue a certificate if so.
   */
  async checkAndIssueCertificate(userId: string, courseId: string): Promise<Certificate | null> {
    const course = await Course.findByPk(courseId);
    if (!course || !course.hasCertificate) return null;

    const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
    if (!enrollment) return null;

    // Check if already has certificate
    const existing = await Certificate.findOne({ where: { userId, courseId } });
    if (existing) return existing;

    // Check if course is 100% complete
    const totalLessons = await Lesson.count({ where: { courseId, isPublished: true } });
    const completedLessons = await LessonProgress.count({ where: { userId, courseId, isCompleted: true } });

    if (totalLessons === 0 || completedLessons < totalLessons) return null;

    // Issue certificate
    const cert = await this.issueCertificate(userId, courseId);
    return cert;
  }

  /**
   * Manually issue a certificate to a user for a course.
   */
  async issueCertificate(userId: string, courseId: string): Promise<Certificate> {
    const existing = await Certificate.findOne({ where: { userId, courseId } });
    if (existing) return existing;

    const certificateNumber = this.generateCertificateNumber();
    const certificateUrl = this.buildCertificateUrl(userId, courseId, certificateNumber);

    const cert = await Certificate.create({
      userId,
      courseId,
      certificateNumber,
      certificateUrl,
      issuedAt: new Date(),
    });

    // Send notification and email
    const [user, course] = await Promise.all([
      User.findByPk(userId),
      Course.findByPk(courseId),
    ]);

    if (user && course) {
      await Notification.create({
        userId,
        type: NotificationType.COURSE_COMPLETE,
        title: '🏆 Course Completed!',
        body: `Congratulations! You've completed "${course.title}" and earned a certificate.`,
        data: { courseId, certificateId: cert.id },
        actionUrl: `/certificates/${cert.id}`,
      });

      sendCourseCompletionEmail(
        user.email,
        user.firstName || 'there',
        course.title,
        certificateUrl
      ).catch(() => {});
    }

    logger.info(`Certificate issued: user ${userId}, course ${courseId}, cert #${certificateNumber}`);
    return cert;
  }

  /**
   * Get certificate by ID (for public verification).
   */
  async getCertificate(certId: string) {
    const cert = await Certificate.findByPk(certId, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Course, attributes: ['id', 'title', 'slug', 'thumbnailUrl', 'totalDurationMinutes'] },
      ],
    });
    if (!cert) throw createError('Certificate not found', 404);
    return cert;
  }

  /**
   * Verify a certificate by certificate number.
   */
  async verifyCertificate(certificateNumber: string) {
    const cert = await Certificate.findOne({
      where: { certificateNumber },
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName'] },
        { model: Course, attributes: ['id', 'title', 'slug'] },
      ],
    });
    if (!cert) throw createError('Certificate not found or invalid', 404);
    return { valid: true, certificate: cert };
  }

  private generateCertificateNumber(): string {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `KA-${year}-${random}`;
  }

  private buildCertificateUrl(userId: string, courseId: string, certNumber: string): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:4000';
    return `${baseUrl}/certificates/verify/${certNumber}`;
  }
}

export const certificateService = new CertificateService();
