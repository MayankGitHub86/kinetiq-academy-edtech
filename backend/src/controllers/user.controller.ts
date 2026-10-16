import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { paginationMeta } from '../utils/response';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await userService.getProfile(req.userId!);
  sendSuccess(res, profile);
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const updated = await userService.updateProfile(req.userId!, req.body);
  sendSuccess(res, updated, 'Profile updated');
};

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  const dashboard = await userService.getDashboard(req.userId!);
  sendSuccess(res, dashboard);
};

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const { notifications, total } = await userService.getNotifications(req.userId!, page, limit);
  sendSuccess(res, notifications, 'Notifications retrieved', 200, paginationMeta(total, page, limit));
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const notification = await userService.markNotificationRead(req.userId!, req.params.id as string);
  sendSuccess(res, notification, 'Notification marked as read');
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  await userService.markAllNotificationsRead(req.userId!);
  sendSuccess(res, null, 'All notifications marked as read');
};

export const completeOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await userService.completeOnboarding(req.userId!, req.body);
  sendSuccess(res, result, 'Onboarding completed');
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  await userService.changePassword(req.userId!, req.body.currentPassword, req.body.newPassword);
  sendSuccess(res, null, 'Password changed successfully');
};

export const getCertificates = async (req: AuthRequest, res: Response): Promise<void> => {
  const certs = await userService.getCertificates(req.userId!);
  sendSuccess(res, certs);
};

export const getEnrolledCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 12;
  const result = await userService.getEnrolledCourses(req.userId!, page, limit);
  sendSuccess(res, result.enrollments, 'Enrolled courses retrieved', 200, paginationMeta(result.total, page, limit));
};
