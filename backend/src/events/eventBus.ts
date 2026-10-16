import EventEmitter from 'events';
import { logger } from '../utils/logger';

// ─── Event Types ─────────────────────────────────────────────────────────────

export type KinetiqEvent =
  | { type: 'user.registered'; payload: { userId: string; email: string; firstName: string } }
  | { type: 'user.verified'; payload: { userId: string; email: string } }
  | { type: 'course.enrolled'; payload: { userId: string; courseId: string; courseTitle: string; courseSlug: string; userEmail: string; firstName: string } }
  | { type: 'course.completed'; payload: { userId: string; courseId: string; courseTitle: string; userEmail: string; firstName: string } }
  | { type: 'lesson.completed'; payload: { userId: string; lessonId: string; courseId: string; progressPercent: number } }
  | { type: 'quiz.passed'; payload: { userId: string; lessonId: string; score: number } }
  | { type: 'payment.completed'; payload: { userId: string; courseId: string; orderId: string; amount: number; currency: string } }
  | { type: 'live.scheduled'; payload: { courseId: string; instructorId: string; sessionId: string; scheduledAt: Date } }
  | { type: 'review.submitted'; payload: { userId: string; courseId: string; rating: number } };

// ─── Event Bus ────────────────────────────────────────────────────────────────

class EventBus extends EventEmitter {
  emit(event: KinetiqEvent['type'], payload: any): boolean {
    logger.debug(`📣 Event emitted: ${event}`);
    return super.emit(event, payload);
  }

  on(event: KinetiqEvent['type'], listener: (payload: any) => void): this {
    return super.on(event, listener);
  }

  publish<T extends KinetiqEvent>(event: T): void {
    this.emit(event.type, event.payload);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(20);

// ─── Event Handlers ───────────────────────────────────────────────────────────

// Handler: Notify via Socket.IO on enrollment
eventBus.on('course.enrolled', (payload) => {
  const io = (global as any).io;
  if (io) {
    io.to(`user:${payload.userId}`).emit('notification', {
      type: 'enrollment',
      message: `Successfully enrolled in ${payload.courseTitle}`,
    });
  }
});

// Handler: Notify instructor on new enrollment
eventBus.on('course.enrolled', async (payload) => {
  try {
    const io = (global as any).io;
    if (io) {
      io.to(`instructor:${payload.courseId}`).emit('enrollment', {
        courseId: payload.courseId,
        userId: payload.userId,
      });
    }
  } catch (err) {
    logger.error('Event handler error [course.enrolled]:', err);
  }
});

// Handler: Notify on lesson complete
eventBus.on('lesson.completed', async (payload) => {
  const io = (global as any).io;
  if (io) {
    io.to(`course:${payload.courseId}`).emit('lesson:progress', {
      userId: payload.userId,
      lessonId: payload.lessonId,
      progressPercent: payload.progressPercent,
    });
  }
});

// Handler: Notify on course complete
eventBus.on('course.completed', async (payload) => {
  const io = (global as any).io;
  if (io) {
    io.to(`user:${payload.userId}`).emit('course:completed', {
      courseId: payload.courseId,
      courseTitle: payload.courseTitle,
    });
  }
});

logger.debug('🎯 Event bus initialized');
