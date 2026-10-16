import { QuizAttempt, QuizAttemptStatus, Notification, NotificationType } from '../models/Transaction';
import { Lesson, LessonType } from '../models/Course';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface QuizSubmission {
  lessonId: string;
  answers: Record<string, number>; // { questionId: selectedOptionIndex }
  timeTakenSeconds?: number;
}

class QuizService {
  /**
   * Start a quiz attempt.
   */
  async startAttempt(userId: string, lessonId: string): Promise<QuizAttempt> {
    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson) throw createError('Lesson not found', 404);
    if (lesson.type !== LessonType.QUIZ) throw createError('This lesson is not a quiz', 400);

    // Cancel any existing in-progress attempt
    await QuizAttempt.update(
      { status: QuizAttemptStatus.ABANDONED },
      { where: { userId, lessonId, status: QuizAttemptStatus.IN_PROGRESS } }
    );

    const attempt = await QuizAttempt.create({
      userId,
      lessonId,
      status: QuizAttemptStatus.IN_PROGRESS,
    });

    return attempt;
  }

  /**
   * Submit quiz answers and score the attempt.
   */
  async submitQuiz(userId: string, attemptId: string, submission: QuizSubmission) {
    const attempt = await QuizAttempt.findOne({ where: { id: attemptId, userId } });
    if (!attempt) throw createError('Quiz attempt not found', 404);
    if (attempt.status !== QuizAttemptStatus.IN_PROGRESS) {
      throw createError('This quiz attempt has already been completed', 400);
    }

    const lesson = await Lesson.findByPk(attempt.lessonId);
    if (!lesson) throw createError('Lesson not found', 404);

    // Parse quiz questions from lesson content/metadata
    const questions: QuizQuestion[] = lesson.metadata?.questions || [];
    const totalQuestions = questions.length;

    if (totalQuestions === 0) {
      throw createError('This quiz has no questions configured', 500);
    }

    // Score the answers
    let correctCount = 0;
    const results: Record<string, { selected: number; correct: number; isCorrect: boolean; explanation?: string }> = {};

    for (const question of questions) {
      const selected = submission.answers[question.id];
      const isCorrect = selected === question.correctIndex;
      if (isCorrect) correctCount++;
      results[question.id] = {
        selected: selected ?? -1,
        correct: question.correctIndex,
        isCorrect,
        explanation: question.explanation,
      };
    }

    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= (lesson.metadata?.passingScore ?? 70);

    await attempt.update({
      answers: submission.answers,
      score,
      totalQuestions,
      status: QuizAttemptStatus.COMPLETED,
      completedAt: new Date(),
      timeTakenSeconds: submission.timeTakenSeconds,
    });

    // Send in-app notification if passed
    if (passed) {
      await Notification.create({
        userId,
        type: NotificationType.LESSON_COMPLETE,
        title: 'Quiz Passed! 🎉',
        body: `You scored ${score}% on "${lesson.title}"`,
        data: { lessonId: lesson.id, attemptId, score },
        actionUrl: `/courses/${lesson.courseId}`,
      });
    }

    logger.info(`Quiz submitted: user ${userId}, attempt ${attemptId}, score ${score}%`);

    return {
      attemptId,
      score,
      totalQuestions,
      correctCount,
      passed,
      passingScore: lesson.metadata?.passingScore ?? 70,
      results,
      timeTakenSeconds: submission.timeTakenSeconds,
    };
  }

  /**
   * Get quiz attempt history for a user and lesson.
   */
  async getAttemptHistory(userId: string, lessonId: string) {
    const attempts = await QuizAttempt.findAll({
      where: { userId, lessonId },
      order: [['createdAt', 'DESC']],
    });
    return attempts;
  }

  /**
   * Get best attempt for a user and lesson.
   */
  async getBestAttempt(userId: string, lessonId: string) {
    const attempts = await QuizAttempt.findAll({
      where: { userId, lessonId, status: QuizAttemptStatus.COMPLETED },
      order: [['score', 'DESC']],
      limit: 1,
    });
    return attempts[0] || null;
  }
}

export const quizService = new QuizService();
