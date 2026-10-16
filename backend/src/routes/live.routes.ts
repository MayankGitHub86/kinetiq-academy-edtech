import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { LiveSession } from '../models/Transaction';
import { Enrollment } from '../models/Course';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { createError } from '../middleware/errorHandler';

const router = Router();

const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

// Generate LiveKit access token for a participant
const generateLiveKitToken = async (roomName: string, participantName: string, isInstructor: boolean): Promise<string> => {
  try {
    // Dynamic import for livekit-server-sdk if available, otherwise return mock token
    const { AccessToken } = await import('livekit-server-sdk').catch(() => ({ AccessToken: null }));
    if (!AccessToken) {
      return `mock-token-${roomName}-${participantName}`;
    }
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      ttl: '4h',
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: isInstructor,
      canSubscribe: true,
      canPublishData: true,
    });
    return token.toJwt();
  } catch {
    return `mock-token-${roomName}-${Date.now()}`;
  }
};

// POST /api/v1/live/sessions - Create a live session
router.post('/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, title, description, scheduledAt, durationMinutes, maxParticipants } = req.body;
  const roomName = `kinetiq-${courseId}-${Date.now()}`;

  const session = await LiveSession.create({
    courseId,
    instructorId: req.userId!,
    title,
    description,
    scheduledAt: new Date(scheduledAt),
    durationMinutes,
    maxParticipants,
    livekitRoomName: roomName,
    status: 'scheduled',
  });

  sendCreated(res, session, 'Live session scheduled');
});

// GET /api/v1/live/sessions/:id/join - Get join token
router.get('/sessions/:id/join', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await LiveSession.findByPk(req.params.id as string);
  if (!session) { sendError(res, 'Session not found', 404); return; }

  // Check if user is enrolled or is instructor
  const isInstructor = session.instructorId === req.userId;
  if (!isInstructor) {
    const enrollment = await Enrollment.findOne({ where: { userId: req.userId!, courseId: session.courseId } });
    if (!enrollment) { sendError(res, 'You must be enrolled to join this session', 403); return; }
  }

  const participantName = req.user!.email || req.userId!;
  const token = await generateLiveKitToken(session.livekitRoomName!, participantName, isInstructor);

  sendSuccess(res, {
    token,
    roomName: session.livekitRoomName,
    livekitUrl: LIVEKIT_URL,
    session,
  });
});

// GET /api/v1/live/sessions - Get upcoming sessions for a course
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId } = req.query;
  const where: any = { status: 'scheduled' };
  if (courseId) where.courseId = courseId;

  const sessions = await LiveSession.findAll({
    where,
    order: [['scheduledAt', 'ASC']],
    limit: 20,
  });

  sendSuccess(res, sessions);
});

// PATCH /api/v1/live/sessions/:id/end - End a live session
router.patch('/sessions/:id/end', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await LiveSession.findByPk(req.params.id as string);
  if (!session) { sendError(res, 'Session not found', 404); return; }
  if (session.instructorId !== req.userId) { sendError(res, 'Forbidden', 403); return; }

  await session.update({ status: 'ended', endedAt: new Date() });
  sendSuccess(res, session, 'Session ended');
});

export default router;
