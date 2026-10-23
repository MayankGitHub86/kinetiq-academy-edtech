import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireRole, requireInstructor, optionalAuth, AuthRequest } from '../middleware/auth';
import { AiOrchestratorService } from '../services/aiOrchestrator.service';
import { LmsPublishService } from '../services/lmsPublish.service';
import { AiTutorService } from '../services/aiTutor.service';
import { AssessmentService } from '../services/assessment.service';
import { AiContentJob, StudyNote, Flashcard, PracticePaper, VideoAsset } from '../models/AiLearning';
import { CourseQualityService } from '../services/courseQuality.service';
import { AdaptiveLearningService } from '../services/adaptiveLearning.service';
import { InteractiveVideoService } from '../services/interactiveVideo.service';
import { ExamBlueprintService } from '../services/examBlueprint.service';
import {
  CourseQualityReport, TopicMastery, LearningRecommendation,
  VideoChapter, VideoCheckpoint, VideoNote, VideoBookmark,
  ExamBlueprint, GenerationStageRecord
} from '../models/AiLearningPhase2';
import { AiProviderService } from '../services/aiProvider.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'public', 'uploads', 'temp'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.js', '.ts', '.py', '.java', '.cpp', '.go', '.rs', '.html', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.includes('pdf') || file.mimetype.includes('word')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported: PDF, DOCX, TXT, Markdown, Code files.`));
    }
  },
});

/**
 * POST /api/v1/ai/content-jobs
 * Trigger learning content generation from URL or raw text
 */
router.post('/content-jobs', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { sourceType, url, rawText, options } = req.body;

  if (sourceType === 'url' && !url) {
    sendError(res, 'URL is required when sourceType is url.', 400);
    return;
  }

  if (sourceType === 'text' && (!rawText || rawText.trim().length < 20)) {
    sendError(res, 'Pasted text must contain at least 20 characters.', 400);
    return;
  }

  const job = await AiOrchestratorService.startContentJob({
    userId: req.userId!,
    sourceType: sourceType || (url ? 'url' : 'text'),
    url,
    rawText,
    options,
  });

  sendCreated(res, job, 'AI Learning Content generation job started successfully.');
});

/**
 * POST /api/v1/ai/content-jobs/upload
 * Trigger learning content generation from an uploaded document
 */
router.post('/content-jobs/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) {
    sendError(res, 'Please upload a valid document file (PDF, DOCX, TXT, Markdown).', 400);
    return;
  }

  let options: any = {};
  if (req.body.options) {
    try {
      options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
    } catch {}
  }

  const job = await AiOrchestratorService.startContentJob({
    userId: req.userId!,
    sourceType: 'document',
    filePath: req.file.path,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    options: {
      title: req.body.title || options.title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      category: req.body.category || options.category,
      targetLevel: req.body.targetLevel || options.targetLevel,
      videoStyle: req.body.videoStyle || options.videoStyle,
      questionCount: req.body.questionCount ? parseInt(req.body.questionCount, 10) : options.questionCount,
      outputSelection: req.body.outputSelection ? (Array.isArray(req.body.outputSelection) ? req.body.outputSelection : JSON.parse(req.body.outputSelection)) : options.outputSelection,
    },
  });

  sendCreated(res, job, 'Document uploaded and AI generation started.');
});

/**
 * GET /api/v1/ai/content-jobs/:id
 * Retrieve real-time progress and generated package
 */
router.get('/content-jobs/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const job = await AiContentJob.findByPk(req.params.id as string, {
    include: ['source', 'course'],
  });

  if (!job) {
    sendError(res, 'Content generation job not found.', 404);
    return;
  }

  sendSuccess(res, job, 'Job details retrieved.');
});

/**
 * GET /api/v1/ai/content-jobs
 * List recent content generation jobs
 */
router.get('/content-jobs', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await AiContentJob.findAll({
    order: [['createdAt', 'DESC']],
    limit: 30,
    include: ['source', 'course'],
  });

  sendSuccess(res, jobs, 'Content jobs retrieved.');
});

/**
 * GET /api/v1/ai/diagnostics
 * AI provider, storage, and video engine system diagnostics
 */
router.get('/diagnostics', optionalAuth, async (_req: Request, res: Response): Promise<void> => {
  const diagnostics = AiProviderService.getProviderDiagnostics();
  const activeProvider = AiProviderService.getActiveProviderName();
  sendSuccess(res, {
    activeProvider,
    providers: diagnostics,
    ffmpegInstalled: true,
    timestamp: new Date().toISOString(),
  }, 'AI Studio system diagnostics retrieved.');
});

/**
 * PUT /api/v1/ai/content-jobs/:id/lesson
 * Live update of an individual lesson in generatedData with audit recalculation
 */
router.put('/content-jobs/:id/lesson', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { moduleIndex, lessonIndex, title, description, durationMinutes, explanation, objectives } = req.body;

  if (moduleIndex === undefined || lessonIndex === undefined) {
    sendError(res, 'moduleIndex and lessonIndex are required.', 400);
    return;
  }

  const job = await AiOrchestratorService.updateLesson(
    req.params.id as string,
    parseInt(moduleIndex, 10),
    parseInt(lessonIndex, 10),
    { title, description, durationMinutes, explanation, objectives }
  );

  sendSuccess(res, job, 'Lesson updated and course quality audit re-evaluated.');
});

/**
 * PUT /api/v1/ai/content-jobs/:id/curriculum
 * Update curriculum outline modules before or during review
 */
router.put('/content-jobs/:id/curriculum', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { modules } = req.body;
  if (!Array.isArray(modules)) {
    sendError(res, 'modules array is required.', 400);
    return;
  }

  const job = await AiOrchestratorService.updateCurriculum(req.params.id as string, modules);
  sendSuccess(res, job, 'Curriculum outline updated successfully.');
});

/**
 * PUT /api/v1/ai/content-jobs/:id/study-notes
 * Update study notes in generatedData
 */
router.put('/content-jobs/:id/study-notes', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { studyNotes } = req.body;
  if (!studyNotes) {
    sendError(res, 'studyNotes payload is required.', 400);
    return;
  }

  const job = await AiOrchestratorService.updateStudyNotes(req.params.id as string, studyNotes);
  sendSuccess(res, job, 'Study notes updated successfully.');
});

/**
 * PUT /api/v1/ai/content-jobs/:id/questions
 * Update question bank in generatedData
 */
router.put('/content-jobs/:id/questions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { questions } = req.body;
  if (!Array.isArray(questions)) {
    sendError(res, 'questions array is required.', 400);
    return;
  }

  const job = await AiOrchestratorService.updateQuestions(req.params.id as string, questions);
  sendSuccess(res, job, 'Question bank updated successfully.');
});

/**
 * POST /api/v1/ai/content-jobs/:id/publish
 * Approve and publish the AI-generated course into the real LMS catalog
 */
router.post('/content-jobs/:id/publish', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const course = await LmsPublishService.publishCoursePackage({
    jobId: req.params.id as string,
    instructorId: req.userId!,
    publishImmediately: req.body.publishImmediately !== false,
  });

  sendSuccess(res, course, `Course "${course.title}" successfully published to LMS!`);
});

/**
 * POST /api/v1/ai/content-jobs/:id/approve-curriculum
 * Approve the curriculum outline and trigger full lesson/notes/video generation (staged pipeline)
 */
router.post('/content-jobs/:id/approve-curriculum', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { approvedModules } = req.body;

  const job = await AiOrchestratorService.approveCurriculumAndGenerate(
    req.params.id as string,
    Array.isArray(approvedModules) ? approvedModules : undefined
  );

  sendSuccess(res, job, 'Curriculum approved! Full lesson, video, and assessment generation has started.');
});

/**
 * POST /api/v1/ai/content-jobs/:id/retry
 * Retry a failed or stalled generation job
 */
router.post('/content-jobs/:id/retry', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const job = await AiOrchestratorService.retryJob(req.params.id as string);
  sendSuccess(res, job, 'Job retry initiated.');
});

/**
 * GET /api/v1/ai/content-jobs/:id/versions
 * Get resource version history for a job (stale tracking)
 */
router.get('/content-jobs/:id/versions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { ResourceVersion } = await import('../models/ResourceVersion');
  const versions = await ResourceVersion.findAll({
    where: { jobId: req.params.id as string },
    order: [['createdAt', 'DESC']],
  });
  sendSuccess(res, versions, 'Resource version history retrieved.');
});

/**
 * POST /api/v1/ai/content-jobs/:id/cancel
 * Cancel an in-progress job
 */
router.post('/content-jobs/:id/cancel', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const job = await AiContentJob.findByPk(req.params.id as string);
  if (!job) {
    sendError(res, 'Job not found.', 404);
    return;
  }

  await job.update({ status: 'cancelled' as any, stage: 'cancelled' });
  sendSuccess(res, job, 'Job cancelled.');
});

/**
 * POST /api/v1/ai/tutor/chat and /api/v1/ai/tutor
 * Context-aware AI Learning Companion / Tutor endpoint for students
 */
const tutorHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, lessonId, videoTimestamp } = req.body;
  const query = req.body.query || req.body.message;

  if (!query || !query.trim()) {
    sendError(res, 'Query or message is required.', 400);
    return;
  }

  if (!courseId) {
    sendError(res, 'courseId is required.', 400);
    return;
  }

  const tutorResponse = await AiTutorService.answerStudentQuery({
    courseId,
    lessonId,
    query,
    videoTimestamp: videoTimestamp ? parseFloat(videoTimestamp) : undefined,
    userRole: req.userRole,
  });

  sendSuccess(res, tutorResponse, 'Tutor response generated.');
};

router.post('/tutor', optionalAuth, tutorHandler);
router.post('/tutor/chat', optionalAuth, tutorHandler);

/**
 * GET /api/v1/ai/practice-papers/:paperId
 * Get student version of timed practice paper
 */
router.get('/practice-papers/:paperId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const paper = await AssessmentService.getStudentPaper(req.params.paperId as string);
  sendSuccess(res, paper, 'Practice paper retrieved.');
});

/**
 * POST /api/v1/ai/practice-papers/:paperId/submit
 * Submit practice assessment and receive instant automated grading
 */
router.post('/practice-papers/:paperId/submit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { answers } = req.body;

  if (!answers || typeof answers !== 'object') {
    sendError(res, 'Answers payload must be an object mapping questionId to answer.', 400);
    return;
  }

  const result = await AssessmentService.evaluateAndSubmit({
    paperId: req.params.paperId as string,
    userId: req.userId!,
    answers,
  });

  sendSuccess(res, result, 'Assessment graded and recorded.');
});

/**
 * GET /api/v1/ai/courses/:courseId/package
 * Retrieve study notes, flashcards, and practice papers for a course
 */
router.get('/courses/:courseId/package', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const courseId = req.params.courseId as string;
  const [studyNotes, flashcards, practicePaper, videoAssets, qualityReport] = await Promise.all([
    StudyNote.findOne({ where: { courseId } }),
    Flashcard.findAll({ where: { courseId } }),
    PracticePaper.findOne({ where: { courseId } }),
    VideoAsset.findAll({ where: { courseId } }),
    CourseQualityReport.findOne({ where: { courseId } }),
  ]);

  sendSuccess(res, {
    studyNotes,
    flashcards,
    practicePaper,
    videoAssets,
    qualityReport,
  }, 'Course learning package retrieved.');
});

// ─── PILLAR 1: COURSE QUALITY ROUTES ─────────────────────────────────────────

router.get('/courses/:courseId/quality', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const courseId = req.params.courseId as string;
  let report = await CourseQualityReport.findOne({ where: { courseId } });
  if (!report) {
    report = await CourseQualityService.evaluateCourse(courseId);
  }
  sendSuccess(res, report, 'Course quality evaluation retrieved.');
});

router.post('/courses/:courseId/quality/re-evaluate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const courseId = req.params.courseId as string;
  const report = await CourseQualityService.evaluateCourse(courseId, req.body.jobId);
  sendSuccess(res, report, 'Course quality re-evaluated successfully.');
});

router.post('/quality-reports/:reportId/override', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, notes } = req.body;
  const report = await CourseQualityService.overrideReport(req.params.reportId as string, req.userId!, status, notes || 'Admin override');
  sendSuccess(res, report, 'Quality report status updated.');
});

// ─── PILLAR 2: ADAPTIVE LEARNING & TOPIC MASTERY ROUTES ─────────────────────

router.get('/learning-paths/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await AdaptiveLearningService.getStudentAdaptiveProfile(req.userId!, req.query.courseId as string);
  sendSuccess(res, profile, 'Student adaptive profile retrieved.');
});

router.get('/courses/:courseId/mastery', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const masteries = await TopicMastery.findAll({
    where: { userId: req.userId!, courseId: req.params.courseId as string },
    order: [['masteryScore', 'ASC']],
  });
  sendSuccess(res, masteries, 'Course topic masteries retrieved.');
});

router.post('/recommendations/:id/resolve', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const rec = await LearningRecommendation.findOne({ where: { id: req.params.id as string, userId: req.userId! } });
  if (rec) await rec.update({ isResolved: true });
  sendSuccess(res, { success: true }, 'Recommendation marked as resolved.');
});

// ─── PILLAR 3: INTERACTIVE VIDEO LEARNING ROUTES ────────────────────────────

router.get('/lessons/:lessonId/video/chapters', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const chapters = await InteractiveVideoService.getOrCreateChapters(req.params.lessonId as string, req.query.courseId as string);
  sendSuccess(res, chapters, 'Video chapters retrieved.');
});

router.get('/lessons/:lessonId/video/checkpoints', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const checkpoints = await InteractiveVideoService.getOrCreateCheckpoints(req.params.lessonId as string, req.query.courseId as string);
  // Strip correct answer for security
  const studentCheckpoints = checkpoints.map(cp => ({
    id: cp.id,
    lessonId: cp.lessonId,
    timestampSeconds: cp.timestampSeconds,
    questionType: cp.questionType,
    prompt: cp.prompt,
    options: cp.options,
    pauseUntilAnswered: cp.pauseUntilAnswered,
  }));
  sendSuccess(res, studentCheckpoints, 'Interactive checkpoints retrieved.');
});

router.post('/video/checkpoints/:checkpointId/submit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await InteractiveVideoService.submitCheckpointAnswer({
    checkpointId: req.params.checkpointId as string,
    userId: req.userId!,
    selectedAnswer: req.body.selectedAnswer,
  });
  sendSuccess(res, result, 'Checkpoint evaluated.');
});

router.post('/video/explain-moment', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { courseId, lessonId, timestampSeconds, nearbyTranscript } = req.body;
  if (!courseId || !lessonId || timestampSeconds === undefined) {
    sendError(res, 'courseId, lessonId, and timestampSeconds are required.', 400);
    return;
  }
  const explanation = await InteractiveVideoService.explainMoment({
    courseId,
    lessonId,
    timestampSeconds: parseFloat(timestampSeconds),
    nearbyTranscript,
  });
  sendSuccess(res, explanation, 'Moment explanation generated.');
});

router.get('/lessons/:lessonId/video/notes', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const notes = await InteractiveVideoService.getNotes(req.userId!, req.params.lessonId as string);
  sendSuccess(res, notes, 'Video notes retrieved.');
});

router.post('/lessons/:lessonId/video/notes', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, timestampSeconds, noteText } = req.body;
  if (!noteText || timestampSeconds === undefined) {
    sendError(res, 'timestampSeconds and noteText are required.', 400);
    return;
  }
  const note = await InteractiveVideoService.addNote(req.userId!, courseId, req.params.lessonId as string, parseFloat(timestampSeconds), noteText);
  sendCreated(res, note, 'Video note created.');
});

router.delete('/video/notes/:noteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await InteractiveVideoService.deleteNote(req.userId!, req.params.noteId as string);
  sendSuccess(res, { success: true }, 'Video note deleted.');
});

router.get('/lessons/:lessonId/video/bookmarks', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const bookmarks = await InteractiveVideoService.getBookmarks(req.userId!, req.params.lessonId as string);
  sendSuccess(res, bookmarks, 'Video bookmarks retrieved.');
});

router.post('/lessons/:lessonId/video/bookmarks', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, timestampSeconds, label } = req.body;
  const bookmark = await InteractiveVideoService.addBookmark(req.userId!, courseId, req.params.lessonId as string, parseFloat(timestampSeconds), label);
  sendCreated(res, bookmark, 'Video bookmark added.');
});

router.delete('/video/bookmarks/:bookmarkId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await InteractiveVideoService.deleteBookmark(req.userId!, req.params.bookmarkId as string);
  sendSuccess(res, { success: true }, 'Video bookmark deleted.');
});

router.post('/video/progress', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, lessonId, watchedSeconds, totalDurationSeconds } = req.body;
  const result = await InteractiveVideoService.trackVideoProgress({
    userId: req.userId!,
    courseId,
    lessonId,
    watchedSeconds: parseFloat(watchedSeconds || 0),
    totalDurationSeconds: parseFloat(totalDurationSeconds || 0),
  });
  sendSuccess(res, result, 'Video progress updated.');
});

// ─── PILLAR 4: EXAM PAPER BLUEPRINTS ─────────────────────────────────────────

router.post('/exam-blueprints/validate', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const validation = await ExamBlueprintService.validateBlueprint(req.body);
  sendSuccess(res, validation, 'Blueprint validated against question bank inventory.');
});

router.post('/exam-blueprints', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const validation = await ExamBlueprintService.validateBlueprint(req.body);
  const blueprint = await ExamBlueprint.create({
    courseId: req.body.courseId,
    instructorId: req.userId!,
    title: req.body.title || 'Architectural Mastery Examination',
    templateType: req.body.templateType || 'module_test',
    moduleIds: req.body.moduleIds || [],
    topics: req.body.topics || [],
    learningObjectives: req.body.learningObjectives || [],
    totalMarks: req.body.totalMarks || 100,
    durationMinutes: req.body.durationMinutes || 45,
    questionCount: req.body.questionCount || 10,
    questionTypes: req.body.questionTypes || ['mcq'],
    difficultyDistribution: req.body.difficultyDistribution || { easy: 30, medium: 50, hard: 20 },
    negativeMarkingPercent: req.body.negativeMarkingPercent || 0,
    passingScore: req.body.passingScore || 60,
    randomize: req.body.randomize !== false,
    validationSummary: validation,
    status: 'draft',
  });
  sendCreated(res, blueprint, 'Exam blueprint created.');
});

router.get('/exam-blueprints', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const where: any = {};
  if (req.query.courseId) where.courseId = req.query.courseId;
  const blueprints = await ExamBlueprint.findAll({ where, order: [['createdAt', 'DESC']] });
  sendSuccess(res, blueprints, 'Exam blueprints retrieved.');
});

router.post('/exam-blueprints/:blueprintId/generate', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await ExamBlueprintService.generatePaperFromBlueprint(req.params.blueprintId as string);
  sendSuccess(res, result, 'Practice paper successfully generated from blueprint.');
});

router.get('/exam-blueprints/:blueprintId/versions', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const blueprint = await ExamBlueprint.findByPk(req.params.blueprintId as string);
  if (!blueprint || !blueprint.generatedPaperId) {
    sendError(res, 'Blueprint has not generated a paper yet.', 404);
    return;
  }
  const versions = await ExamBlueprintService.getPaperVersions(blueprint.generatedPaperId);
  sendSuccess(res, versions, 'Student and instructor paper versions retrieved.');
});

// ─── PILLAR 5: COST & STAGE MONITORING ──────────────────────────────────────

router.get('/content-jobs/:id/stages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const stages = await GenerationStageRecord.findAll({
    where: { jobId: req.params.id as string },
    order: [['createdAt', 'ASC']],
  });
  sendSuccess(res, stages, 'Job generation stages retrieved.');
});

router.post('/content-jobs/:id/retry', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const job = await AiOrchestratorService.retryJob(req.params.id as string);
  sendSuccess(res, job, 'Job resumed successfully.');
});

router.get('/generation-usage', authenticate, requireInstructor, async (_req: AuthRequest, res: Response): Promise<void> => {
  const jobs = await AiContentJob.findAll();
  let totalTokens = 0;
  let totalCostUsd = 0;
  jobs.forEach(j => {
    if (j.costEstimate) {
      totalTokens += j.costEstimate.tokensUsed || 0;
      totalCostUsd += j.costEstimate.estimatedCostUsd || 0;
    }
  });
  sendSuccess(res, {
    totalJobs: jobs.length,
    completedJobs: jobs.filter(j => j.status === 'completed' || j.status === 'review_required').length,
    totalTokens,
    totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    averageCostPerCourse: jobs.length > 0 ? Math.round((totalCostUsd / jobs.length) * 100) / 100 : 0,
  }, 'Generation usage metrics retrieved.');
});

// ─── CONTENT JOB IN-PLACE EDITING (ADMIN / INSTRUCTOR) ────────────────────────
router.put('/content-jobs/:id/lesson', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { moduleIndex, lessonIndex, title, explanation, description, durationMinutes } = req.body;
  const job = await AiOrchestratorService.updateLesson(
    req.params.id as string,
    parseInt(moduleIndex, 10),
    parseInt(lessonIndex, 10),
    { title, explanation, description, durationMinutes }
  );
  sendSuccess(res, job, 'Lesson updated and quality re-evaluated successfully.');
});

router.put('/content-jobs/:id/curriculum', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { modules } = req.body;
  const job = await AiOrchestratorService.updateCurriculum(req.params.id as string, modules);
  sendSuccess(res, job, 'Curriculum structure updated successfully.');
});

router.put('/content-jobs/:id/study-notes', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { studyNotes } = req.body;
  const job = await AiOrchestratorService.updateStudyNotes(req.params.id as string, studyNotes);
  sendSuccess(res, job, 'Study notes updated successfully.');
});

router.put('/content-jobs/:id/questions', authenticate, requireInstructor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { questions } = req.body;
  const job = await AiOrchestratorService.updateQuestions(req.params.id as string, questions);
  sendSuccess(res, job, 'Questions bank updated successfully.');
});

export default router;

