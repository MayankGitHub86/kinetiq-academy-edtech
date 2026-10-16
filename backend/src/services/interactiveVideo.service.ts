import { Course, Lesson, Enrollment, LessonProgress } from '../models/Course';
import { VideoAsset } from '../models/AiLearning';
import {
  VideoChapter, VideoCheckpoint, VideoCheckpointAttempt, VideoNote, VideoBookmark
} from '../models/AiLearningPhase2';
import { AiTutorService } from './aiTutor.service';
import { logger } from '../utils/logger';

export class InteractiveVideoService {
  /**
   * Generates or fetches chapters for a video asset / lesson
   */
  public static async getOrCreateChapters(lessonId: string, courseId: string): Promise<VideoChapter[]> {
    let chapters = await VideoChapter.findAll({
      where: { lessonId },
      order: [['startSeconds', 'ASC']],
    });

    if (chapters.length > 0) return chapters;

    // Generate chapters from VideoAsset storyboard or transcript
    const videoAsset = await VideoAsset.findOne({ where: { lessonId } });
    const lesson = await Lesson.findByPk(lessonId);

    if (videoAsset && Array.isArray(videoAsset.storyboard) && videoAsset.storyboard.length > 0) {
      let accumulatedTime = 0;
      for (let i = 0; i < videoAsset.storyboard.length; i++) {
        const sc = videoAsset.storyboard[i];
        const duration = sc.durationSeconds || 10;
        const chap = await VideoChapter.create({
          courseId,
          lessonId,
          videoAssetId: videoAsset.id,
          title: sc.title || `Chapter ${i + 1}: ${sc.sceneNumber || ''}`,
          startSeconds: accumulatedTime,
          endSeconds: accumulatedTime + duration,
          learningObjective: lesson?.title || 'Core Principles',
          keyConcepts: [sc.title, 'Architectural Pattern'],
        });
        chapters.push(chap);
        accumulatedTime += duration;
      }
    } else {
      // Default baseline chapters based on lesson metadata
      const defaultDuration = (lesson?.durationMinutes || 15) * 60;
      const c1 = await VideoChapter.create({
        courseId,
        lessonId,
        videoAssetId: videoAsset?.id,
        title: '1. Introduction & Context',
        startSeconds: 0,
        endSeconds: Math.floor(defaultDuration * 0.25),
        learningObjective: 'Foundational Context',
        keyConcepts: ['Overview', 'Invariants'],
      });
      const c2 = await VideoChapter.create({
        courseId,
        lessonId,
        videoAssetId: videoAsset?.id,
        title: '2. Deep Architectural Walkthrough',
        startSeconds: Math.floor(defaultDuration * 0.25),
        endSeconds: Math.floor(defaultDuration * 0.75),
        learningObjective: 'Mechanisms & State Machine',
        keyConcepts: ['State Mutation', 'Safety'],
      });
      const c3 = await VideoChapter.create({
        courseId,
        lessonId,
        videoAssetId: videoAsset?.id,
        title: '3. Failure Modes & Summary',
        startSeconds: Math.floor(defaultDuration * 0.75),
        endSeconds: defaultDuration,
        learningObjective: 'Fault Tolerance & Takeaways',
        keyConcepts: ['Recovery', 'Synthesis'],
      });
      chapters = [c1, c2, c3];
    }

    return chapters;
  }

  /**
   * Generates or fetches interactive checkpoints for a video lesson
   */
  public static async getOrCreateCheckpoints(lessonId: string, courseId: string): Promise<VideoCheckpoint[]> {
    let checkpoints = await VideoCheckpoint.findAll({
      where: { lessonId },
      order: [['timestampSeconds', 'ASC']],
    });

    if (checkpoints.length > 0) return checkpoints;

    const lesson = await Lesson.findByPk(lessonId);
    const videoAsset = await VideoAsset.findOne({ where: { lessonId } });
    const videoDuration = videoAsset?.durationSeconds || 32;

    // Place checkpoints at 35% and 75% of video
    const t1 = Math.max(5, Math.floor(videoDuration * 0.35));
    const t2 = Math.max(12, Math.floor(videoDuration * 0.75));

    const cp1 = await VideoCheckpoint.create({
      courseId,
      lessonId,
      videoAssetId: videoAsset?.id,
      timestampSeconds: t1,
      questionType: 'mcq',
      prompt: `Checkpoint 1: In ${lesson?.title || 'this lesson'}, what is the primary prerequisite before mutating cluster state?`,
      options: [
        { id: 'A', text: 'Obtain majority quorum acknowledgment from followers' },
        { id: 'B', text: 'Immediately notify client without persistent disk write' },
        { id: 'C', text: 'Force an instant leadership re-election' },
      ],
      correctAnswer: 'A',
      explanation: 'State changes must be durably replicated to a quorum of nodes before being committed.',
      pauseUntilAnswered: true,
    });

    const cp2 = await VideoCheckpoint.create({
      courseId,
      lessonId,
      videoAssetId: videoAsset?.id,
      timestampSeconds: t2,
      questionType: 'code_prediction',
      prompt: 'Checkpoint 2: What happens if a network partition isolates the leader with only a minority of nodes?',
      options: [
        { id: 'A', text: 'The isolated leader cannot achieve quorum and transitions to follower upon partition healing' },
        { id: 'B', text: 'The cluster continues writing on both sides concurrently' },
        { id: 'C', text: 'All nodes crash immediately' },
      ],
      correctAnswer: 'A',
      explanation: 'Raft prevents split-brain by requiring majority quorum; the minority partition cannot commit new logs.',
      pauseUntilAnswered: true,
    });

    return [cp1, cp2];
  }

  /**
   * Evaluates student checkpoint answer and records attempt
   */
  public static async submitCheckpointAnswer(params: {
    checkpointId: string;
    userId: string;
    selectedAnswer: string;
  }) {
    const cp = await VideoCheckpoint.findByPk(params.checkpointId);
    if (!cp) throw new Error('Checkpoint not found.');

    const isCorrect = String(params.selectedAnswer).trim().toUpperCase() === String(cp.correctAnswer).trim().toUpperCase();

    const attempt = await VideoCheckpointAttempt.create({
      checkpointId: cp.id,
      userId: params.userId,
      selectedAnswer: params.selectedAnswer,
      isCorrect,
    });

    return {
      attemptId: attempt.id,
      isCorrect,
      explanation: cp.explanation,
      correctAnswer: cp.correctAnswer,
    };
  }

  /**
   * AI "Explain this moment" in the video
   */
  public static async explainMoment(params: {
    courseId: string;
    lessonId: string;
    timestampSeconds: number;
    nearbyTranscript?: string;
  }) {
    const { courseId, lessonId, timestampSeconds, nearbyTranscript } = params;

    let transcriptContext = nearbyTranscript;
    if (!transcriptContext) {
      const videoAsset = await VideoAsset.findOne({ where: { lessonId } });
      if (videoAsset?.transcript) {
        const nearby = videoAsset.transcript.filter(
          t => Math.abs(t.start - timestampSeconds) <= 15
        );
        transcriptContext = nearby.map(n => n.text).join(' ');
      }
    }

    const prompt = `The student is watching the video at timestamp ${Math.floor(timestampSeconds)} seconds and asks: "Explain what is happening in this moment."
Spoken dialogue/transcript at this moment: "${transcriptContext || 'Key architectural demonstration'}"
Please provide a clear, concise (2-3 paragraphs) pedagogical breakdown explaining the mechanism, why it matters, and a practical mental model.`;

    const answer = await AiTutorService.answerStudentQuery({
      courseId,
      lessonId,
      query: prompt,
      videoTimestamp: timestampSeconds,
    });

    return {
      timestamp: timestampSeconds,
      explanation: answer.answer,
      sources: answer.sources,
      suggestedFollowUps: answer.suggestedFollowUps,
    };
  }

  /**
   * Video Notes CRUD
   */
  public static async addNote(userId: string, courseId: string, lessonId: string, timestampSeconds: number, noteText: string): Promise<VideoNote> {
    return VideoNote.create({ userId, courseId, lessonId, timestampSeconds, noteText });
  }

  public static async getNotes(userId: string, lessonId: string): Promise<VideoNote[]> {
    return VideoNote.findAll({ where: { userId, lessonId }, order: [['timestampSeconds', 'ASC']] });
  }

  public static async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const deleted = await VideoNote.destroy({ where: { id: noteId, userId } });
    return deleted > 0;
  }

  /**
   * Video Bookmarks CRUD
   */
  public static async addBookmark(userId: string, courseId: string, lessonId: string, timestampSeconds: number, label: string): Promise<VideoBookmark> {
    return VideoBookmark.create({ userId, courseId, lessonId, timestampSeconds, label: label || `Bookmark @ ${Math.floor(timestampSeconds)}s` });
  }

  public static async getBookmarks(userId: string, lessonId: string): Promise<VideoBookmark[]> {
    return VideoBookmark.findAll({ where: { userId, lessonId }, order: [['timestampSeconds', 'ASC']] });
  }

  public static async deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    const deleted = await VideoBookmark.destroy({ where: { id: bookmarkId, userId } });
    return deleted > 0;
  }

  /**
   * Tracks playback watch time and verifies genuine completion
   */
  public static async trackVideoProgress(params: {
    userId: string;
    courseId: string;
    lessonId: string;
    watchedSeconds: number;
    totalDurationSeconds: number;
  }) {
    const { userId, courseId, lessonId, watchedSeconds, totalDurationSeconds } = params;
    const watchRatio = totalDurationSeconds > 0 ? (watchedSeconds / totalDurationSeconds) : 0;
    const isCompleted = watchRatio >= 0.8; // Genuine 80% threshold

    const [progress] = await LessonProgress.findOrCreate({
      where: { userId, lessonId },
      defaults: {
        userId,
        lessonId,
        courseId,
        isCompleted: false,
        watchedSeconds,
      },
    });

    await progress.update({
      isCompleted: isCompleted || progress.isCompleted,
      watchedSeconds: Math.max(progress.watchedSeconds || 0, watchedSeconds),
      completedAt: (isCompleted && !progress.completedAt) ? new Date() : progress.completedAt,
    });

    return {
      lessonId,
      watchedSeconds,
      watchRatio: Math.round(watchRatio * 100),
      isCompleted: progress.isCompleted,
    };
  }
}
