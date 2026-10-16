import nodemailer from 'nodemailer';
import type { Transporter, TransportOptions } from 'nodemailer';
import { logger } from '../utils/logger';

const {
  SMTP_HOST = 'smtp.gmail.com',
  SMTP_PORT = '587',
  SMTP_SECURE = 'false',
  SMTP_USER = '',
  SMTP_PASS = '',
  EMAIL_FROM = 'Kinetiq Academy <noreply@kinetiqacademy.com>',
  APP_NAME = 'Kinetiq Academy',
  APP_URL = 'http://localhost:4000',
} = process.env;

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

const getTransporter = (): ReturnType<typeof nodemailer.createTransport> => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT),
      secure: SMTP_SECURE === 'true',
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const send = async (opts: EmailOptions): Promise<void> => {
  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: EMAIL_FROM,
      ...opts,
    });
    logger.info(`📧 Email sent to ${opts.to}: ${opts.subject}`);
  } catch (err) {
    logger.error(`❌ Email send failed to ${opts.to}:`, err);
    // Non-fatal - don't throw
  }
};

// ─── Templates ─────────────────────────────────────────────────────────────

const baseTemplate = (title: string, body: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 40px; color: #374151; line-height: 1.6; }
    .btn { display: inline-block; background: #6366f1; color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 24px 0; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 40px; text-align: center; color: #9ca3af; font-size: 12px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎓 ${APP_NAME}</h1>
      <p>Your gateway to premium learning</p>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>You received this email because you have an account with us.</p>
    </div>
  </div>
</body>
</html>
`;

// ─── Email Senders ──────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (to: string, firstName: string): Promise<void> => {
  await send({
    to,
    subject: `Welcome to ${APP_NAME}, ${firstName}! 🎉`,
    html: baseTemplate('Welcome', `
      <h2>Welcome aboard, ${firstName}!</h2>
      <p>We're thrilled to have you join the Kinetiq Academy community. Your learning journey starts now.</p>
      <p>Here's what you can do:</p>
      <ul>
        <li>🎯 Browse hundreds of expert-led courses</li>
        <li>📱 Learn at your own pace, anywhere</li>
        <li>🏆 Earn certificates upon completion</li>
        <li>🤝 Join a global community of learners</li>
      </ul>
      <a href="${APP_URL}/explore" class="btn">Explore Courses</a>
    `),
  });
};

export const sendVerificationEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  await send({
    to,
    subject: `Verify your ${APP_NAME} email address`,
    html: baseTemplate('Verify Email', `
      <h2>Hi ${firstName},</h2>
      <p>Please verify your email address to activate your account. This link expires in 24 hours.</p>
      <a href="${verifyUrl}" class="btn">Verify Email</a>
      <hr class="divider">
      <p style="color: #6b7280; font-size: 13px;">Or copy and paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color: #6366f1;">${verifyUrl}</a></p>
    `),
  });
};

export const sendPasswordResetEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await send({
    to,
    subject: `Reset your ${APP_NAME} password`,
    html: baseTemplate('Reset Password', `
      <h2>Hi ${firstName},</h2>
      <p>We received a request to reset your password. Click the button below to proceed. This link expires in 1 hour.</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <hr class="divider">
      <p style="color: #6b7280; font-size: 13px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
    `),
  });
};

export const sendEnrollmentConfirmation = async (
  to: string,
  firstName: string,
  courseTitle: string,
  courseSlug: string
): Promise<void> => {
  const courseUrl = `${APP_URL}/courses/${courseSlug}`;
  await send({
    to,
    subject: `You're enrolled in: ${courseTitle}`,
    html: baseTemplate('Enrollment Confirmed', `
      <h2>Congrats, ${firstName}! 🎉</h2>
      <p>You've successfully enrolled in <strong>${courseTitle}</strong>. You're ready to start learning!</p>
      <a href="${courseUrl}" class="btn">Start Learning</a>
      <hr class="divider">
      <p style="color: #6b7280; font-size: 13px;">You can access this course anytime from your dashboard.</p>
    `),
  });
};

export const sendCourseCompletionEmail = async (
  to: string,
  firstName: string,
  courseTitle: string,
  certificateUrl?: string
): Promise<void> => {
  await send({
    to,
    subject: `You completed: ${courseTitle} 🏆`,
    html: baseTemplate('Course Completed', `
      <h2>Amazing work, ${firstName}! 🏆</h2>
      <p>You've successfully completed <strong>${courseTitle}</strong>. What an achievement!</p>
      ${certificateUrl ? `<a href="${certificateUrl}" class="btn">Download Certificate</a>` : ''}
      <hr class="divider">
      <p>Ready to keep growing? Browse our catalog for your next course.</p>
      <a href="${APP_URL}/explore" style="color: #6366f1;">Explore More Courses →</a>
    `),
  });
};

export const sendPaymentReceipt = async (
  to: string,
  firstName: string,
  courseTitle: string,
  amount: number,
  currency: string,
  orderId: string
): Promise<void> => {
  await send({
    to,
    subject: `Payment Receipt - ${courseTitle}`,
    html: baseTemplate('Payment Receipt', `
      <h2>Payment Confirmed ✅</h2>
      <p>Hi ${firstName}, your payment was successful!</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280;">Course</td>
          <td style="padding: 10px 0; font-weight: 600;">${courseTitle}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280;">Amount</td>
          <td style="padding: 10px 0; font-weight: 600;">${currency.toUpperCase()} ${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280;">Order ID</td>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">${orderId}</td>
        </tr>
      </table>
      <a href="${APP_URL}/dashboard" class="btn">Go to Dashboard</a>
    `),
  });
};

export const sendLiveSessionReminder = async (
  to: string,
  firstName: string,
  sessionTitle: string,
  scheduledAt: Date,
  joinUrl: string
): Promise<void> => {
  await send({
    to,
    subject: `Reminder: Live session starts soon - ${sessionTitle}`,
    html: baseTemplate('Live Session Reminder', `
      <h2>📹 Live Session Starting Soon!</h2>
      <p>Hi ${firstName}, your live session is about to begin.</p>
      <p><strong>${sessionTitle}</strong> starts at ${scheduledAt.toLocaleString()}</p>
      <a href="${joinUrl}" class="btn">Join Session</a>
    `),
  });
};
