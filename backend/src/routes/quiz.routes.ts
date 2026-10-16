import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { quizService } from '../services/quiz.service';
import { certificateService } from '../services/certificate.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

// ─── Quiz Routes ──────────────────────────────────────────────

// POST /api/v1/quiz/lessons/:lessonId/start - Start a quiz attempt
router.post('/lessons/:lessonId/start', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const attempt = await quizService.startAttempt(req.userId!, req.params.lessonId as string);
  sendCreated(res, attempt, 'Quiz started');
});

// POST /api/v1/quiz/attempts/:attemptId/submit - Submit quiz answers
router.post(
  '/attempts/:attemptId/submit',
  authenticate,
  [
    body('answers').isObject().withMessage('answers must be an object'),
    body('lessonId').notEmpty().withMessage('lessonId is required'),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await quizService.submitQuiz(req.userId!, req.params.attemptId as string, req.body);
    sendSuccess(res, result, 'Quiz submitted');
  }
);

// GET /api/v1/quiz/lessons/:lessonId/history - Get quiz attempt history
router.get('/lessons/:lessonId/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const attempts = await quizService.getAttemptHistory(req.userId!, req.params.lessonId as string);
  sendSuccess(res, attempts);
});

// GET /api/v1/quiz/lessons/:lessonId/best - Get best attempt
router.get('/lessons/:lessonId/best', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const attempt = await quizService.getBestAttempt(req.userId!, req.params.lessonId as string);
  sendSuccess(res, attempt);
});

// ─── Certificate Routes ────────────────────────────────────────

// GET /api/v1/quiz/certificates/:id - Get certificate by ID
router.get('/certificates/:id', async (req: Request, res: Response): Promise<void> => {
  const cert = await certificateService.getCertificate(req.params.id as string);
  sendSuccess(res, cert);
});

// GET /api/v1/quiz/certificates/verify/:number - Verify certificate
router.get('/certificates/verify/:number', async (req: Request, res: Response): Promise<void> => {
  const result = await certificateService.verifyCertificate(req.params.number as string);
  sendSuccess(res, result, 'Certificate is valid');
});

export default router;
