import { Router } from 'express';
import { getOnboarding, updateOnboarding, completeOnboarding } from '../controllers/onboarding.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All onboarding routes require authentication
router.use(authenticate);

router.get('/', getOnboarding);
router.put('/', updateOnboarding);
router.post('/complete', completeOnboarding);

export default router;
