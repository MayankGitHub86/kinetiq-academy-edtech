import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo, HasMany, Index
} from 'sequelize-typescript';
import { User } from './User';

export enum CourseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  ALL_LEVELS = 'all_levels',
}

export enum CourseStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Table({ tableName: 'courses', paranoid: true })
export class Course extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING)
  declare slug: string;

  @Column(DataType.TEXT)
  declare shortDescription?: string;

  @Column(DataType.TEXT)
  declare description?: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare instructorId: string;

  @BelongsTo(() => User, 'instructorId')
  declare instructor: User;

  @Default(CourseStatus.DRAFT)
  @Column(DataType.ENUM(...Object.values(CourseStatus)))
  declare status: CourseStatus;

  @Default(CourseLevel.ALL_LEVELS)
  @Column(DataType.ENUM(...Object.values(CourseLevel)))
  declare level: CourseLevel;

  @Column(DataType.STRING)
  declare category?: string;

  @Column(DataType.ARRAY(DataType.STRING))
  declare tags?: string[];

  @Column(DataType.STRING)
  declare thumbnailUrl?: string;

  @Column(DataType.STRING)
  declare previewVideoUrl?: string;

  @Default(0)
  @Column(DataType.DECIMAL(10, 2))
  declare price: number;

  @Column(DataType.DECIMAL(10, 2))
  declare originalPrice?: number;

  @Column(DataType.STRING)
  declare currency?: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isFree: boolean;

  @Default(0)
  @Column(DataType.INTEGER)
  declare totalDurationMinutes: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare totalLessons: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare totalEnrollments: number;

  @Default(0)
  @Column(DataType.DECIMAL(3, 2))
  declare avgRating: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare totalReviews: number;

  @Column(DataType.JSONB)
  declare learningObjectives?: string[];

  @Column(DataType.JSONB)
  declare prerequisites?: string[];

  @Column(DataType.JSONB)
  declare targetAudience?: string[];

  @Column(DataType.DATE)
  declare publishedAt?: Date;

  @Column(DataType.STRING)
  declare language?: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare hasCertificate: boolean;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @HasMany(() => Section)
  declare sections: Section[];

  @HasMany(() => Enrollment)
  declare enrollments: Enrollment[];

  @HasMany(() => Review)
  declare reviews: Review[];
}

@Table({ tableName: 'sections', paranoid: true })
export class Section extends Model {
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
  declare description?: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare orderIndex: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isPublished: boolean;

  @HasMany(() => Lesson)
  declare lessons: Lesson[];
}

export enum LessonType {
  VIDEO = 'video',
  ARTICLE = 'article',
  QUIZ = 'quiz',
  LIVE = 'live',
  ASSIGNMENT = 'assignment',
  DOWNLOAD = 'download',
}

@Table({ tableName: 'lessons', paranoid: true })
export class Lesson extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Section)
  @Column(DataType.UUID)
  declare sectionId: string;

  @BelongsTo(() => Section)
  declare section: Section;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course, 'courseId')
  declare course: Course;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare description?: string;

  @Default(LessonType.VIDEO)
  @Column(DataType.ENUM(...Object.values(LessonType)))
  declare type: LessonType;

  @Column(DataType.STRING)
  declare videoUrl?: string;

  @Column(DataType.TEXT)
  declare content?: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare durationMinutes: number;

  @Default(0)
  @Column(DataType.INTEGER)
  declare orderIndex: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isFree: boolean;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isPublished: boolean;

  @Column(DataType.JSONB)
  declare resources?: Array<{ name: string; url: string; type: string }>;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @HasMany(() => LessonProgress)
  declare progresses: LessonProgress[];
}

@Table({ tableName: 'enrollments', paranoid: true })
export class Enrollment extends Model {
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

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  declare progressPercent: number;

  @Column(DataType.DATE)
  declare completedAt?: Date;

  @Column(DataType.UUID)
  declare lastLessonId?: string;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;
}

@Table({ tableName: 'lesson_progress', paranoid: true })
export class LessonProgress extends Model {
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
  @ForeignKey(() => Lesson)
  @Column(DataType.UUID)
  declare lessonId: string;

  @BelongsTo(() => Lesson)
  declare lesson: Lesson;

  @AllowNull(false)
  @ForeignKey(() => Course)
  @Column(DataType.UUID)
  declare courseId: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isCompleted: boolean;

  @Default(0)
  @Column(DataType.INTEGER)
  declare watchedSeconds: number;

  @Column(DataType.DATE)
  declare completedAt?: Date;

  @Default(0)
  @Column(DataType.INTEGER)
  declare playbackPosition: number;
}

@Table({ tableName: 'reviews', paranoid: true })
export class Review extends Model {
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
  @Column(DataType.INTEGER)
  declare rating: number;

  @Column(DataType.TEXT)
  declare comment?: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isVisible: boolean;
}
