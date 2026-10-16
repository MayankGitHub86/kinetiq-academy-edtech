import { Sequelize } from 'sequelize-typescript';
import { User } from './User';
import { Profile } from './Profile';
import { Onboarding } from './Onboarding';
import {
  Course, Section, Lesson, Enrollment, LessonProgress, Review
} from './Course';
import {
  Order, QuizAttempt, Notification, Certificate, LiveSession, AnalyticsEvent
} from './Transaction';
import {
  ContentSource, ContentAnalysis, AiContentJob, StudyNote,
  Flashcard, QuestionBankItem, PracticePaper, AssessmentSubmission, VideoAsset
} from './AiLearning';
import {
  CourseQualityReport, TopicMastery, LearningRecommendation,
  VideoChapter, VideoCheckpoint, VideoCheckpointAttempt, VideoNote, VideoBookmark,
  ExamBlueprint, GenerationStageRecord
} from './AiLearningPhase2';
import {
  LearningProject, LearningSource, ProjectStatus, LearningSourceType, ProjectStudentAccess
} from './LearningProject';

export const models = [
  User, Profile, Onboarding,
  Course, Section, Lesson, Enrollment, LessonProgress, Review,
  Order, QuizAttempt, Notification, Certificate, LiveSession, AnalyticsEvent,
  ContentSource, ContentAnalysis, AiContentJob, StudyNote,
  Flashcard, QuestionBankItem, PracticePaper, AssessmentSubmission, VideoAsset,
  CourseQualityReport, TopicMastery, LearningRecommendation,
  VideoChapter, VideoCheckpoint, VideoCheckpointAttempt, VideoNote, VideoBookmark,
  ExamBlueprint, GenerationStageRecord,
  LearningProject, LearningSource, ProjectStudentAccess,
];

export {
  User, Profile, Onboarding,
  Course, Section, Lesson, Enrollment, LessonProgress, Review,
  Order, QuizAttempt, Notification, Certificate, LiveSession, AnalyticsEvent,
  ContentSource, ContentAnalysis, AiContentJob, StudyNote,
  Flashcard, QuestionBankItem, PracticePaper, AssessmentSubmission, VideoAsset,
  CourseQualityReport, TopicMastery, LearningRecommendation,
  VideoChapter, VideoCheckpoint, VideoCheckpointAttempt, VideoNote, VideoBookmark,
  ExamBlueprint, GenerationStageRecord,
  LearningProject, LearningSource, ProjectStatus, LearningSourceType, ProjectStudentAccess,
};

