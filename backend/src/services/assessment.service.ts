import { PracticePaper, QuestionBankItem, AssessmentSubmission } from '../models/AiLearning';
import { logger } from '../utils/logger';

export interface SubmitAssessmentParams {
  paperId: string;
  userId: string;
  answers: Record<string, any>; // questionId -> submitted answer
}

export interface AssessmentResult {
  submissionId: string;
  paperId: string;
  score: number;
  totalScore: number;
  percentage: number;
  passed: boolean;
  questionResults: Array<{
    questionId: string;
    question: string;
    userAnswer: any;
    correctAnswer: any;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
    explanation: string;
  }>;
}

export class AssessmentService {
  /**
   * Retrieves student version of a practice paper (WITHOUT correct answers or rubrics)
   */
  public static async getStudentPaper(paperId: string): Promise<any> {
    const paper = await PracticePaper.findByPk(paperId);
    if (!paper) {
      throw new Error(`Practice Paper with ID ${paperId} not found.`);
    }

    const questionIds = (paper.questionIds as string[]) || [];
    const questions = await QuestionBankItem.findAll({
      where: { id: questionIds },
    });

    // Map questions in order, stripping correctAnswer and rubric
    const sanitizedQuestions = questionIds.map(qId => {
      const q = questions.find(item => item.id === qId);
      if (!q) return null;
      return {
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
        topic: q.topic,
        marks: q.marks,
        estimatedMinutes: q.estimatedMinutes,
        codeSnippet: q.codeSnippet ? {
          language: q.codeSnippet.language,
          starterCode: q.codeSnippet.starterCode,
        } : undefined,
      };
    }).filter(Boolean);

    return {
      id: paper.id,
      courseId: paper.courseId,
      title: paper.title,
      instructions: paper.instructions,
      timeLimitMinutes: paper.timeLimitMinutes,
      totalMarks: paper.totalMarks,
      passingScore: paper.passingScore,
      questions: sanitizedQuestions,
    };
  }

  /**
   * Evaluates student answers, grades objective items deterministically, and stores submission
   */
  public static async evaluateAndSubmit(params: SubmitAssessmentParams): Promise<AssessmentResult> {
    const paper = await PracticePaper.findByPk(params.paperId);
    if (!paper) {
      throw new Error(`Practice Paper ${params.paperId} not found.`);
    }

    const questionIds = (paper.questionIds as string[]) || [];
    const questions = await QuestionBankItem.findAll({
      where: { id: questionIds },
    });

    let earnedMarks = 0;
    let maxMarks = 0;
    const questionResults: any[] = [];

    for (const q of questions) {
      maxMarks += q.marks || 1;
      const userAnswer = params.answers[q.id];
      let isCorrect = false;

      if (q.type === 'mcq' || q.type === 'true_false') {
        isCorrect = String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      } else if (q.type === 'multiple_select') {
        const expected = Array.isArray(q.correctAnswer) ? q.correctAnswer.sort() : [q.correctAnswer];
        const submitted = Array.isArray(userAnswer) ? userAnswer.sort() : [userAnswer];
        isCorrect = JSON.stringify(expected) === JSON.stringify(submitted);
      } else if (q.type === 'fill_in_the_blank') {
        isCorrect = String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      } else if (q.type === 'coding') {
        // Basic code presence / heuristic check
        isCorrect = !!userAnswer && String(userAnswer).length > 15;
      } else {
        // Short / long answer heuristic
        isCorrect = !!userAnswer && String(userAnswer).length >= 10;
      }

      const awarded = isCorrect ? q.marks : 0;
      earnedMarks += awarded;

      questionResults.push({
        questionId: q.id,
        question: q.question,
        userAnswer: userAnswer || null,
        correctAnswer: q.correctAnswer,
        isCorrect,
        marksAwarded: awarded,
        maxMarks: q.marks,
        explanation: q.explanation || 'No explanation provided.',
      });
    }

    const percentage = maxMarks > 0 ? Math.round((earnedMarks / maxMarks) * 100) : 0;
    const passed = percentage >= paper.passingScore;

    const submission = await AssessmentSubmission.create({
      paperId: paper.id,
      userId: params.userId,
      answers: params.answers,
      score: earnedMarks,
      totalScore: maxMarks,
      percentage,
      passed,
      feedback: { questionResults },
      status: 'graded',
    });

    logger.info(`Graded assessment submission ${submission.id}: score ${earnedMarks}/${maxMarks} (${percentage}%) - Passed: ${passed}`);

    // Adaptive feedback loop: update topic mastery and refresh recommendations
    try {
      const { AdaptiveLearningService } = await import('./adaptiveLearning.service');
      await AdaptiveLearningService.recordAssessmentFeedback({
        userId: params.userId,
        courseId: paper.courseId,
        questionResults: questions.map((q, idx) => ({
          questionId: q.id,
          topic: q.topic || 'Core Architectural Concepts',
          learningObjective: q.topic,
          isCorrect: questionResults[idx]?.isCorrect || false,
        })),
      });
    } catch (feedErr) {
      logger.warn('Adaptive feedback recording error (non-blocking):', feedErr);
    }

    return {
      submissionId: submission.id,
      paperId: paper.id,
      score: earnedMarks,
      totalScore: maxMarks,
      percentage,
      passed,
      questionResults,
    };
  }
}
