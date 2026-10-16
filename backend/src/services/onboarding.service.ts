import { Onboarding } from '../models/Onboarding';
import { createError } from '../middleware/errorHandler';

export interface UpdateOnboardingDTO {
  selectedInterests?: string[];
  experienceLevel?: string;
  learningGoals?: string[];
  dailyLearningTargetMinutes?: number;
  preferredLearningFormat?: string;
}

class OnboardingService {
  async getOnboarding(userId: string): Promise<Onboarding> {
    let onboarding = await Onboarding.findOne({ where: { userId } });
    if (!onboarding) {
      onboarding = await Onboarding.create({ userId });
    }
    return onboarding;
  }

  async updateOnboarding(userId: string, data: UpdateOnboardingDTO): Promise<Onboarding> {
    const onboarding = await this.getOnboarding(userId);
    await onboarding.update(data);
    return onboarding;
  }

  async completeOnboarding(userId: string): Promise<Onboarding> {
    const onboarding = await this.getOnboarding(userId);
    await onboarding.update({ completedStatus: true });
    
    // Future: Generate recommendations here as per prompt #8
    
    return onboarding;
  }
}

export const onboardingService = new OnboardingService();
