import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { paymentService } from '../services/payment.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { paginationMeta } from '../utils/response';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';
import express from 'express';

const router = Router();

// POST /api/v1/payments/checkout - Create Stripe Checkout Session
router.post(
  '/checkout',
  authenticate,
  [
    body('courseId').notEmpty().withMessage('courseId is required'),
    body('successUrl').isURL().withMessage('Valid successUrl is required'),
    body('cancelUrl').isURL().withMessage('Valid cancelUrl is required'),
  ],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { courseId, successUrl, cancelUrl } = req.body;
    const result = await paymentService.createCheckoutSession(
      req.userId!, courseId, successUrl, cancelUrl
    );
    sendCreated(res, result, 'Checkout session created');
  }
);

// POST /api/v1/payments/intent - Create PaymentIntent (embedded checkout)
router.post(
  '/intent',
  authenticate,
  [body('courseId').notEmpty().withMessage('courseId is required')],
  validate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await paymentService.createPaymentIntent(req.userId!, req.body.courseId);
    sendCreated(res, result, 'PaymentIntent created');
  }
);

// POST /api/v1/payments/webhook - Stripe webhook (raw body)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      sendError(res, 'Missing stripe-signature header', 400);
      return;
    }
    const rawBuffer = (req as any).rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body)));
    const result = await paymentService.handleWebhook(rawBuffer as Buffer, signature);
    res.json(result);
  }
);

// GET /api/v1/payments/orders - Get user's order history
router.get('/orders', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await paymentService.getOrderHistory(req.userId!, page, limit);
  sendSuccess(res, result.orders, 'Orders retrieved', 200, paginationMeta(result.total, page, limit));
});

// POST /api/v1/payments/refund/:orderId - Admin refund
router.post('/refund/:orderId', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const order = await paymentService.refundOrder(req.params.orderId as string);
  sendSuccess(res, order, 'Refund processed');
});

export default router;
