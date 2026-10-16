import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo, Index
} from 'sequelize-typescript';
import { User } from './User';
import { Course, Lesson } from './Course';
import { AiContentJob, PracticePaper, VideoAsset } from './AiLearning';

// ─── 1. AI COURSE QUALITY REPORT ─────────────────────────────────────────────

export enum QualityStatus {
  ELIGIBLE = 'eligible',
  REVIEW_RECOMMENDED = 'review_recommended',
  CORRECTIONS_REQUIRED = 'corrections_required',
}

@Table({ tableName: 'course_quality_reports', paranoid: true })
export class CourseQualityReport extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @ForeignKey(() => AiContentJob)
  @Column(DataType.UUID)
  declare jobId?: string;

  @BelongsTo(() => AiContentJob)
  declare job?: AiContentJob;

  @Default(0)
  @Column(DataType.FLOAT)
  declare overallScore: number; // 0 to 100

  @Default(QualityStatus.REVIEW_RECOMMENDED)
  @Column(DataType.ENUM(...Object.values(QualityStatus)))
  declare status: QualityStatus;

  @Column(DataType.JSONB)
  declare categoryScores: {
    sourceCoverage: number;
    factualGrounding: number;
    objectiveAlignment: number;
    completeness: number;
    pedagogicalClarity: number;
    questionQuality: number;
    accessibilityAttribution: number;
  };

  @Column(DataType.JSONB)
  declare dimensionDetails: Array<{
    dimension: string;
    weight: number;
    score: number;
    passed: boolean;
    findings: string;
  }>;

  @Column(DataType.JSONB)
  declare missingObjectives: string[];

  @Column(DataType.JSONB)
  declare unsupportedClaims: string[];

  @Column(DataType.JSONB)
  declare duplicateQuestions: string[];

  @Column(DataType.JSONB)
  declare missingTranscripts: string[];

  @Column(DataType.JSONB)
  declare recommendations: string[];

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isOverridden: boolean;

  @Column(DataType.TEXT)
  declare overrideNotes?: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare reviewedById?: string;

  @BelongsTo(() => User)
  declare reviewedBy?: User;

  @Default('gpt-4o-mini-v2/deterministic-v2.1')
  @Column(DataType.STRING)
  declare modelVersion: string;
}

// ─── 2. ADAPTIVE TOPIC MASTERY & LEARNING PATH ───────────────────────────────

export enum MasteryStatus {
  STRUGGLING = 'struggling',
  LEARNING = 'learning',
  MASTERED = 'mastered',
}

@Table({ tableName: 'topic_masteries', paranoid: true })
export class TopicMastery extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare topic: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare learningObjective: string;

  @Default(50)
  @Column(DataType.FLOAT)
  declare masteryScore: number; // 0 - 100

  @Default(0)
  @Column(DataType.INTEGER)
  declare evidenceCount: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare correctCount: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare incorrectCount: number;

  @Default(MasteryStatus.LEARNING)
  @Column(DataType.ENUM(...Object.values(MasteryStatus)))
  declare status: MasteryStatus;

  @Default(0.5)
  @Column(DataType.FLOAT)
  declare confidence: number; // 0.0 to 1.0

  @Column(DataType.DATE)
  declare lastAssessedAt: Date;
}

export enum RecommendationType {
  REVISION_NOTES = 'revision_notes',
  SIMPLER_EXPLANATION = 'simpler_explanation',
  PRACTICE_DRILL = 'practice_drill',
  FLASHCARDS = 'flashcards',
  ADVANCE_NEXT = 'advance_next',
}

@Table({ tableName: 'learning_recommendations', paranoid: true })
export class LearningRecommendation extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId?: string;

  @BelongsTo(() => Lesson)
  declare lesson?: Lesson;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare topic: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(RecommendationType)))
  declare type: RecommendationType;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare reason: string;

  @Column(DataType.STRING)
  declare actionUrl: string;

  @Default(1)
  @Column(DataType.INTEGER)
  declare priority: number; // 1 = highest

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isResolved: boolean;
}

// ─── 3. INTERACTIVE VIDEO (CHAPTERS, CHECKPOINTS, NOTES, BOOKMARKS) ─────────

@Table({ tableName: 'video_chapters', paranoid: true })
export class VideoChapter extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId: string;

  @BelongsTo(() => Lesson)
  declare lesson: Lesson;

  @ForeignKey(() => VideoAsset)
  @Column(DataType.UUID)
  declare videoAssetId?: string;

  @BelongsTo(() => VideoAsset)
  declare videoAsset?: VideoAsset;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Default(0)
  @Column(DataType.FLOAT)
  declare startSeconds: number;

  @Column(DataType.FLOAT)
  declare endSeconds?: number;

  @Column(DataType.STRING)
  declare learningObjective?: string;

  @Column(DataType.JSONB)
  declare keyConcepts?: string[];
}

@Table({ tableName: 'video_checkpoints', paranoid: true })
export class VideoCheckpoint extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId: string;

  @BelongsTo(() => Lesson)
  declare lesson: Lesson;

  @ForeignKey(() => VideoAsset)
  @Column(DataType.UUID)
  declare videoAssetId?: string;

  @BelongsTo(() => VideoAsset)
  declare videoAsset?: VideoAsset;

  @AllowNull(false)
  @Column(DataType.FLOAT)
  declare timestampSeconds: number;

  @Default('mcq')
  @Column(DataType.STRING)
  declare questionType: string; // mcq, code_prediction, quick_recall

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare prompt: string;

  @Column(DataType.JSONB)
  declare options: Array<{ id: string; text: string }>;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare correctAnswer: string;

  @Column(DataType.TEXT)
  declare explanation?: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare pauseUntilAnswered: boolean;
}

@Table({ tableName: 'video_checkpoint_attempts', paranoid: true })
export class VideoCheckpointAttempt extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => VideoCheckpoint)
  @Column(DataType.UUID)
  declare checkpointId: string;

  @BelongsTo(() => VideoCheckpoint)
  declare checkpoint: VideoCheckpoint;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare selectedAnswer: string;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  declare isCorrect: boolean;
}

@Table({ tableName: 'video_notes', paranoid: true })
export class VideoNote extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId: string;

  @BelongsTo(() => Lesson)
  declare lesson: Lesson;

  @AllowNull(false)
  @Column(DataType.FLOAT)
  declare timestampSeconds: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare noteText: string;
}

@Table({ tableName: 'video_bookmarks', paranoid: true })
export class VideoBookmark extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId: string;

  @BelongsTo(() => Lesson)
  declare lesson: Lesson;

  @AllowNull(false)
  @Column(DataType.FLOAT)
  declare timestampSeconds: number;

  @Default('Moment Bookmark')
  @Column(DataType.STRING)
  declare label: string;
}

// ─── 4. EXAM PAPER BLUEPRINT GENERATOR ───────────────────────────────────────

export enum BlueprintTemplate {
  QUICK_REVISION = 'quick_revision',
  MODULE_TEST = 'module_test',
  FULL_COURSE = 'full_course',
  MOCK_EXAM = 'mock_exam',
  CODING_ASSESSMENT = 'coding_assessment',
}

@Table({ tableName: 'exam_blueprints', paranoid: true })
export class ExamBlueprint extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare instructorId: string;

  @BelongsTo(() => User)
  declare instructor: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Default(BlueprintTemplate.MODULE_TEST)
  @Column(DataType.ENUM(...Object.values(BlueprintTemplate)))
  declare templateType: BlueprintTemplate;

  @Column(DataType.JSONB)
  declare moduleIds?: string[];

  @Column(DataType.JSONB)
  declare topics?: string[];

  @Column(DataType.JSONB)
  declare learningObjectives?: string[];

  @Default(100)
  @Column(DataType.INTEGER)
  declare totalMarks: number;

  @Default(45)
  @Column(DataType.INTEGER)
  declare durationMinutes: number;

  @Default(10)
  @Column(DataType.INTEGER)
  declare questionCount: number;

  @Column(DataType.JSONB)
  declare questionTypes: string[]; // ['mcq', 'short_answer', 'coding']

  @Column(DataType.JSONB)
  declare difficultyDistribution: {
    easy: number; // e.g. 30 (%)
    medium: number; // e.g. 50 (%)
    hard: number; // e.g. 20 (%)
  };

  @Default(0)
  @Column(DataType.FLOAT)
  declare negativeMarkingPercent: number;

  @Default(60)
  @Column(DataType.INTEGER)
  declare passingScore: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare randomize: boolean;

  @Column(DataType.JSONB)
  declare validationSummary?: {
    valid: boolean;
    availableQuestions: number;
    shortfall: number;
    errors: string[];
    warnings: string[];
  };

  @ForeignKey(() => PracticePaper)
  @Column(DataType.UUID)
  declare generatedPaperId?: string;

  @BelongsTo(() => PracticePaper)
  declare generatedPaper?: PracticePaper;

  @Default('draft')
  @Column(DataType.STRING)
  declare status: string; // draft, validated, generated
}

// ─── 5. COST-AWARE GENERATION STAGE RECORD ───────────────────────────────────

@Table({ tableName: 'generation_stage_records', paranoid: true })
export class GenerationStageRecord extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => AiContentJob)
  @Column(DataType.UUID)
  declare jobId: string;

  @BelongsTo(() => AiContentJob)
  declare job: AiContentJob;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare stageName: string;

  @Default('pending')
  @Column(DataType.STRING)
  declare status: string; // pending, in_progress, completed, failed, skipped

  @Default(0)
  @Column(DataType.INTEGER)
  declare durationMs: number;

  @Default('internal')
  @Column(DataType.STRING)
  declare provider: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare tokensUsed: number;

  @Default(0)
  @Column(DataType.FLOAT)
  declare estimatedCostUsd: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare retryCount: number;

  @Column(DataType.TEXT)
  declare errorMessage?: string;

  @Column(DataType.JSONB)
  declare outputSnapshot?: Record<string, any>;
}
