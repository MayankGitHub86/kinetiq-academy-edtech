import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo, HasMany
} from 'sequelize-typescript';
import { User } from './User';
import { Course } from './Course';

export enum ProjectStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  ANALYZING = 'analyzing',
  READY = 'ready',
  GENERATING = 'generating',
  REVIEW_REQUIRED = 'review_required',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  FAILED = 'failed',
  ARCHIVED = 'archived',
  COMPLETED = 'completed',
}

export enum LearningSourceType {
  URL = 'url',
  DOCUMENT = 'document',
  TEXT = 'text',
  VIDEO_URL = 'video_url',
}

@Table({ tableName: 'learning_projects', paranoid: true })
export class LearningProject extends Model {
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
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare description?: string;

  @Default('General Learning')
  @Column(DataType.STRING)
  declare subject: string;

  @Column(DataType.STRING)
  declare category?: string;

  @Default(ProjectStatus.DRAFT)
  @Column(DataType.ENUM(...Object.values(ProjectStatus)))
  declare status: ProjectStatus;

  @Column(DataType.STRING)
  declare targetLevel?: string;

  @Column(DataType.STRING)
  declare language?: string;

  @Column(DataType.STRING)
  declare difficulty?: string;

  @Column(DataType.JSONB)
  declare learningObjectives?: string[];

  @Column(DataType.JSONB)
  declare prerequisites?: string[];

  @Column(DataType.JSONB)
  declare targetAudience?: string[];

  @Column(DataType.INTEGER)
  declare estimatedDurationMinutes?: number;

  @Column(DataType.STRING)
  declare thumbnailUrl?: string;

  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId?: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @Column(DataType.UUID)
  declare activeJobId?: string;

  @Column(DataType.JSONB)
  declare settings: {
    educationLevel?: string;
    targetExam?: string;
    language?: string;
    explanationDepth?: 'concise' | 'standard' | 'deep_dive';
    availableStudyTime?: string;
    preferredFormat?: string;
    targetDate?: string;
  };

  @Column(DataType.JSONB)
  declare knowledgeMap?: any;

  @Column(DataType.JSONB)
  declare metadata?: any;

  @Default({
    sourceCount: 0,
    notesCount: 0,
    flashcardsCount: 0,
    quizCount: 0,
    paperCount: 0,
    videoCount: 0,
  })
  @Column(DataType.JSONB)
  declare stats: {
    sourceCount: number;
    notesCount: number;
    flashcardsCount: number;
    quizCount: number;
    paperCount: number;
    videoCount: number;
  };

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isPublished: boolean;

  @Column(DataType.DATE)
  declare publishedAt?: Date;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare publishedBy?: string;

  @BelongsTo(() => User, 'publishedBy')
  declare publisher?: User;

  @Default({
    publishNotes: true,
    publishFlashcards: true,
    publishQuiz: true,
    publishPracticePaper: true,
    publishVideo: true,
    publishTutor: true,
    allowDownload: true,
    targetAudience: 'assigned',
  })
  @Column(DataType.JSONB)
  declare publicationSettings: {
    publishNotes?: boolean;
    publishFlashcards?: boolean;
    publishQuiz?: boolean;
    publishPracticePaper?: boolean;
    publishVideo?: boolean;
    publishTutor?: boolean;
    allowDownload?: boolean;
    targetAudience?: 'all' | 'assigned' | 'group' | 'course';
  };

  @HasMany(() => LearningSource)
  declare sources: LearningSource[];

  @HasMany(() => ProjectStudentAccess)
  declare studentAccesses: ProjectStudentAccess[];
}

@Table({ tableName: 'learning_sources', paranoid: true })
export class LearningSource extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => LearningProject)
  @Column(DataType.UUID)
  declare projectId: string;

  @BelongsTo(() => LearningProject)
  declare project: LearningProject;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @Default(LearningSourceType.URL)
  @Column(DataType.ENUM(...Object.values(LearningSourceType)))
  declare sourceType: LearningSourceType;

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

  @Column(DataType.STRING)
  declare contentHash?: string;

  @Default('pending')
  @Column(DataType.STRING)
  declare status: string;

  @Column(DataType.JSONB)
  declare headings?: Array<{ level: number; text: string }>;

  @Column(DataType.JSONB)
  declare chunks?: Array<{ id: number; heading: string; text: string }>;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @Column(DataType.TEXT)
  declare errorMessage?: string;
}

@Table({
  tableName: 'project_student_accesses',
  paranoid: true,
  indexes: [
    { unique: true, fields: ['project_id', 'student_id'] }
  ]
})
export class ProjectStudentAccess extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => LearningProject)
  @Column(DataType.UUID)
  declare projectId: string;

  @BelongsTo(() => LearningProject)
  declare project: LearningProject;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User, 'studentId')
  declare student: User;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare grantedBy: string;

  @BelongsTo(() => User, 'grantedBy')
  declare grantor: User;

  @Default('active')
  @Column(DataType.STRING)
  declare status: 'active' | 'revoked';

  @Default('individual')
  @Column(DataType.STRING)
  declare assignmentType: 'individual' | 'group' | 'course' | 'all';

  @Column(DataType.STRING)
  declare groupOrBatch?: string;

  @Column(DataType.DATE)
  declare validFrom?: Date;

  @Column(DataType.DATE)
  declare validUntil?: Date;

  @Column(DataType.TEXT)
  declare notes?: string;
}

