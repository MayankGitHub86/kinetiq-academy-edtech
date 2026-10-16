import crypto from 'crypto';
import { User, UserRole } from '../models/User';
import { Profile } from '../models/Profile';
import { sequelize } from '../config/database';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSessionId,
  generateSecureToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../utils/email';

export interface RegisterDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<User['toSafeJSON']>;
}

class AuthService {
  async register(dto: RegisterDTO): Promise<AuthTokens> {
    const existing = await User.findOne({ where: { email: dto.email } });
    if (existing) throw createError('Email already registered', 409);

    const verificationToken = generateSecureToken(32);
    const transaction = await User.sequelize!.transaction();
    try {
      const user = await User.create({
        email: dto.email.toLowerCase(),
        passwordHash: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || UserRole.STUDENT,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }, { transaction });

      await Profile.create({
        userId: user.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
      }, { transaction });

      await transaction.commit();

      logger.info(`New user registered: ${user.email} (${user.role})`);
      const tokens = this.generateTokenPair(user);

      // Send welcome & verification emails (non-blocking)
      sendWelcomeEmail(user.email, dto.firstName).catch(() => {});
      sendVerificationEmail(user.email, dto.firstName, verificationToken).catch(() => {});

      return { ...tokens, user: user.toSafeJSON() };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async login(dto: LoginDTO): Promise<AuthTokens> {
    const user = await User.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw createError('Invalid email or password', 401);
    if (!user.isActive) throw createError('Account is disabled', 403);

    const isValid = await user.validatePassword(dto.password);
    if (!isValid) throw createError('Invalid email or password', 401);

    await user.update({ lastLoginAt: new Date() });
    logger.info(`User logged in: ${user.email}`);

    const tokens = this.generateTokenPair(user);
    return { ...tokens, user: user.toSafeJSON() };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw createError('Invalid or expired refresh token', 401);
    }

    // Check if refresh token is blacklisted
    const blacklisted = await cacheGet(`blacklist:${payload.sessionId}`);
    if (blacklisted) throw createError('Token revoked', 401);

    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) throw createError('User not found', 401);

    // Blacklist old session
    await cacheSet(`blacklist:${payload.sessionId}`, '1', 30 * 24 * 60 * 60);

    const tokens = this.generateTokenPair(user);
    return { ...tokens, user: user.toSafeJSON() };
  }

  async logout(sessionId: string): Promise<void> {
    await cacheSet(`blacklist:${sessionId}`, '1', 30 * 24 * 60 * 60);
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await User.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) throw createError('Invalid verification token', 400);
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw createError('Verification token expired', 400);
    }

    await user.update({
      isEmailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpires: undefined,
    });

    return user;
  }

  async requestPasswordReset(email: string): Promise<string> {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return 'If this email exists, a reset link has been sent';

    const resetToken = generateSecureToken(32);
    await user.update({
      passwordResetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Send reset email (non-blocking)
    sendPasswordResetEmail(user.email, user.firstName || user.email, resetToken).catch(() => {});

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      where: { passwordResetToken: hashedToken },
    });

    if (!user) throw createError('Invalid or expired reset token', 400);
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      throw createError('Reset token has expired', 400);
    }

    await user.update({
      passwordHash: newPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });
  }

  private generateTokenPair(user: User): { accessToken: string; refreshToken: string } {
    const sessionId = generateSessionId();
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };
    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }
}

export const authService = new AuthService();
