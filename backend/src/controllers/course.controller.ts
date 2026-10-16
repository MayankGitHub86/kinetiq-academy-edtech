import { Request, Response } from 'express';
import { courseService } from '../services/course.service';
import { sendSuccess, sendCreated, sendError, paginationMeta } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  const result = await courseService.getCourses({
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 12,
    category: req.query.category as string,
    level: req.query.level as string,
    search: req.query.search as string,
    isFree: req.query.isFree === 'true' ? true : req.query.isFree === 'false' ? false : undefined,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
    sortBy: req.query.sortBy as string,
  });

  sendSuccess(res, result.courses, 'Courses retrieved', 200, paginationMeta(result.total, result.page, result.limit));
};

export const getCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await courseService.getCourseBySlug(req.params.slug as string, req.userId);
  sendSuccess(res, result);
};

export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const course = await courseService.createCourse(req.userId!, req.body);
  sendCreated(res, course, 'Course created');
};

export const updateCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const course = await courseService.updateCourse(req.params.id as string, req.userId!, req.body);
  sendSuccess(res, course, 'Course updated');
};

export const publishCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const course = await courseService.publishCourse(req.params.id as string, req.userId!);
  sendSuccess(res, course, 'Course published');
};

export const enrollInCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const enrollment = await courseService.enrollStudent(req.userId!, req.params.id as string);
  sendCreated(res, enrollment, 'Enrolled successfully');
};

export const updateProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  const { lessonId, courseId } = req.params;
  const result = await courseService.updateLessonProgress(req.userId!, lessonId as string, courseId as string, req.body);
  sendSuccess(res, result, 'Progress updated');
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const categories = await courseService.getCourseCategories();
  sendSuccess(res, categories);
};

export const submitReview = async (req: AuthRequest, res: Response): Promise<void> => {
  const review = await courseService.submitReview(
    req.userId!,
    req.params.id as string,
    req.body.rating,
    req.body.comment
  );
  sendCreated(res, review, 'Review submitted');
};

export const getLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, lessonId } = req.params;
  const lesson = await courseService.getLesson(courseId as string, lessonId as string, req.userId);
  sendSuccess(res, lesson, 'Lesson retrieved');
};
