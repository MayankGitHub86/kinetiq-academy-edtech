import {
  Table, Column, Model, DataType, Default, AllowNull,
  ForeignKey, BelongsTo
} from 'sequelize-typescript';
import { User } from './User';
import { Course, Lesson } from './Course';

export enum OrderStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Table({ tableName: 'orders', paranoid: true })
export class Order extends Model {
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
  @Column(DataType.DECIMAL(10, 2))
  declare amount: number;

  @Default('USD')
  @Column(DataType.STRING)
  declare currency: string;

  @Default(OrderStatus.PENDING)
  @Column(DataType.ENUM(...Object.values(OrderStatus)))
  declare status: OrderStatus;

  @Column(DataType.STRING)
  declare paymentIntentId?: string;

  @Column(DataType.STRING)
  declare receiptUrl?: string;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @Column(DataType.DATE)
  declare paidAt?: Date;
}

export enum QuizAttemptStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Table({ tableName: 'quiz_attempts', paranoid: true })
export class QuizAttempt extends Model {
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

  @Column(DataType.JSONB)
  declare answers?: Record<string, any>;

  @Column(DataType.INTEGER)
  declare score?: number;

  @Column(DataType.INTEGER)
  declare timeTakenSeconds?: number;

  @Default(QuizAttemptStatus.IN_PROGRESS)
  @Column(DataType.ENUM(...Object.values(QuizAttemptStatus)))
  declare status: QuizAttemptStatus;

  @Column(DataType.DATE)
  declare startedAt?: Date;

  @Column(DataType.DATE)
  declare completedAt?: Date;
}

export enum NotificationType {
  COURSE_PUBLISHED = 'course_published',
  ENROLLMENT = 'enrollment',
  LESSON_COMPLETE = 'lesson_complete',
  COURSE_COMPLETE = 'course_complete',
  LIVE_CLASS_STARTING = 'live_class_starting',
  ASSIGNMENT_DUE = 'assignment_due',
  NEW_REVIEW = 'new_review',
  PAYMENT_SUCCESS = 'payment_success',
  WELCOME = 'welcome',
  SYSTEM = 'system',
}

@Table({ tableName: 'notifications', paranoid: true })
export class Notification extends Model {
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
  @Column(DataType.ENUM(...Object.values(NotificationType)))
  declare type: NotificationType;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isRead: boolean;

  @Column(DataType.JSONB)
  declare metadata?: Record<string, any>;

  @Column(DataType.STRING)
  declare actionUrl?: string;
}

@Table({ tableName: 'certificates', paranoid: true })
export class Certificate extends Model {
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

  @Column(DataType.STRING)
  declare certificateUrl?: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare issueId: string;

  @Column(DataType.DATE)
  declare issuedAt?: Date;
}

@Table({ tableName: 'live_sessions', paranoid: true })
export class LiveSession extends Model {
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

  @BelongsTo(() => User, 'instructorId')
  declare instructor: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @Column(DataType.TEXT)
  declare description?: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare scheduledAt: Date;

  @Column(DataType.INTEGER)
  declare durationMinutes?: number;

  @Column(DataType.STRING)
  declare meetingUrl?: string;

  @Column(DataType.STRING)
  declare livekitRoomName?: string;

  @Column(DataType.STRING)
  declare recordingUrl?: string;

  @Column(DataType.INTEGER)
  declare attendeeCount?: number;

  @Column(DataType.DATE)
  declare startedAt?: Date;

  @Column(DataType.DATE)
  declare endedAt?: Date;

  @Column(DataType.STRING)
  declare status?: string;
}

@Table({ tableName: 'analytics_events', paranoid: false })
export class AnalyticsEvent extends Model {
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID, primaryKey: true })
  declare id: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId?: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare eventName: string;

  @Column(DataType.JSONB)
  declare eventData?: Record<string, any>;

  @Column(DataType.STRING)
  declare userAgent?: string;

  @Column(DataType.STRING)
  declare ipAddress?: string;

  @Column(DataType.STRING)
  declare sessionId?: string;
}
