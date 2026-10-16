import { Router, Request, Response } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { aiService } from './recommendation.service';
import { sendSuccess } from '../utils/response';

const router = Router();

// GET /api/v1/ai/recommendations - Personalized recommendations (auth required)
router.get('/recommendations', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 8;
  const courses = await aiService.getRecommendations(req.userId!, limit);
  sendSuccess(res, courses, 'Recommendations generated');
});

// GET /api/v1/ai/trending - Trending courses (public)
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 6;
  const courses = await aiService.getTrending(limit);
  sendSuccess(res, courses, 'Trending courses');
});

// GET /api/v1/ai/similar/:courseId - Similar courses (public)
router.get('/similar/:courseId', async (req: Request, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 4;
  const courses = await aiService.getSimilarCourses(req.params.courseId as string, limit);
  sendSuccess(res, courses, 'Similar courses');
});

// GET /api/v1/ai/search - Semantic search (public)
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 10;
  if (!query) { sendSuccess(res, [], 'No query provided'); return; }
  const courses = await aiService.semanticSearch(query, limit);
  sendSuccess(res, courses, `Search results for: ${query}`);
});

// POST /api/v1/ai/track - Track analytics event
router.post('/track', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { eventName, properties, sessionId } = req.body;
  await aiService.trackEvent(
    req.userId,
    eventName,
    properties,
    sessionId,
    req.ip,
    req.headers['user-agent']
  );
  sendSuccess(res, null, 'Event tracked');
});

export default router;
