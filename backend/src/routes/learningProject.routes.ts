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
    const {
      title,
      description,
      subject,
      category,
      targetLevel,
      language,
      difficulty,
      learningObjectives,
      prerequisites,
      targetAudience,
      estimatedDurationMinutes,
      thumbnailUrl,
      sourceUrl,
      sourceText,
      settings,
    } = req.body;

    if (!title || !title.trim()) {
      sendError(res, 'Course title is required.', 400);
      return;
    }

    const project = await LearningProjectService.createProject(req.userId!, {
      title: title.trim(),
      description,
      subject,
      category,
      targetLevel,
      language,
      difficulty,
      learningObjectives,
      prerequisites,
      targetAudience,
      estimatedDurationMinutes: estimatedDurationMinutes ? Number(estimatedDurationMinutes) : undefined,
      thumbnailUrl,
      sourceUrl,
      sourceText,
      settings,
    });

    sendCreated(res, project, 'AI Course project created successfully.');
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
 * GET /api/v1/learning-projects/:id/syllabus
 * Fetch proposed syllabus, concept coverage matrix, and source inventory
 */
router.get('/:id/syllabus', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const syllabus = await LearningProjectService.getSyllabus(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, syllabus, 'Course syllabus retrieved successfully.');
  } catch (err: any) {
    logger.error(`Failed to get syllabus:`, err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/syllabus
 * Review and edit syllabus outline before or after generation
 */
router.put('/:id/syllabus', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await LearningProjectService.updateSyllabus(
      req.userId!,
      req.params.id as string,
      req.body,
      req.userRole!
    );
    sendSuccess(res, updated, 'Course syllabus updated successfully.');
  } catch (err: any) {
    logger.error(`Failed to update syllabus:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/completeness
 * Fetch Stage B source completeness report and concept dependencies
 */
router.get('/:id/completeness', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await LearningProjectService.getCompletenessReport(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, report, 'Source completeness analysis report retrieved.');
  } catch (err: any) {
    logger.error(`Failed to get completeness report:`, err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/quality-report
 * Fetch 12-dimension course quality audit report
 */
router.get('/:id/quality-report', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await LearningProjectService.getQualityReport(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, report, 'Course quality evaluation report retrieved.');
  } catch (err: any) {
    logger.error(`Failed to get quality report:`, err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/practice-papers/generate
 * Generate custom practice paper with educator blueprint
 */
router.post('/:id/practice-papers/generate', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paper = await LearningProjectService.generateCustomPracticePaper(
      req.userId!,
      req.params.id as string,
      req.body,
      req.userRole!
    );
    sendCreated(res, paper, 'Custom practice paper generated successfully.');
  } catch (err: any) {
    logger.error(`Failed to generate custom practice paper:`, err);
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
 * POST /api/v1/learning-projects/:id/approve
 * Approve project after administrative review
 */
router.post('/:id/approve', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.approveProject(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, project, 'Course project approved.');
  } catch (err: any) {
    logger.error('Failed to approve project:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/archive
 * Archive project
 */
router.post('/:id/archive', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.archiveProject(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, project, 'Course project archived.');
  } catch (err: any) {
    logger.error('Failed to archive project:', err);
    handleRouteError(res, err);
  }
});

/**
 * PATCH /api/v1/learning-projects/:id/status
 * Explicitly update course status
 */
router.patch('/:id/status', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status) {
      sendError(res, 'Status is required.', 400);
      return;
    }
    const project = await LearningProjectService.updateProjectStatus(req.userId!, req.params.id as string, req.userRole!, status);
    sendSuccess(res, project, `Status updated to ${status}`);
  } catch (err: any) {
    logger.error('Failed to update project status:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/overview
 * Update course overview metadata
 */
router.put('/:id/overview', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await LearningProjectService.updateOverview(req.userId!, req.params.id as string, req.userRole!, req.body);
    sendSuccess(res, project, 'Course overview updated.');
  } catch (err: any) {
    logger.error('Failed to update overview:', err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/modules
 * Get modules (sections) and lessons
 */
router.get('/:id/modules', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const modules = await LearningProjectService.getModulesAndLessons(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, modules);
  } catch (err: any) {
    logger.error('Failed to get modules:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/sections
 * Add a new module / section
 */
router.post('/:id/sections', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const section = await LearningProjectService.createSection(req.userId!, req.params.id as string, req.userRole!, req.body);
    sendCreated(res, section, 'Module created successfully.');
  } catch (err: any) {
    logger.error('Failed to create section:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/sections/:sectionId
 * Update section
 */
router.put('/:id/sections/:sectionId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const section = await LearningProjectService.updateSection(req.userId!, req.params.id as string, req.params.sectionId as string, req.userRole!, req.body);
    sendSuccess(res, section, 'Module updated.');
  } catch (err: any) {
    logger.error('Failed to update section:', err);
    handleRouteError(res, err);
  }
});

/**
 * DELETE /api/v1/learning-projects/:id/sections/:sectionId
 * Delete section
 */
router.delete('/:id/sections/:sectionId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await LearningProjectService.deleteSection(req.userId!, req.params.id as string, req.params.sectionId as string, req.userRole!);
    sendSuccess(res, { deleted: true }, 'Module deleted.');
  } catch (err: any) {
    logger.error('Failed to delete section:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/lessons
 * Add a new lesson
 */
router.post('/:id/lessons', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await LearningProjectService.createLesson(req.userId!, req.params.id as string, req.userRole!, req.body);
    sendCreated(res, lesson, 'Lesson created successfully.');
  } catch (err: any) {
    logger.error('Failed to create lesson:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/lessons/:lessonId
 * Update a lesson
 */
router.put('/:id/lessons/:lessonId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await LearningProjectService.updateLesson(req.userId!, req.params.id as string, req.params.lessonId as string, req.userRole!, req.body);
    sendSuccess(res, lesson, 'Lesson updated.');
  } catch (err: any) {
    logger.error('Failed to update lesson:', err);
    handleRouteError(res, err);
  }
});

/**
 * DELETE /api/v1/learning-projects/:id/lessons/:lessonId
 * Delete a lesson
 */
router.delete('/:id/lessons/:lessonId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await LearningProjectService.deleteLesson(req.userId!, req.params.id as string, req.params.lessonId as string, req.userRole!);
    sendSuccess(res, { deleted: true }, 'Lesson deleted.');
  } catch (err: any) {
    logger.error('Failed to delete lesson:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/lessons/:lessonId/regenerate
 * Regenerate an individual lesson
 */
router.post('/:id/lessons/:lessonId/regenerate', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lesson = await LearningProjectService.regenerateLesson(req.userId!, req.params.id as string, req.params.lessonId as string, req.userRole!);
    sendSuccess(res, lesson, 'Lesson regenerated successfully.');
  } catch (err: any) {
    logger.error('Failed to regenerate lesson:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/reorder
 * Reorder sections and lessons
 */
router.post('/:id/reorder', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await LearningProjectService.reorderModulesAndLessons(req.userId!, req.params.id as string, req.userRole!, req.body);
    sendSuccess(res, result, 'Modules and lessons reordered successfully.');
  } catch (err: any) {
    logger.error('Failed to reorder:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/study-notes/:noteId
 * Update study note content
 */
router.put('/:id/study-notes/:noteId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const note = await LearningProjectService.updateStudyNote(req.userId!, req.params.id as string, req.params.noteId as string, req.userRole!, req.body);
    sendSuccess(res, note, 'Study note updated.');
  } catch (err: any) {
    logger.error('Failed to update study note:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/flashcards
 * Add flashcard
 */
router.post('/:id/flashcards', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const card = await LearningProjectService.addFlashcard(req.userId!, req.params.id as string, req.userRole!, req.body);
    sendCreated(res, card, 'Flashcard added.');
  } catch (err: any) {
    logger.error('Failed to add flashcard:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/flashcards/:flashcardId
 * Update flashcard
 */
router.put('/:id/flashcards/:flashcardId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const card = await LearningProjectService.updateFlashcard(req.userId!, req.params.id as string, req.params.flashcardId as string, req.userRole!, req.body);
    sendSuccess(res, card, 'Flashcard updated.');
  } catch (err: any) {
    logger.error('Failed to update flashcard:', err);
    handleRouteError(res, err);
  }
});

/**
 * DELETE /api/v1/learning-projects/:id/flashcards/:flashcardId
 * Delete flashcard
 */
router.delete('/:id/flashcards/:flashcardId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await LearningProjectService.deleteFlashcard(req.userId!, req.params.id as string, req.params.flashcardId as string, req.userRole!);
    sendSuccess(res, { deleted: true }, 'Flashcard deleted.');
  } catch (err: any) {
    logger.error('Failed to delete flashcard:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/questions
 * Add question
 */
router.post('/:id/questions', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const question = await LearningProjectService.addQuestion(req.userId!, req.params.id as string, req.userRole!, req.body);
    sendCreated(res, question, 'Question added to bank.');
  } catch (err: any) {
    logger.error('Failed to add question:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/questions/:questionId
 * Update question
 */
router.put('/:id/questions/:questionId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const question = await LearningProjectService.updateQuestion(req.userId!, req.params.id as string, req.params.questionId as string, req.userRole!, req.body);
    sendSuccess(res, question, 'Question updated.');
  } catch (err: any) {
    logger.error('Failed to update question:', err);
    handleRouteError(res, err);
  }
});

/**
 * DELETE /api/v1/learning-projects/:id/questions/:questionId
 * Delete question
 */
router.delete('/:id/questions/:questionId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await LearningProjectService.deleteQuestion(req.userId!, req.params.id as string, req.params.questionId as string, req.userRole!);
    sendSuccess(res, { deleted: true }, 'Question deleted.');
  } catch (err: any) {
    logger.error('Failed to delete question:', err);
    handleRouteError(res, err);
  }
});

/**
 * PUT /api/v1/learning-projects/:id/video-script/:videoAssetId
 * Update video script and chapters
 */
router.put('/:id/video-script/:videoAssetId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const video = await LearningProjectService.updateVideoScript(req.userId!, req.params.id as string, req.params.videoAssetId as string, req.userRole!, req.body);
    sendSuccess(res, video, 'Video script updated.');
  } catch (err: any) {
    logger.error('Failed to update video script:', err);
    handleRouteError(res, err);
  }
});

/**
 * POST /api/v1/learning-projects/:id/video-regenerate/:videoAssetId
 * Regenerate video lesson
 */
router.post('/:id/video-regenerate/:videoAssetId', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const video = await LearningProjectService.regenerateVideo(req.userId!, req.params.id as string, req.params.videoAssetId as string, req.userRole!);
    sendSuccess(res, video, 'Video regenerated successfully.');
  } catch (err: any) {
    logger.error('Failed to regenerate video:', err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/preview-student
 * Preview course as student (answers hidden)
 */
router.get('/:id/preview-student', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const preview = await LearningProjectService.getPreviewAsStudent(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, preview);
  } catch (err: any) {
    logger.error('Failed to generate student preview:', err);
    handleRouteError(res, err);
  }
});

/**
 * GET /api/v1/learning-projects/:id/generation-status
 * Get real generation stages and progress
 */
router.get('/:id/generation-status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await LearningProjectService.getGenerationStatus(req.userId!, req.params.id as string, req.userRole!);
    sendSuccess(res, status);
  } catch (err: any) {
    logger.error('Failed to get generation status:', err);
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
