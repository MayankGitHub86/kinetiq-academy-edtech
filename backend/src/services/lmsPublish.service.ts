import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import { Course, Section, Lesson, CourseStatus, CourseLevel, LessonType } from '../models/Course';
import { StudyNote, Flashcard, QuestionBankItem, PracticePaper, VideoAsset, AiContentJob, JobStatus } from '../models/AiLearning';
import { logger } from '../utils/logger';

export interface PublishPackageParams {
  jobId: string;
  instructorId: string;
  publishImmediately?: boolean;
}

export class LmsPublishService {
  /**
   * Publishes an approved AI Content Job into first-class LMS models in PostgreSQL
   */
  public static async publishCoursePackage(params: PublishPackageParams): Promise<Course> {
    const job = await AiContentJob.findByPk(params.jobId);
    if (!job) {
      throw new Error(`AI Content Job with ID ${params.jobId} not found.`);
    }

    const data = job.generatedData;
    if (!data || !data.analysis || !data.modules) {
      throw new Error('AI Content Job does not contain complete generated curriculum data.');
    }

    const { analysis, modules, studyNotes, flashcards, questions, practicePaper, videoAsset } = data;
    const courseTitle = analysis.topic || job.source?.title || 'Advanced Systems Architecture';
    
    // Generate unique slug (checking both active and soft-deleted courses)
    let baseSlug = slugify(courseTitle, { lower: true, strict: true }) || 'course';
    let slug = baseSlug;
    let counter = 1;
    while (await Course.findOne({ where: { slug }, paranoid: false })) {
      slug = `${baseSlug}-${counter++}`;
    }

    let totalLessonsCount = 0;
    let totalMinutes = 0;
    modules.forEach((m: any) => {
      (m.lessons || []).forEach((l: any) => {
        totalLessonsCount++;
        totalMinutes += l.durationMinutes || 20;
      });
    });

    const courseStatus = params.publishImmediately !== false ? CourseStatus.PUBLISHED : CourseStatus.DRAFT;
    const levelKey = (analysis.targetLevel || '').toLowerCase();
    const courseLevel = Object.values(CourseLevel).includes(levelKey as CourseLevel)
      ? (levelKey as CourseLevel)
      : CourseLevel.INTERMEDIATE;

    logger.info(`Publishing AI-generated course "${courseTitle}" (${slug}) to LMS...`);

    // 1. Create Course Record
    const course = await Course.create({
      id: uuidv4(),
      title: courseTitle,
      slug,
      shortDescription: `A comprehensive architectural masterclass covering ${courseTitle}, including deep explanations, practice assessments, and video instruction.`,
      description: analysis.suggestedOutline?.[0]?.description || `Deep dive into ${courseTitle}. Master core mental models, performance tradeoffs, and fault tolerance.`,
      instructorId: params.instructorId,
      status: courseStatus,
      level: courseLevel,
      category: analysis.category || 'Architecture & Systems',
      tags: [analysis.topic, 'AI Generated', 'Architecture', 'Engineering'],
      price: 0,
      isFree: true,
      totalDurationMinutes: totalMinutes,
      totalLessons: totalLessonsCount,
      learningObjectives: analysis.learningObjectives || [],
      prerequisites: analysis.prerequisites || [],
      targetAudience: ['Senior Engineers', 'Systems Architects', 'Full-Stack Developers'],
      publishedAt: courseStatus === CourseStatus.PUBLISHED ? new Date() : undefined,
      hasCertificate: true,
      thumbnailUrl: videoAsset?.thumbnailUrl || '/thumbnails/default_course.png',
      previewVideoUrl: videoAsset?.videoUrl || undefined,
    });

    // 2. Create Sections and Lessons
    let isFirstLesson = true;
    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
      const mod = modules[mIdx];
      const section = await Section.create({
        id: uuidv4(),
        courseId: course.id,
        title: mod.title || `Module ${mIdx + 1}`,
        description: mod.description || '',
        orderIndex: mIdx,
        isPublished: true,
      });

      const lessonsList = mod.lessons || [];
      for (let lIdx = 0; lIdx < lessonsList.length; lIdx++) {
        const les = lessonsList[lIdx];
        const resolvedVideoUrl = les.videoUrl || videoAsset?.videoUrl;
        const hasVideo = Boolean(resolvedVideoUrl);

        const lesson = await Lesson.create({
          id: uuidv4(),
          sectionId: section.id,
          courseId: course.id,
          title: les.title || `Lesson ${mIdx + 1}.${lIdx + 1}`,
          description: les.description || '',
          type: hasVideo ? LessonType.VIDEO : LessonType.ARTICLE,
          content: les.explanation || '',
          videoUrl: hasVideo ? resolvedVideoUrl : undefined,
          durationMinutes: les.durationMinutes || 15,
          orderIndex: lIdx,
          isFree: mIdx === 0 && lIdx === 0, // First lesson free preview
          isPublished: true,
          resources: [
            { name: 'Architecture Whitepaper', url: '#', type: 'pdf' },
            { name: 'Lesson Diagram (SVG)', url: '#', type: 'image' },
          ],
          metadata: {
            definitions: les.definitions,
            stepByStepExamples: les.stepByStepExamples,
            codeSnippets: les.codeSnippets,
            commonMistakes: les.commonMistakes,
            keyTakeaways: les.keyTakeaways,
            knowledgeCheckQuestions: les.knowledgeCheckQuestions,
          },
        });

        // Link video asset record to lesson
        if (hasVideo && resolvedVideoUrl) {
          await VideoAsset.create({
            id: uuidv4(),
            lessonId: lesson.id,
            courseId: course.id,
            title: les.title || lesson.title,
            videoUrl: resolvedVideoUrl,
            thumbnailUrl: videoAsset?.thumbnailUrl,
            durationSeconds: videoAsset?.durationSeconds || 44,
            videoStyle: videoAsset?.videoStyle || 'technical_whiteboard',
            script: videoAsset?.script || '',
            storyboard: videoAsset?.storyboard || [],
            captionsVtt: videoAsset?.captionsVtt || '',
            captionsVttUrl: videoAsset?.captionsVttUrl || (resolvedVideoUrl ? resolvedVideoUrl.replace(/\.mp4$/i, '.vtt') : undefined),
            transcript: videoAsset?.transcript || [],
            provider: 'scene_renderer',
            status: 'ready',
          });
        }

        isFirstLesson = false;
      }
    }

    // 3. Save Study Notes
    if (studyNotes) {
      await StudyNote.create({
        courseId: course.id,
        title: studyNotes.title || `${courseTitle} — Master Engineering Notes`,
        summary: studyNotes.summary || '',
        detailedNotes: studyNotes.detailedNotes || '',
        quickRevision: studyNotes.quickRevision || '',
        formulaSheet: studyNotes.formulaSheet || '',
        faq: studyNotes.faq || [],
        diagrams: studyNotes.diagrams || [],
      });
    }

    // 4. Save Flashcards
    if (Array.isArray(flashcards) && flashcards.length > 0) {
      for (const fc of flashcards) {
        await Flashcard.create({
          courseId: course.id,
          front: fc.front,
          back: fc.back,
          explanation: fc.explanation,
          difficulty: fc.difficulty || 'medium',
          topicTags: fc.topicTags || [courseTitle],
          intervalDays: 1,
          repetitions: 0,
          easeFactor: 2.5,
        });
      }
    }

    // 5. Save Question Bank & Practice Paper
    const createdQuestionIds: string[] = [];
    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const item = await QuestionBankItem.create({
          courseId: course.id,
          type: q.type || 'mcq',
          question: q.question,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          rubric: q.rubric || '',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          topic: q.topic || courseTitle,
          marks: q.marks || 2,
          estimatedMinutes: q.estimatedMinutes || 2,
          codeSnippet: q.codeSnippet,
        });
        createdQuestionIds.push(item.id);
      }

      // Create Practice Paper
      const paperTitle = practicePaper?.title || `${courseTitle} — Comprehensive Practice Assessment`;
      const paperInstructions = (practicePaper?.instructions && practicePaper.instructions.length > 0)
        ? practicePaper.instructions.join('\n')
        : `This timed examination evaluates your mastery of ${courseTitle}. Answer all questions within the allocated duration.`;

      await PracticePaper.create({
        courseId: course.id,
        title: paperTitle,
        instructions: paperInstructions,
        timeLimitMinutes: practicePaper?.durationMinutes || 60,
        totalMarks: practicePaper?.totalMarks || 100,
        passingScore: practicePaper?.passingScore || 70,
        negativeMarkingPercent: 0,
        questionIds: createdQuestionIds,
        markingScheme: practicePaper ? {
          sections: practicePaper.sections,
          instructions: practicePaper.instructions,
          passingScore: practicePaper.passingScore,
          evaluationRubric: 'Standardized grading rubric: Section A (MCQs: 30 Marks), Section B (Logic & Code: 35 Marks), Section C (Case Studies: 35 Marks).',
        } : undefined,
        isPublished: true,
      });
    }

    // 6. Update AiContentJob status
    await job.update({
      courseId: course.id,
      status: JobStatus.COMPLETED,
      stage: 'completed',
      progress: 100,
    });

    logger.info(`✅ Course "${course.title}" successfully published to LMS with ID: ${course.id}`);
    return course;
  }
}
