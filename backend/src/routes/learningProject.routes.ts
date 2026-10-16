import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, requireInstructor, AuthRequest } from '../middleware/auth';
import { LearningProjectService } from '../services/learningProject.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

const upload = multer({
  dest: path.join(process.cwd(), 'public', 'uploads', 'temp'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.js', '.ts', '.py', '.java', '.cpp', '.go', '.rs', '.html', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.includes('pdf') || file.mimetype.includes('word')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, Markdown, and Code files.`));
    }
  },
});

const handleRouteError = (res: Response, err: any, defaultCode = 500) => {
  const code = err.statusCode || (
    err.name === 'ForbiddenError' || /forbidden|unauthorized|not assigned|not permitted|expired/i.test(err.message)
      ? 403
      : /not found/i.test(err.message)
      ? 404
      : defaultCode
  );
  sendError(res, err.message, code);
};

// =========================================================================
// ADMINISTRATIVE CONTENT STUDIO ROUTES (INSTRUCTOR & ADMIN ONLY)
// =========================================================================

/**
 * GET /api/v1/learning-projects/admin/students
 * List eligible students for access assignment
 */
router.get('/admin/students', authenticate, requireInstructor, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const students = await LearningProjectService.getEligibleStudents();
    sendSuccess(res, students);
  } catch (err: any) {
    logger.error('Failed to list eligible students:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects
 * Create a new learning project
 */
router.post('/', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, subject, settings } = req.body;
    if (!title || !title.trim()) {
      sendError(res, 'Project title is required.', 400);
      return;
    }

    const project = await LearningProjectService.createProject(req.userId!, {
      title: title.trim(),
      description,
      subject,
      settings,
    });

    sendCreated(res, project, 'Learning project created successfully.');
  } catch (err: any) {
    logger.error('Failed to create learning project:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/settings
 * Update project settings
 */
router.put('/:id/settings', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.updateSettings(req.userId!, req.params.id as string, req.body);
    sendSuccess(res, project, 'Personalization settings updated.');
  } catch (err: any) {
    logger.error(`Failed to update project settings:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/sources/url
 * Add web URL source
 */
router.post('/:id/sources/url', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url) {
      sendError(res, 'URL is required.', 400);
      return;
    }

    const source = await LearningProjectService.addSourceFromUrl(req.userId!, req.params.id as string, url);
    sendCreated(res, source, 'Source URL imported and parsed successfully.');
  } catch (err: any) {
    logger.error(`Failed to import source URL:`, err);
    handleRouteError(res, err, 400);
  }
});

/**
 * POST /api/v1/learning-projects/:id/sources/file
 * Upload document source
 */
router.post('/:id/sources/file', authenticate, requireInstructor, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No file was uploaded.', 400);
      return;
    }

    const source = await LearningProjectService.addSourceFromFile(
      req.userId!,
      req.params.id as string,
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    sendCreated(res, source, 'Document imported and parsed successfully.');
  } catch (err: any) {
    logger.error(`Failed to upload document source:`, err);
    handleRouteError(res, err, 400);
  }
});

/**
 * POST /api/v1/learning-projects/:id/sources/text
 * Paste raw text source
 */
router.post('/:id/sources/text', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { text, title } = req.body;
    if (!text || text.trim().length < 20) {
      sendError(res, 'Text must be at least 20 characters long.', 400);
      return;
    }

    const source = await LearningProjectService.addSourceFromText(
      req.userId!,
      req.params.id as string,
      text,
      title || 'Custom Notes'
    );

    sendCreated(res, source, 'Pasted text imported successfully.');
  } catch (err: any) {
    logger.error(`Failed to paste text source:`, err);
    handleRouteError(res, err);
  }
});

/**
 * DELETE /api/v1/learning-projects/:id/sources/:sourceId
 * Remove source from project
 */
router.delete('/:id/sources/:sourceId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const success = await LearningProjectService.deleteSource(
      req.userId!,
      req.params.id as string,
      req.params.sourceId as string
    );
    if (!success) {
      sendError(res, 'Source not found.', 404);
      return;
    }
    sendSuccess(res, { deleted: true }, 'Source removed from project.');
  } catch (err: any) {
    logger.error(`Failed to delete source:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/analyze
 * Central AI Knowledge Engine: Analyze project sources
 */
router.post('/:id/analyze', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const knowledgeMap = await LearningProjectService.analyzeProject(req.userId!, req.params.id as string, req.body.settings);
    sendSuccess(res, knowledgeMap, 'Central AI Knowledge analysis complete.');
  } catch (err: any) {
    logger.error(`Failed to analyze project:`, err);
    handleRouteError(res, err, 400);
  }
});

/**
 * POST /api/v1/learning-projects/:id/generate-pack
 * Generate personalized Study Pack
 */
router.post('/:id/generate-pack', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { packType } = req.body;
    const result = await LearningProjectService.generateStudyPack(req.userId!, req.params.id as string, {
      packType: packType || 'complete',
    });
    sendCreated(res, result, 'Personal Study Pack generated successfully.');
  } catch (err: any) {
    logger.error(`Failed to generate study pack:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/publish
 * Publish project and define student publication settings
 */
router.post('/:id/publish', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.publishProject(
      req.userId!,
      req.params.id as string,
      req.userRole!,
      req.body.publicationSettings
    );
    sendSuccess(res, project, 'Learning project published successfully.');
  } catch (err: any) {
    logger.error(`Failed to publish project:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/unpublish
 * Unpublish project (withdraw from students)
 */
router.post('/:id/unpublish', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.unpublishProject(
      req.userId!,
      req.params.id as string,
      req.userRole!
    );
    sendSuccess(res, project, 'Learning project unpublished.');
  } catch (err: any) {
    logger.error(`Failed to unpublish project:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/access
 * View student access assignments for a project
 */
router.get('/:id/access', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const list = await LearningProjectService.getProjectAccessList(
      req.userId!,
      req.params.id as string,
      req.userRole!
    );
    sendSuccess(res, list);
  } catch (err: any) {
    logger.error(`Failed to list student accesses:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/access
 * Grant or assign project access to a student
 */
router.post('/:id/access', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, assignmentType, groupOrBatch, validFrom, validUntil, notes } = req.body;
    if (!studentId) {
      sendError(res, 'studentId is required.', 400);
      return;
    }

    const access = await LearningProjectService.assignStudentAccess(
      req.userId!,
      req.params.id as string,
      req.userRole!,
      {
        studentId,
        assignmentType,
        groupOrBatch,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        notes,
      }
    );
    sendCreated(res, access, 'Student access granted successfully.');
  } catch (err: any) {
    logger.error(`Failed to assign student access:`, err);
    handleRouteError(res, err);
  }
});

/**
 * DELETE /api/v1/learning-projects/:id/access/:studentId
 * Revoke student access from a project
 */
router.delete('/:id/access/:studentId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await LearningProjectService.revokeStudentAccess(
      req.userId!,
      req.params.id as string,
      req.params.studentId as string,
      req.userRole!
    );
    sendSuccess(res, result, 'Student access revoked.');
  } catch (err: any) {
    logger.error(`Failed to revoke student access:`, err);
    handleRouteError(res, err);
  }
});

// =========================================================================
// SHARED & STUDENT LEARNING CONSUMPTION ROUTES (AUTHORIZATION ENFORCED)
// =========================================================================

/**
 * GET /api/v1/learning-projects
 * List projects:
 * - Students: ONLY published projects explicitly assigned to them or targetAudience='all'
 * - Instructors/Admins: projects they own or manage
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await LearningProjectService.getProjects(req.userId!, req.userRole!);
    sendSuccess(res, projects);
  } catch (err: any) {
    logger.error('Failed to list learning projects:', err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id
 * Get single project:
 * - Strictly verifies ownership or published + active student assignment
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.getProjectById(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, project);
  } catch (err: any) {
    logger.error(`Failed to get project ${req.params.id}:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/study-pack
 * Fetch study pack components (notes, flashcards, questions, video)
 * - Enforces access permissions and publication component toggles
 */
router.get('/:id/study-pack', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pack = await LearningProjectService.getStudyPack(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, pack);
  } catch (err: any) {
    logger.error(`Failed to get study pack:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/video
 * Fetch protected video lecture asset
 */
router.get('/:id/video', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const video = await LearningProjectService.getVideoAsset(req.userId!, req.params.id as string, req.userRole!);
    if (!video) {
      sendError(res, 'No video lecture asset available for this project.', 404);
      return;
    }
    sendSuccess(res, video);
  } catch (err: any) {
    logger.error(`Failed to get video asset:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/tutor
 * Ask Your Content: Source-grounded AI tutor
 */
router.post('/:id/tutor', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query, timestamp } = req.body;
    if (!query || !query.trim()) {
      sendError(res, 'Query is required.', 400);
      return;
    }

    const answer = await LearningProjectService.askTutor(
      req.userId!,
      req.params.id as string,
      query.trim(),
      timestamp,
      req.userRole!
    );
    sendSuccess(res, answer);
  } catch (err: any) {
    logger.error(`AI Tutor error:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/practice/submit
 * Submit answers to quiz or exam questions, update adaptive mastery
 */
router.post('/:id/practice/submit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      sendError(res, 'Answers object is required.', 400);
      return;
    }

    const evaluation = await LearningProjectService.submitPractice(
      req.userId!,
      req.params.id as string,
      answers,
      req.userRole!
    );
    sendSuccess(res, evaluation, 'Practice submitted and evaluated.');
  } catch (err: any) {
    logger.error(`Practice submission error:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/analytics
 * Get student adaptive mastery analytics and scheduled study plan
 */
router.get('/:id/analytics', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analytics = await LearningProjectService.getProjectAnalytics(
      req.userId!,
      req.params.id as string,
      req.userRole!
    );
    sendSuccess(res, analytics);
  } catch (err: any) {
    logger.error(`Failed to get project analytics:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/export
 * Download complete study pack
 */
router.get('/:id/export', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exportData = await LearningProjectService.exportStudyPack(
      req.userId!,
      req.params.id as string,
      'markdown',
      req.userRole!
    );
    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.send(exportData.content);
  } catch (err: any) {
    logger.error(`Failed to export study pack:`, err);
    handleRouteError(res, err);
  }
});

export default router;
