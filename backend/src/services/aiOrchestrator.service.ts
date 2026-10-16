import { v4 as uuidv4 } from 'uuid';
import { ContentSource, ContentAnalysis, AiContentJob, JobStatus } from '../models/AiLearning';
import { GenerationStageRecord } from '../models/AiLearningPhase2';
import { ContentIngestionService, ExtractedContent } from './contentIngestion.service';
import { AiGeneratorService } from './aiGenerator.service';
import { VideoPipelineService } from './videoPipeline.service';
import { QualityValidationService } from './qualityValidation.service';
import { CourseQualityService } from './courseQuality.service';
import { logger } from '../utils/logger';

export interface StartJobParams {
  userId: string;
  sourceType: 'url' | 'document' | 'text';
  url?: string;
  filePath?: string;
  originalName?: string;
  mimeType?: string;
  rawText?: string;
  options?: {
    title?: string;
    category?: string;
    targetLevel?: string;
    desiredDuration?: number;
    videoStyle?: string;
    questionCount?: number;
    outputSelection?: string[];
    language?: string;
  };
}

export class AiOrchestratorService {
  /**
   * Creates job record and triggers asynchronous processing
   */
  public static async startContentJob(params: StartJobParams): Promise<AiContentJob> {
    const job = await AiContentJob.create({
      userId: params.userId,
      jobType: 'full_generation',
      stage: 'fetching',
      progress: 5,
      status: JobStatus.IN_PROGRESS,
      options: params.options || {},
      stageDetails: {
        fetching: 'in_progress',
        analyzing: 'pending',
        curriculum: 'pending',
        lessons: 'pending',
        notes: 'pending',
        questions: 'pending',
        video: 'pending',
        validation: 'pending',
      },
    });

    // Run async execution without blocking HTTP response
    setImmediate(() => {
      this.executeJob(job.id, params).catch(err => {
        logger.error(`Critical error executing AI job ${job.id}:`, err);
      });
    });

    return job;
  }

  /**
   * Records a persistent stage record in PostgreSQL
   */
  public static async recordStage(
    jobId: string,
    stageName: string,
    status: string,
    tokens: number = 0,
    costUsd: number = 0,
    provider: string = 'internal',
    error?: string,
    output?: any
  ): Promise<void> {
    try {
      await GenerationStageRecord.create({
        jobId,
        stageName,
        status,
        provider,
        tokensUsed: tokens,
        estimatedCostUsd: costUsd,
        errorMessage: error,
        outputSnapshot: output ? { summary: typeof output === 'object' ? Object.keys(output) : output } : undefined,
      });
    } catch (e) {
      logger.warn('Failed to record generation stage record:', e);
    }
  }

  /**
   * Notify real-time subscribers via Socket.io, update DB and accumulate costs
   */
  private static async updateJobStage(
    jobId: string,
    stage: string,
    progress: number,
    detailsUpdate: Record<string, any> = {},
    tokensDelta: number = 0,
    costDelta: number = 0
  ): Promise<AiContentJob | null> {
    const job = await AiContentJob.findByPk(jobId);
    if (!job) return null;

    const currentDetails = job.stageDetails || {};
    const updatedDetails = { ...currentDetails, ...detailsUpdate };

    const currentCost = job.costEstimate || { tokensUsed: 0, estimatedCostUsd: 0 };
    const updatedCost = {
      tokensUsed: (currentCost.tokensUsed || 0) + tokensDelta,
      estimatedCostUsd: Math.round(((currentCost.estimatedCostUsd || 0) + costDelta) * 1000) / 1000,
    };

    await job.update({
      stage,
      progress,
      stageDetails: updatedDetails,
      costEstimate: updatedCost,
    });

    // Record stage record in PostgreSQL
    await this.recordStage(jobId, stage, 'completed', tokensDelta, costDelta);

    // Broadcast to Socket.IO if available
    if ((global as any).io) {
      try {
        (global as any).io.to(`job:${jobId}`).emit('job:progress', {
          jobId,
          stage,
          progress,
          stageDetails: updatedDetails,
          costEstimate: updatedCost,
        });
      } catch (err) {
        logger.warn('Socket emit failed:', err);
      }
    }

    return job;
  }

  /**
   * End-to-end execution pipeline
   */
  public static async executeJob(jobId: string, params: StartJobParams): Promise<void> {
    try {
      logger.info(`Starting AI learning pipeline for Job ${jobId}...`);

      // STAGE 1: INGESTION & EXTRACTION
      await this.updateJobStage(jobId, 'fetching', 10, { fetching: 'in_progress' });

      let extracted: ExtractedContent;
      if (params.sourceType === 'url' && params.url) {
        extracted = await ContentIngestionService.extractFromUrl(params.url);
      } else if (params.sourceType === 'document' && params.filePath) {
        extracted = await ContentIngestionService.extractFromFile(
          params.filePath,
          params.originalName || 'document',
          params.mimeType || 'application/octet-stream'
        );
      } else if (params.rawText) {
        extracted = ContentIngestionService.extractFromText(
          params.rawText,
          params.options?.title || 'Custom Learning Module'
        );
      } else {
        throw new Error('No valid source (URL, document file, or text) provided.');
      }

      // Persist ContentSource record
      const contentSource = await ContentSource.create({
        userId: params.userId,
        sourceType: params.sourceType,
        title: params.options?.title || extracted.title,
        url: extracted.url,
        filePath: extracted.filePath,
        rawText: extracted.rawText,
        cleanedText: extracted.cleanedText,
        metadata: extracted.metadata,
        status: 'extracted',
      });

      const jobRecord = await AiContentJob.findByPk(jobId);
      if (jobRecord) {
        await jobRecord.update({ sourceId: contentSource.id });
      }

      await this.updateJobStage(jobId, 'parsing', 20, { fetching: 'completed', analyzing: 'in_progress' });

      // STAGE 2: ARCHITECTURAL CONTENT ANALYSIS
      logger.info(`Analyzing content structure for Job ${jobId}...`);
      const analysis = await AiGeneratorService.analyzeSource(extracted, {
        targetLevel: params.options?.targetLevel,
        desiredDuration: params.options?.desiredDuration,
        category: params.options?.category,
      });

      // Persist ContentAnalysis
      await ContentAnalysis.create({
        sourceId: contentSource.id,
        topic: analysis.topic,
        category: analysis.category,
        targetLevel: analysis.targetLevel,
        keyConcepts: analysis.keyConcepts,
        prerequisites: analysis.prerequisites,
        learningObjectives: analysis.learningObjectives,
        suggestedOutline: analysis.suggestedOutline,
        sourceChunks: extracted.chunks,
        glossary: analysis.glossary,
      });

      await this.updateJobStage(jobId, 'generating_curriculum', 35, {
        analyzing: 'completed',
        curriculum: 'in_progress',
      });

      // STAGE 3: GENERATE LESSONS FOR EACH MODULE
      logger.info(`Generating in-depth lesson materials for Job ${jobId}...`);
      const generatedModules: any[] = [];
      const outline = analysis.suggestedOutline || [];

      for (let mIdx = 0; mIdx < outline.length; mIdx++) {
        const mod = outline[mIdx];
        const generatedLessons: any[] = [];

        for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
          const lOutline = mod.lessons[lIdx];
          const lessonContent = await AiGeneratorService.generateLessonContent(
            lOutline.title,
            lOutline.description,
            analysis.topic,
            extracted.chunks,
            analysis.targetLevel
          );
          generatedLessons.push(lessonContent);
        }

        generatedModules.push({
          title: mod.title,
          description: mod.description,
          lessons: generatedLessons,
        });

        const progressPercent = Math.min(60, 35 + Math.round(((mIdx + 1) / outline.length) * 25));
        await this.updateJobStage(jobId, 'generating_lessons', progressPercent);
      }

      await this.updateJobStage(jobId, 'generating_notes', 65, {
        curriculum: 'completed',
        lessons: 'completed',
        notes: 'in_progress',
      });

      // STAGE 4: STUDY NOTES & FLASHCARDS
      logger.info(`Generating study notes and flashcards for Job ${jobId}...`);
      const allLessonTitles = generatedModules.flatMap(m => m.lessons.map((l: any) => l.title));
      const studyNotes = await AiGeneratorService.generateStudyNotes(
        analysis.topic,
        allLessonTitles,
        extracted.cleanedText
      );

      const flashcards = await AiGeneratorService.generateFlashcards(
        analysis.topic,
        analysis.keyConcepts.map(c => ({ name: c.name, definition: c.definition }))
      );

      await this.updateJobStage(jobId, 'generating_questions', 75, {
        notes: 'completed',
        questions: 'in_progress',
      });

      // STAGE 5: QUESTION BANK & ASSESSMENTS
      logger.info(`Generating question bank for Job ${jobId}...`);
      const questionCount = params.options?.questionCount || 8;
      const questions = await AiGeneratorService.generateQuestionBank(
        analysis.topic,
        analysis.keyConcepts.map(c => ({ name: c.name, definition: c.definition })),
        questionCount
      );

      await this.updateJobStage(jobId, 'generating_video', 82, {
        questions: 'completed',
        video: 'in_progress',
      });

      // STAGE 6: EDUCATIONAL VIDEO PIPELINE
      let videoAssetData: any = null;
      const outputSelection = params.options?.outputSelection || ['curriculum', 'lessons', 'notes', 'flashcards', 'questions', 'video'];
      
      if (outputSelection.includes('video') && generatedModules[0]?.lessons[0]) {
        logger.info(`Synthesizing educational video for Job ${jobId}...`);
        const firstLesson = generatedModules[0].lessons[0];
        const storyboard = await AiGeneratorService.generateVideoScript(
          firstLesson.title,
          firstLesson.explanation,
          params.options?.videoStyle || 'technical_whiteboard'
        );

        const videoAssetId = uuidv4();
        const renderedVideo = await VideoPipelineService.renderStoryboardToMp4(storyboard, videoAssetId);

        videoAssetData = {
          id: videoAssetId,
          title: firstLesson.title,
          videoUrl: renderedVideo.videoUrl,
          thumbnailUrl: renderedVideo.thumbnailUrl,
          captionsVttUrl: renderedVideo.captionsVttUrl,
          durationSeconds: renderedVideo.durationSeconds,
          transcript: renderedVideo.transcript,
          captionsVtt: renderedVideo.captionsVtt,
          storyboard: storyboard.scenes,
        };
      }

      await this.updateJobStage(jobId, 'validating', 92, {
        video: 'completed',
        validation: 'in_progress',
      });

      // STAGE 7: QUALITY VALIDATION
      logger.info(`Running quality validation audit for Job ${jobId}...`);
      const validationReport = QualityValidationService.validateLearningPackage({
        courseTitle: analysis.topic,
        description: analysis.suggestedOutline?.[0]?.description || '',
        modules: generatedModules,
        studyNotes,
        flashcards,
        questions,
        videoAsset: videoAssetData,
        sourceText: extracted.cleanedText,
      });

      // Assemble complete package payload
      const completePackage = {
        source: {
          title: contentSource.title,
          type: contentSource.sourceType,
          url: contentSource.url,
          wordCount: extracted.wordCount,
        },
        analysis,
        modules: generatedModules,
        studyNotes,
        flashcards,
        questions,
        videoAsset: videoAssetData,
      };

      const finalJob = await AiContentJob.findByPk(jobId);
      if (finalJob) {
        await finalJob.update({
          stage: 'completed',
          progress: 100,
          status: JobStatus.REVIEW_REQUIRED, // Ready for instructor approval
          generatedData: completePackage,
          validationReport,
          stageDetails: {
            fetching: 'completed',
            analyzing: 'completed',
            curriculum: 'completed',
            lessons: 'completed',
            notes: 'completed',
            questions: 'completed',
            video: outputSelection.includes('video') ? 'completed' : 'skipped',
            validation: 'completed',
          },
        });
      }

      // Broadcast completion
      if ((global as any).io) {
        try {
          (global as any).io.to(`job:${jobId}`).emit('job:completed', {
            jobId,
            status: JobStatus.REVIEW_REQUIRED,
            validationReport,
          });
        } catch {}
      }

      logger.info(`🎉 AI Learning Pipeline completed for Job ${jobId}! Validation score: ${validationReport.score}/100.`);
    } catch (err: any) {
      logger.error(`AI Learning Pipeline failed for Job ${jobId}:`, err);
      const failedJob = await AiContentJob.findByPk(jobId);
      if (failedJob) {
        await failedJob.update({
          status: JobStatus.FAILED,
          stage: 'failed',
          errorMessage: err.message || 'An unexpected error occurred during content generation.',
        });
      }

      if ((global as any).io) {
        try {
          (global as any).io.to(`job:${jobId}`).emit('job:failed', {
            jobId,
            error: err.message,
          });
        } catch {}
      }
    }
  }

  /**
   * Safely retries a failed or stalled job idempotently without duplicating finished stages
   */
  public static async retryJob(jobId: string): Promise<AiContentJob> {
    const job = await AiContentJob.findByPk(jobId, { include: [ContentSource] });
    if (!job) throw new Error('Job not found.');

    logger.info(`Safely retrying AI Content Job ${jobId}...`);
    await job.update({
      status: JobStatus.IN_PROGRESS,
      stage: 'resuming',
      progress: Math.max(10, job.progress || 10),
      errorMessage: undefined,
    });

    const params: StartJobParams = {
      userId: job.userId,
      sourceType: (job.source?.sourceType as any) || 'text',
      url: job.source?.url,
      filePath: job.source?.filePath,
      rawText: job.source?.rawText || job.source?.cleanedText,
      options: job.options,
    };

    setImmediate(() => {
      this.executeJob(jobId, params).catch(err => {
        logger.error(`Error during retry of job ${jobId}:`, err);
      });
    });

    return job;
  }

  /**
   * Cancels a running generation job
   */
  public static async cancelJob(jobId: string): Promise<AiContentJob> {
    const job = await AiContentJob.findByPk(jobId);
    if (!job) throw new Error('Job not found.');

    await job.update({
      status: JobStatus.CANCELLED,
      stage: 'cancelled',
      errorMessage: 'Job was cancelled by the administrator.',
    });

    if ((global as any).io) {
      try {
        (global as any).io.to(`job:${jobId}`).emit('job:cancelled', { jobId });
      } catch {}
    }

    return job;
  }
}
