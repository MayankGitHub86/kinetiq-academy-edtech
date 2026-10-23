import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo, Index
} from 'sequelize-typescript';
import { Course, Lesson } from './Course';
import { AiContentJob } from './AiLearning';

export enum ResourceType {
  CURRICULUM = 'curriculum',
  LESSON_CONTENT = 'lesson_content',
  STUDY_NOTES = 'study_notes',
  FLASHCARDS = 'flashcards',
  QUESTION_BANK = 'question_bank',
  VIDEO_SCRIPT = 'video_script',
  VIDEO_ASSET = 'video_asset',
}

export enum VersionStatus {
  ACTIVE = 'active',
  STALE = 'stale',
  REVIEW_REQUIRED = 'review_required',
  SUPERSEDED = 'superseded',
}

@Table({ tableName: 'resource_versions', paranoid: true })
export class ResourceVersion extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @ForeignKey(() => AiContentJob)
  @Column(DataType.UUID)
  declare jobId?: string;

  @BelongsTo(() => AiContentJob)
  declare job?: AiContentJob;

  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId?: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @Column(DataType.STRING)
  declare lessonId?: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(ResourceType)))
  declare resourceType: ResourceType;

  @Default(1)
  @Column(DataType.INTEGER)
  declare version: number;

  @Column(DataType.STRING)
  declare contentHash?: string;

  @Default(VersionStatus.ACTIVE)
  @Column(DataType.ENUM(...Object.values(VersionStatus)))
  declare status: VersionStatus;

  @Column(DataType.TEXT)
  declare staleReason?: string;

  @Column(DataType.STRING)
  declare parentVersionId?: string;

  @Column(DataType.JSONB)
  declare metadata?: {
    modelUsed?: string;
    tokensUsed?: number;
    updatedBy?: string;
    changeSummary?: string;
    affectedResources?: string[];
    [key: string]: any;
  };

  @Column(DataType.JSONB)
  declare contentSnapshot?: Record<string, any>;
}
