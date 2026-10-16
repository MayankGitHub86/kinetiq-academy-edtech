import Stripe from 'stripe';
import { Course, Enrollment } from '../models/Course';
import { Order, OrderStatus, Notification, NotificationType } from '../models/Transaction';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { sendEnrollmentConfirmation, sendPaymentReceipt } from '../utils/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-08-26.dahlia' as any,
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

class PaymentService {
  /**
   * Create a Stripe Checkout Session for purchasing a course.
   */
  async createCheckoutSession(userId: string, courseId: string, successUrl: string, cancelUrl: string) {
    const course = await Course.findByPk(courseId);
    if (!course) throw createError('Course not found', 404);
    if (course.isFree) throw createError('This course is free. Enroll directly.', 400);

    const existing = await Enrollment.findOne({ where: { userId, courseId } });
    if (existing) throw createError('Already enrolled in this course', 409);

    let user = await User.findByPk(userId);
    if (!user) throw createError('User not found', 404);

    // Ensure Stripe customer exists
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: course.currency || 'usd',
            product_data: {
              name: course.title,
              description: course.shortDescription || '',
              images: course.thumbnailUrl ? [course.thumbnailUrl] : [],
              metadata: { courseId },
            },
            unit_amount: Math.round(Number(course.price) * 100),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, courseId },
    });

    // Create a pending order
    await Order.create({
      userId,
      courseId,
      amount: course.price,
      currency: course.currency || 'usd',
      status: OrderStatus.PENDING,
      stripeSessionId: session.id,
    });

    logger.info(`Checkout session created for user ${userId} course ${courseId}`);
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Create a PaymentIntent for embedded checkout flow.
   */
  async createPaymentIntent(userId: string, courseId: string) {
    const course = await Course.findByPk(courseId);
    if (!course) throw createError('Course not found', 404);

    const existing = await Enrollment.findOne({ where: { userId, courseId } });
    if (existing) throw createError('Already enrolled', 409);

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(course.price) * 100),
      currency: course.currency || 'usd',
      metadata: { userId, courseId },
      automatic_payment_methods: { enabled: true },
    });

    return { clientSecret: intent.client_secret, amount: course.price, currency: course.currency || 'usd' };
  }

  /**
   * Handle Stripe webhook events.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    } catch (err: any) {
      logger.error('Webhook signature verification failed:', err.message);
      throw createError(`Webhook error: ${err.message}`, 400);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        logger.debug(`Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { userId, courseId } = session.metadata || {};
    if (!userId || !courseId) return;

    const order = await Order.findOne({ where: { stripeSessionId: session.id } });
    if (!order) return;

    // Complete the order
    await order.update({
      status: OrderStatus.COMPLETED,
      stripePaymentIntentId: session.payment_intent as string,
      paidAt: new Date(),
    });

    // Enroll the student
    const existing = await Enrollment.findOne({ where: { userId, courseId } });
    if (!existing) {
      await Enrollment.create({ userId, courseId });
      await Course.increment('totalEnrollments', { where: { id: courseId } });
    }

    // Send notifications and email
    const [user, course] = await Promise.all([
      User.findByPk(userId),
      Course.findByPk(courseId),
    ]);

    if (user && course) {
      // In-app notification
      await Notification.create({
        userId,
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment Successful',
        body: `You've successfully enrolled in "${course.title}"`,
        data: { courseId, orderId: order.id },
        actionUrl: `/courses/${course.slug}`,
      });

      // Email
      sendEnrollmentConfirmation(user.email, user.firstName || 'there', course.title, course.slug).catch(() => {});
      sendPaymentReceipt(
        user.email,
        user.firstName || 'there',
        course.title,
        Number(order.amount),
        order.currency,
        order.id
      ).catch(() => {});
    }

    logger.info(`Payment completed: user ${userId} enrolled in course ${courseId}`);
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const { userId, courseId } = paymentIntent.metadata || {};
    if (!userId || !courseId) return;

    // Mark pending order as completed
    await Order.update(
      { status: OrderStatus.COMPLETED, paidAt: new Date(), stripePaymentIntentId: paymentIntent.id },
      { where: { userId, courseId, status: OrderStatus.PENDING } }
    );

    // Enroll if not already
    const existing = await Enrollment.findOne({ where: { userId, courseId } });
    if (!existing) {
      await Enrollment.create({ userId, courseId });
      await Course.increment('totalEnrollments', { where: { id: courseId } });
    }

    logger.info(`PaymentIntent succeeded: user ${userId}, course ${courseId}`);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const { userId, courseId } = paymentIntent.metadata || {};
    if (!userId || !courseId) return;

    await Order.update(
      { status: OrderStatus.FAILED },
      { where: { userId, courseId, status: OrderStatus.PENDING } }
    );

    logger.warn(`Payment failed: user ${userId}, course ${courseId}`);
  }

  /**
   * Get order history for a user.
   */
  async getOrderHistory(userId: string, page = 1, limit = 20) {
    const { count, rows } = await Order.findAndCountAll({
      where: { userId },
      include: [{ model: Course, attributes: ['id', 'title', 'slug', 'thumbnailUrl'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { orders: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) };
  }

  /**
   * Request a refund (admin action).
   */
  async refundOrder(orderId: string) {
    const order = await Order.findByPk(orderId);
    if (!order) throw createError('Order not found', 404);
    if (order.status !== OrderStatus.COMPLETED) throw createError('Only completed orders can be refunded', 400);
    if (!order.paymentIntentId) throw createError('No payment intent associated', 400);

    await stripe.refunds.create({ payment_intent: order.paymentIntentId });
    await order.update({ status: OrderStatus.REFUNDED });

    // Deactivate enrollment
    await Enrollment.update(
      { isActive: false },
      { where: { userId: order.userId, courseId: order.courseId } }
    );

    logger.info(`Refund processed for order ${orderId}`);
    return order;
  }
}

export const paymentService = new PaymentService();
