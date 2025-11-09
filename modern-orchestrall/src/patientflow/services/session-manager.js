const cacheService = require('../../cache');
const database = require('../../database');
const config = require('../../config');
const logger = require('../../utils/logger');

const SESSION_PREFIX = 'patientflow:whatsapp:session';

class SessionManager {
  constructor() {
    this.prismaClient = null;
    this.sessionTtl = Math.max(parseInt(config.patientflow.session.ttlSeconds, 10) || 900, 60);
  }

  get prisma() {
    if (!this.prismaClient) {
      this.prismaClient = database.client;
    }

    return this.prismaClient;
  }

  buildCacheKey(organizationId, phone) {
    return `${SESSION_PREFIX}:${organizationId}:${phone}`;
  }

  buildSessionKey(organizationId, phone) {
    return `${organizationId}:${phone}`;
  }

  async getSession(organizationId, phone) {
    const cacheKey = this.buildCacheKey(organizationId, phone);

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        await cacheService.expire(cacheKey, this.sessionTtl);
        return cached;
      }
    } catch (error) {
      logger.warn('Failed to retrieve session from cache', {
        organizationId,
        phone,
        error: error.message,
      });
    }

    try {
      const sessionKey = this.buildSessionKey(organizationId, phone);
      const record = await this.prisma.conversationSession.findUnique({
        where: { sessionKey },
      });

      if (!record) {
        return null;
      }

      const state = Object.assign({}, record.stateJson || {}, {
        sessionKey,
        isActive: record.isActive,
        startedAt: record.startedAt,
        lastActivityAt: record.lastActivityAt,
        endedAt: record.endedAt,
      });

      await cacheService.set(cacheKey, state, this.sessionTtl);
      return state;
    } catch (error) {
      logger.error('Failed to load conversation session', {
        organizationId,
        phone,
        error: error.message,
      });

      return null;
    }
  }

  async saveSession(organizationId, phone, state) {
    const cacheKey = this.buildCacheKey(organizationId, phone);
    const sessionKey = this.buildSessionKey(organizationId, phone);
    const now = new Date();

    const upsertData = {
      organizationId,
      patientPhone: phone,
      sessionKey,
      stateJson: state,
      isActive: state.stage !== 'completed',
      metadata: state.metadata || {},
    };

    try {
      await this.prisma.conversationSession.upsert({
        where: { sessionKey },
        update: Object.assign({}, upsertData, {
          lastActivityAt: now,
          endedAt: state.stage === 'completed' ? now : null,
        }),
        create: Object.assign({}, upsertData, {
          startedAt: now,
        }),
      });
    } catch (error) {
      logger.error('Failed to persist conversation session', {
        organizationId,
        phone,
        error: error.message,
      });
    }

    try {
      await cacheService.set(cacheKey, Object.assign({}, state, {
        sessionKey,
        cachedAt: now.toISOString(),
      }), this.sessionTtl);
    } catch (error) {
      logger.warn('Failed to cache conversation session', {
        organizationId,
        phone,
        error: error.message,
      });
    }
  }

  async clearSession(organizationId, phone) {
    const cacheKey = this.buildCacheKey(organizationId, phone);
    const sessionKey = this.buildSessionKey(organizationId, phone);

    try {
      await cacheService.del(cacheKey);
    } catch (error) {
      logger.warn('Failed to delete session from cache', {
        organizationId,
        phone,
        error: error.message,
      });
    }

    try {
      await this.prisma.conversationSession.updateMany({
        where: { sessionKey },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to mark session inactive in database', {
        organizationId,
        phone,
        error: error.message,
      });
    }
  }
}

module.exports = new SessionManager();
