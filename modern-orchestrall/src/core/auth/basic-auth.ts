// src/core/auth/basic-auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export class BasicAuth {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = config.jwt.secret || 'default-secret-change-in-production';
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(payload: { userId: string; role: string }): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: config.jwt.accessTokenExpiry || '24h',
      issuer: 'orchestrall-platform',
      audience: 'orchestrall-users'
    });
  }

  verifyAccessToken(token: string): { userId: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'orchestrall-platform',
        audience: 'orchestrall-users'
      }) as any;

      return {
        userId: decoded.userId,
        role: decoded.role
      };
    } catch (error) {
      return null;
    }
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, {
      expiresIn: config.jwt.refreshTokenExpiry || '7d'
    });
  }
}
