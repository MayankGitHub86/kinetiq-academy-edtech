import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const {
  JWT_ACCESS_SECRET = 'fallback-access-secret',
  JWT_REFRESH_SECRET = 'fallback-refresh-secret',
  JWT_ACCESS_EXPIRES_IN = '15m',
  JWT_REFRESH_EXPIRES_IN = '30d',
} = process.env;

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export const generateAccessToken = (payload: Omit<TokenPayload, 'sessionId'> & { sessionId: string }): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: Omit<TokenPayload, 'sessionId'> & { sessionId: string }): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};

export const generateSessionId = (): string => {
  return crypto.randomUUID();
};

export const generateSecureToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};
