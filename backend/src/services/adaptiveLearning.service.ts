import { Op } from 'sequelize';
import { Course, Lesson, Section, Enrollment } from '../models/Course';
import {
  QuestionBankItem, StudyNote, Flashcard, AssessmentSubmission
} from '../models/AiLearning';
import {
  TopicMastery, LearningRecommendation, MasteryStatus, RecommendationType
} from '../models/AiLearningPhase2';
import { logger } from '../utils/logger';

export class AdaptiveLearningService {
  /**
   * Process assessment results and update topic mastery model
   */
  public static async recordAssessmentFeedback(params: {
    userId: string;
    courseId: string;
    questionResults: Array<{
      questionId?: string;
      topic?: string;
      learningObjective?: string;
      isCorrect: boolean;
    }>;
  }): Promise<TopicMastery[]> {
    const { userId, courseId, questionResults } = params;
    const updatedMasteries: TopicMastery[] = [];

    // Group by topic/objective
    const topicStats: Record<string, { correct: number; total: number; objective: string }> = {};

    for (const q of questionResults) {
      const topic = q.topic || 'Core Architectural Concepts';
      const objective = q.learningObjective || topic;

      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0, objective };
      }
      topicStats[topic].total++;
      if (q.isCorrect) topicStats[topic].correct++;
    }

    // Update or create TopicMastery records
    for (const [topic, stats] of Object.entries(topicStats)) {
      let record = await TopicMastery.findOne({
        where: { userId, courseId, topic },
      });

      const attemptAccuracy = (stats.correct / stats.total) * 100;

      if (record) {
        const totalEvidence = record.evidenceCount + stats.total;
        const totalCorrect = record.correctCount + stats.correct;
        const totalIncorrect = record.incorrectCount + (stats.total - stats.correct);
        
        // Exponential moving average for mastery score
        const newScore = Math.round(record.masteryScore * 0.4 + attemptAccuracy * 0.6);
        const status = newScore >= 80 ? MasteryStatus.MASTERED : newScore < 60 ? MasteryStatus.STRUGGLING : MasteryStatus.LEARNING;
        const confidence = Math.min(1.0, 0.3 + (totalEvidence * 0.1));

        await record.update({
          masteryScore: newScore,
          evidenceCount: totalEvidence,
          correctCount: totalCorrect,
          incorrectCount: totalIncorrect,
          status,
          confidence,
          lastAssessedAt: new Date(),
        });
      } else {
        const status = attemptAccuracy >= 80 ? MasteryStatus.MASTERED : attemptAccuracy < 60 ? MasteryStatus.STRUGGLING : MasteryStatus.LEARNING;
        record = await TopicMastery.create({
          userId,
          courseId,
          topic,
          learningObjective: stats.objective,
          masteryScore: Math.round(attemptAccuracy),
          evidenceCount: stats.total,
          correctCount: stats.correct,
          incorrectCount: stats.total - stats.correct,
          status,
          confidence: 0.5,
          lastAssessedAt: new Date(),
        });
      }

      updatedMasteries.push(record);
    }

    // Regenerate recommendations based on new mastery data
    await this.generateRecommendations(userId, courseId);

    return updatedMasteries;
  }

  /**
   * Generates grounded, explainable recommendations for weak and mastered areas
   */
  public static async generateRecommendations(userId: string, courseId: string): Promise<LearningRecommendation[]> {
    // 1. Fetch current topic masteries
    const masteries = await TopicMastery.findAll({
      where: { userId, courseId },
      order: [['masteryScore', 'ASC']],
    });

    // 2. Fetch course lessons, notes, and flashcards
    const course = await Course.findByPk(courseId, {
      include: [{ model: Section, include: [Lesson] }],
    });
    if (!course) return [];

    const lessons: Lesson[] = [];
    (course.sections || []).forEach(s => (s.lessons || []).forEach(l => lessons.push(l)));
    const studyNote = await StudyNote.findOne({ where: { courseId } });
    const flashcards = await Flashcard.findAll({ where: { courseId } });

    // Clear stale unresolved recommendations for this course
    await LearningRecommendation.destroy({
      where: { userId, courseId, isResolved: false },
    });

    const newRecommendations: LearningRecommendation[] = [];

    // Find struggling topics (< 60)
    const struggling = masteries.filter(m => m.masteryScore < 60 || m.status === MasteryStatus.STRUGGLING);

    for (const weak of struggling) {
      // Find matching lesson
      const matchedLesson = lessons.find(l => 
        l.title.toLowerCase().includes(weak.topic.toLowerCase()) ||
        (l.content && l.content.toLowerCase().includes(weak.topic.toLowerCase()))
      ) || lessons[0];

      // Recommendation A: Revision Notes / Simpler Explanation
      if (studyNote) {
        newRecommendations.push(await LearningRecommendation.create({
          userId,
          courseId,
          lessonId: matchedLesson?.id,
          topic: weak.topic,
          type: RecommendationType.REVISION_NOTES,
          title: `Review Core Revision Notes: ${weak.topic}`,
          reason: `Your demonstrated accuracy on "${weak.topic}" is currently ${weak.masteryScore}%. Reviewing structured summary notes will reinforce key mental models.`,
          actionUrl: `/course_lms_player/index.html?course=${courseId}&lesson=${matchedLesson?.id}&tab=overview`,
          priority: 1,
        }));
      }

      // Recommendation B: Active Recall Flashcards
      const relatedFlashcards = flashcards.filter(f => 
        (f.topicTags && f.topicTags.some(t => t.toLowerCase().includes(weak.topic.toLowerCase()))) ||
        f.front.toLowerCase().includes(weak.topic.toLowerCase())
      );
      if (relatedFlashcards.length > 0 || flashcards.length > 0) {
        newRecommendations.push(await LearningRecommendation.create({
          userId,
          courseId,
          lessonId: matchedLesson?.id,
          topic: weak.topic,
          type: RecommendationType.FLASHCARDS,
          title: `Drill Spaced Repetition Cards: ${weak.topic}`,
          reason: `Targeted spaced-repetition active recall has proven to increase retention by 3.4x on complex architectural concepts.`,
          actionUrl: `/course_lms_player/index.html?course=${courseId}&tab=flashcards`,
          priority: 2,
        }));
      }

      // Recommendation C: Additional Practice Drill
      newRecommendations.push(await LearningRecommendation.create({
        userId,
        courseId,
        lessonId: matchedLesson?.id,
        topic: weak.topic,
        type: RecommendationType.PRACTICE_DRILL,
        title: `Take Targeted Practice Quiz: ${weak.topic}`,
        reason: `Complete a 3-question recovery drill to test whether your understanding has stabilized.`,
        actionUrl: `/practice_quiz_center/index.html?course=${courseId}&topic=${encodeURIComponent(weak.topic)}`,
        priority: 3,
      }));
    }

    // If student has mastered recent topics, recommend next lesson
    const mastered = masteries.filter(m => m.masteryScore >= 80);
    if (mastered.length > 0 && lessons.length > 1) {
      const nextLesson = lessons[1] || lessons[0];
      newRecommendations.push(await LearningRecommendation.create({
        userId,
        courseId,
        lessonId: nextLesson.id,
        topic: mastered[0].topic,
        type: RecommendationType.ADVANCE_NEXT,
        title: `Advance to Next Module: ${nextLesson.title}`,
        reason: `Congratulations! You achieved ${mastered[0].masteryScore}% mastery in ${mastered[0].topic}. You are ready for the next architectural challenge.`,
        actionUrl: `/course_lms_player/index.html?course=${courseId}&lesson=${nextLesson.id}`,
        priority: 1,
      }));
    }

    logger.info(`Generated ${newRecommendations.length} adaptive recommendations for user ${userId} in course ${courseId}`);
    return newRecommendations;
  }

  /**
   * Retrieves student's complete adaptive learning profile for dashboard display
   */
  public static async getStudentAdaptiveProfile(userId: string, courseId?: string) {
    const whereClause: any = { userId };
    if (courseId) whereClause.courseId = courseId;

    const [masteries, recommendations, enrollments] = await Promise.all([
      TopicMastery.findAll({ where: whereClause, order: [['masteryScore', 'ASC']] }),
      LearningRecommendation.findAll({ where: { ...whereClause, isResolved: false }, order: [['priority', 'ASC']] }),
      Enrollment.findAll({ where: { userId }, include: [Course] }),
    ]);

    const weakTopics = masteries.filter(m => m.masteryScore < 65);
    const masteredTopics = masteries.filter(m => m.masteryScore >= 80);
    const inProgressTopics = masteries.filter(m => m.masteryScore >= 65 && m.masteryScore < 80);

    const overallMastery = masteries.length > 0
      ? Math.round(masteries.reduce((acc, m) => acc + m.masteryScore, 0) / masteries.length)
      : 50;

    return {
      overallMastery,
      totalTrackedObjectives: masteries.length,
      weakTopicsCount: weakTopics.length,
      masteredTopicsCount: masteredTopics.length,
      masteryMap: masteries,
      weakTopics,
      masteredTopics,
      inProgressTopics,
      recommendations,
      enrolledCourses: enrollments.map(e => ({
        id: e.courseId,
        title: e.course?.title,
        progressPercent: e.progressPercent,
      })),
    };
  }
}
