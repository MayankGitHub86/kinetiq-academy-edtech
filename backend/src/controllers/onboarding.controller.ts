import { Request, Response } from 'express';
import { onboardingService } from '../services/onboarding.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  const onboarding = await onboardingService.getOnboarding(req.user!.id);
  sendSuccess(res, onboarding);
};

export const updateOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  const onboarding = await onboardingService.updateOnboarding(req.user!.id, req.body);
  sendSuccess(res, onboarding, 'Onboarding data updated successfully');
};

export const completeOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  const onboarding = await onboardingService.completeOnboarding(req.user!.id);
  sendSuccess(res, onboarding, 'Onboarding completed successfully');
};
