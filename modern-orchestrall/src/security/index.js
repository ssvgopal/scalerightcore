// src/security/index.js - Enterprise Security System
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const config = require('../config');
const logger = require('../utils/logger');

class SecurityService {
  constructor() {
    this.failedAttempts = new Map();
    this.blockedIPs = new Set();
    this.suspiciousActivities = new Map();
    this.apiKeys = new Map();
    this.initializeSecurity();
  }

  initializeSecurity() {
    // Initialize security policies
    this.policies = {
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      suspiciousActivityThreshold: 10,
      apiKeyExpiration: 90 * 24 * 60 * 60 * 1000, // 90 days
      passwordMinLength: 12,
      passwordRequireSpecial: true,
      passwordRequireNumbers: true,
      passwordRequireUppercase: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
    };

    logger.info('Security service initialized with enterprise policies');
  }

  // Password Security
  validatePassword(password) {
    const errors = [];

    if (password.length < this.policies.passwordMinLength) {
      errors.push(`Password must be at least ${this.policies.passwordMinLength} characters long`);
    }

    if (this.policies.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.policies.passwordRequireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.policies.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check against common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async hashPassword(password) {
    const saltRounds = config.security.bcryptRounds || 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // JWT Security
  generateTokens(user, additionalClaims = {}) {
    const payload = {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles || ['user'],
      permissions: user.permissions || ['read'],
      iat: Math.floor(Date.now() / 1000),
      ...additionalClaims,
    };

    const accessToken = jwt.sign(payload, config.security.jwtSecret, {
      expiresIn: config.security.jwtExpiresIn,
      issuer: 'orchestrall-platform',
      audience: 'orchestrall-users',
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh', iat: Math.floor(Date.now() / 1000) },
      config.security.jwtSecret,
      { 
        expiresIn: config.security.jwtRefreshExpiresIn || '7d',
        issuer: 'orchestrall-platform',
        audience: 'orchestrall-users',
      }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.security.jwtSecret, {
        issuer: 'orchestrall-platform',
        audience: 'orchestrall-users',
      });
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Rate Limiting
  createRateLimiter(options = {}) {
    const defaultOptions = {
      windowMs: config.security.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
      max: config.security.rateLimitMax || 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((config.security.rateLimitWindow || 15 * 60 * 1000) / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      ...options,
    };

    return rateLimit(defaultOptions);
  }

  // Brute Force Protection
  recordFailedAttempt(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.failedAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    this.failedAttempts.set(key, attempts);

    // Log security event
    logger.securityEvent('failed_login_attempt', {
      identifier,
      ip,
      attemptCount: attempts.count,
      timestamp: new Date().toISOString(),
    });

    // Check if threshold exceeded
    if (attempts.count >= this.policies.maxFailedAttempts) {
      this.blockIP(ip, this.policies.lockoutDuration);
      logger.securityEvent('ip_blocked', {
        ip,
        reason: 'excessive_failed_attempts',
        duration: this.policies.lockoutDuration,
      });
    }
  }

  isBlocked(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.failedAttempts.get(key);
    
    if (!attempts) return false;

    // Check if still within lockout period
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt < this.policies.lockoutDuration) {
      return attempts.count >= this.policies.maxFailedAttempts;
    }

    // Reset if lockout period has passed
    this.failedAttempts.delete(key);
    return false;
  }

  blockIP(ip, duration) {
    this.blockedIPs.add(ip);
    
    // Auto-unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info('IP unblocked', { ip });
    }, duration);
  }

  isIPBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  // API Key Management
  generateAPIKey() {
    const key = crypto.randomBytes(32).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    
    return {
      key: `orchestrall_${key}`,
      hashedKey,
    };
  }

  async createAPIKey(userId, organizationId, permissions = ['read'], expiresIn = null) {
    const { key, hashedKey } = this.generateAPIKey();
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : null;

    const apiKeyData = {
      id: crypto.randomUUID(),
      userId,
      organizationId,
      hashedKey,
      permissions,
      createdAt: new Date(),
      expiresAt,
      lastUsedAt: null,
      usageCount: 0,
    };

    this.apiKeys.set(hashedKey, apiKeyData);

    logger.securityEvent('api_key_created', {
      userId,
      organizationId,
      permissions,
      expiresAt,
    });

    return {
      id: apiKeyData.id,
      key,
      permissions,
      expiresAt,
    };
  }

  async validateAPIKey(key) {
    if (!key.startsWith('orchestrall_')) {
      return null;
    }

    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    const apiKeyData = this.apiKeys.get(hashedKey);

    if (!apiKeyData) {
      return null;
    }

    // Check expiration
    if (apiKeyData.expiresAt && new Date() > apiKeyData.expiresAt) {
      this.apiKeys.delete(hashedKey);
      logger.securityEvent('api_key_expired', { keyId: apiKeyData.id });
      return null;
    }

    // Update usage
    apiKeyData.lastUsedAt = new Date();
    apiKeyData.usageCount++;

    return {
      id: apiKeyData.id,
      userId: apiKeyData.userId,
      organizationId: apiKeyData.organizationId,
      permissions: apiKeyData.permissions,
    };
  }

  async revokeAPIKey(keyId) {
    for (const [hashedKey, data] of this.apiKeys.entries()) {
      if (data.id === keyId) {
        this.apiKeys.delete(hashedKey);
        logger.securityEvent('api_key_revoked', { keyId });
        return true;
      }
    }
    return false;
  }

  // Input Sanitization
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  validateURL(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  // Encryption
  encrypt(text, key = config.security.jwtSecret) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(encryptedData, key = config.security.jwtSecret) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, key);
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Audit Logging
  logSecurityEvent(event, details = {}) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity: this.getEventSeverity(event),
    };

    logger.securityEvent(event, auditLog);

    // Store in suspicious activities if needed
    if (this.getEventSeverity(event) === 'high') {
      this.recordSuspiciousActivity(event, details);
    }
  }

  getEventSeverity(event) {
    const highSeverityEvents = [
      'failed_login_attempt',
      'ip_blocked',
      'api_key_compromised',
      'unauthorized_access',
      'data_breach_attempt',
    ];

    const mediumSeverityEvents = [
      'api_key_created',
      'api_key_revoked',
      'password_changed',
      'permissions_modified',
    ];

    if (highSeverityEvents.includes(event)) return 'high';
    if (mediumSeverityEvents.includes(event)) return 'medium';
    return 'low';
  }

  recordSuspiciousActivity(event, details) {
    const key = `${details.ip || 'unknown'}:${event}`;
    const activities = this.suspiciousActivities.get(key) || [];
    
    activities.push({
      timestamp: new Date().toISOString(),
      event,
      details,
    });

    this.suspiciousActivities.set(key, activities);

    // Check threshold
    if (activities.length >= this.policies.suspiciousActivityThreshold) {
      logger.securityEvent('suspicious_activity_threshold_exceeded', {
        key,
        activityCount: activities.length,
        activities: activities.slice(-5), // Last 5 activities
      });
    }
  }

  // Security Headers
  getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  // Session Management
  createSession(userId, organizationId, metadata = {}) {
    const sessionId = crypto.randomUUID();
    const sessionData = {
      id: sessionId,
      userId,
      organizationId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + this.policies.sessionTimeout),
      metadata,
    };

    return sessionData;
  }

  validateSession(sessionData) {
    if (!sessionData) return false;
    
    const now = new Date();
    return now < sessionData.expiresAt;
  }

  // Compliance
  generateComplianceReport() {
    return {
      timestamp: new Date().toISOString(),
      securityPolicies: this.policies,
      activeBlocks: Array.from(this.blockedIPs),
      failedAttempts: Object.fromEntries(this.failedAttempts),
      apiKeysCount: this.apiKeys.size,
      suspiciousActivities: Object.fromEntries(this.suspiciousActivities),
    };
  }
}

// Create singleton instance
const securityService = new SecurityService();

module.exports = securityService;
