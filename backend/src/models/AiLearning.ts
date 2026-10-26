import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo, HasMany, Index
} from 'sequelize-typescript';
import { User } from './User';
import { Course, Lesson } from './Course';

export enum SourceType {
  URL = 'url',
  DOCUMENT = 'document',
  TEXT = 'text',
  VIDEO_URL = 'video_url',
}

export enum JobStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEW_REQUIRED = 'review_required',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Table({ tableName: 'content_sources', paranoid: true })
export class ContentSource extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @Default(SourceType.URL)
  @Column(DataType.ENUM(...Object.values(SourceType)))
  declare sourceType: SourceType;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.STRING)
  declare url?: string;

  @Column(DataType.STRING)
  declare filePath?: string;

  @Column(DataType.TEXT)
  declare rawText?: string;

  @Column(DataType.TEXT)
  declare cleanedText?: string;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @Default('pending')
  @Column(DataType.STRING)
  declare status: string;

  @Column(DataType.TEXT)
  declare errorMessage?: string;
}

@Table({ tableName: 'content_analyses', paranoid: true })
export class ContentAnalysis extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => ContentSource)
  @Column(DataType.UUID)
  declare sourceId: string;

  @BelongsTo(() => ContentSource)
  declare source: ContentSource;

  @Column(DataType.STRING)
  declare topic: string;

  @Column(DataType.STRING)
  declare category: string;

  @Default('intermediate')
  @Column(DataType.STRING)
  declare targetLevel: string;

  @Column(DataType.JSONB)
  declare keyConcepts?: Array<{ name: string; definition: string; importance: string }>;

  @Column(DataType.JSONB)
  declare prerequisites?: string[];

  @Column(DataType.JSONB)
  declare learningObjectives?: string[];

  @Column(DataType.JSONB)
  declare suggestedOutline?: Array<{
    title: string;
    description: string;
    lessons: Array<{ title: string; description: string; durationMinutes: number }>;
  }>;

  @Column(DataType.JSONB)
  declare sourceChunks?: Array<{ id: number; heading: string; text: string }>;

  @Column(DataType.JSONB)
  declare glossary?: Array<{ term: string; definition: string; example: string }>;
}

@Table({ tableName: 'ai_content_jobs', paranoid: true })
export class AiContentJob extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => ContentSource)
  @Column(DataType.UUID)
  declare sourceId?: string;

  @BelongsTo(() => ContentSource)
  declare source?: ContentSource;

  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId?: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @Default('full_generation')
  @Column(DataType.STRING)
  declare jobType: string;

  @Default('pending')
  @Column(DataType.STRING)
  declare stage: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare progress: number;

  @Default(JobStatus.PENDING)
  @Column(DataType.ENUM(...Object.values(JobStatus)))
  declare status: JobStatus;

  @Column(DataType.JSONB)
  declare stageDetails?: Record<string, any>;

  @Column(DataType.JSONB)
  declare options?: {
    desiredDuration?: number;
    videoStyle?: string;
    questionCount?: number;
    difficultyDistribution?: string;
    outputSelection?: string[];
    language?: string;
  };

  @Column(DataType.JSONB)
  declare generatedData?: Record<string, any>;

  @Column(DataType.JSONB)
  declare validationReport?: {
    score: number;
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; message: string }>;
    warnings: string[];
  };

  @Column(DataType.JSONB)
  declare costEstimate?: {
    tokensUsed: number;
    estimatedCostUsd: number;
  };

  @Column(DataType.TEXT)
  declare errorMessage?: string;
}

@Table({ tableName: 'study_notes', paranoid: true })
export class StudyNote extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

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
  declare title: string;

  @Column(DataType.TEXT)
  declare summary?: string;

  @Column(DataType.TEXT)
  declare detailedNotes?: string;

  @Column(DataType.TEXT)
  declare quickRevision?: string;

  @Column(DataType.TEXT)
  declare formulaSheet?: string;

  @Column(DataType.JSONB)
  declare faq?: Array<{ question: string; answer: string }>;

  @Column(DataType.JSONB)
  declare diagrams?: Array<{ title: string; type: string; code: string }>;

  @Column(DataType.STRING)
  declare downloadPdfUrl?: string;
}

@Table({ tableName: 'flashcards', paranoid: true })
export class Flashcard extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

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
  @Column(DataType.TEXT)
  declare front: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare back: string;

  @Column(DataType.TEXT)
  declare explanation?: string;

  @Column(DataType.STRING)
  declare topic?: string;

  @Default('medium')
  @Column(DataType.STRING)
  declare difficulty: string;

  @Column(DataType.JSONB)
  declare topicTags?: string[];

  @Default(1)
  @Column(DataType.INTEGER)
  declare intervalDays: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare repetitions: number;

  @Default(2.5)
  @Column(DataType.FLOAT)
  declare easeFactor: number;
}

@Table({ tableName: 'question_bank_items', paranoid: true })
export class QuestionBankItem extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

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

  @Default('mcq')
  @Column(DataType.STRING)
  declare type: string; // mcq, multiple_select, true_false, fill_blank, short_answer, coding

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare question: string;

  @Column(DataType.JSONB)
  declare options?: any[];

  @Column(DataType.JSONB)
  declare correctAnswer?: any;

  @Column(DataType.TEXT)
  declare rubric?: string;

  @Column(DataType.TEXT)
  declare explanation?: string;

  @Default('medium')
  @Column(DataType.STRING)
  declare difficulty: string;

  @Column(DataType.STRING)
  declare topic?: string;

  @Default(1)
  @Column(DataType.INTEGER)
  declare marks: number;

  @Default(2)
  @Column(DataType.INTEGER)
  declare estimatedMinutes: number;

  @Column(DataType.JSONB)
  declare codeSnippet?: {
    language: string;
    starterCode: string;
    testCases?: Array<{ input: string; expectedOutput: string }>;
  };
}

@Table({ tableName: 'practice_papers', paranoid: true })
export class PracticePaper extends Model {
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
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare instructions?: string;

  @Default(30)
  @Column(DataType.INTEGER)
  declare timeLimitMinutes: number;

  @Default(100)
  @Column(DataType.INTEGER)
  declare totalMarks: number;

  @Default(60)
  @Column(DataType.INTEGER)
  declare passingScore: number;

  @Default(0)
  @Column(DataType.FLOAT)
  declare negativeMarkingPercent: number;

  @Column(DataType.JSONB)
  declare questionIds?: string[];

  @Column(DataType.JSONB)
  declare markingScheme?: Record<string, any>;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isPublished: boolean;
}

@Table({ tableName: 'assessment_submissions', paranoid: true })
export class AssessmentSubmission extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => PracticePaper)
  @Column(DataType.UUID)
  declare paperId: string;

  @BelongsTo(() => PracticePaper)
  declare paper: PracticePaper;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @Column(DataType.JSONB)
  declare answers?: Record<string, any>;

  @Default(0)
  @Column(DataType.FLOAT)
  declare score: number;

  @Default(0)
  @Column(DataType.FLOAT)
  declare totalScore: number;

  @Default(0)
  @Column(DataType.FLOAT)
  declare percentage: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare passed: boolean;

  @Column(DataType.JSONB)
  declare feedback?: Record<string, any>;

  @Default('submitted')
  @Column(DataType.STRING)
  declare status: string;
}

@Table({ tableName: 'video_assets', paranoid: true })
export class VideoAsset extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId?: string;

  @BelongsTo(() => Lesson)
  declare lesson?: Lesson;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course: Course;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare videoUrl: string;

  @Column(DataType.STRING)
  declare thumbnailUrl?: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare durationSeconds: number;

  @Default('technical_whiteboard')
  @Column(DataType.STRING)
  declare videoStyle: string;

  @Column(DataType.TEXT)
  declare script?: string;

  @Column(DataType.JSONB)
  declare storyboard?: Array<{
    sceneNumber: number;
    title: string;
    narration: string;
    visualDescription: string;
    durationSeconds: number;
  }>;

  @Column(DataType.TEXT)
  declare captionsVtt?: string;

  @Column(DataType.STRING)
  declare captionsVttUrl?: string;

  @Column(DataType.JSONB)
  declare transcript?: Array<{
    start: number;
    end: number;
    text: string;
  }>;

  @Default('scene_renderer')
  @Column(DataType.STRING)
  declare provider: string;

  @Default('ready')
  @Column(DataType.STRING)
  declare status: string;
}
