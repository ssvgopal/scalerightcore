const { PrismaClient } = require('@prisma/client');

class ConversationSessionService {
  constructor(prisma, redis = null) {
    this.prisma = prisma;
    this.redis = redis;
    this.cacheKeyPrefix = 'conversation_session:';
    this.sessionTTL = 3600; // 1 hour in seconds
  }

  /**
   * Create or get a conversation session
   */
  async getOrCreateSession(organizationId, patientPhone) {
    const sessionKey = this.generateSessionKey(organizationId, patientPhone);

    // Try to get from cache first (if Redis is available)
    if (this.redis) {
      try {
        const cachedSession = await this.redis.get(
          `${this.cacheKeyPrefix}${sessionKey}`
        );
        if (cachedSession) {
          return JSON.parse(cachedSession);
        }
      } catch (error) {
        console.warn('Redis cache miss, falling back to database', error);
      }
    }

    // Try to find existing session in database
    let session = await this.prisma.conversationSession.findUnique({
      where: { sessionKey },
    });

    if (!session) {
      // Create new session
      session = await this.prisma.conversationSession.create({
        data: {
          organizationId,
          patientPhone,
          sessionKey,
        },
      });
    } else if (!session.isActive) {
      // Reactivate if inactive
      session = await this.prisma.conversationSession.update({
        where: { id: session.id },
        data: { isActive: true },
      });
    }

    // Cache in Redis if available
    if (this.redis) {
      try {
        await this.redis.setex(
          `${this.cacheKeyPrefix}${sessionKey}`,
          this.sessionTTL,
          JSON.stringify(session)
        );
      } catch (error) {
        console.warn('Failed to cache session in Redis', error);
      }
    }

    return session;
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId) {
    const session = await this.prisma.conversationSession.findUnique({
      where: { id: sessionId },
    });

    return session;
  }

  /**
   * Get session by key
   */
  async getSessionByKey(sessionKey) {
    const session = await this.prisma.conversationSession.findUnique({
      where: { sessionKey },
    });

    return session;
  }

  /**
   * Update session state
   */
  async updateSessionState(sessionId, stateUpdates) {
    const session = await this.getSessionById(sessionId);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Merge state updates
    const newState = {
      ...session.stateJson,
      ...stateUpdates,
      lastUpdated: new Date().toISOString(),
    };

    const updatedSession = await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        stateJson: newState,
        lastActivityAt: new Date(),
      },
    });

    // Update cache if Redis is available
    if (this.redis) {
      try {
        await this.redis.setex(
          `${this.cacheKeyPrefix}${session.sessionKey}`,
          this.sessionTTL,
          JSON.stringify(updatedSession)
        );
      } catch (error) {
        console.warn('Failed to update Redis cache', error);
      }
    }

    return updatedSession;
  }

  /**
   * Get session state
   */
  async getSessionState(sessionId) {
    const session = await this.getSessionById(sessionId);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    return session.stateJson;
  }

  /**
   * End session
   */
  async endSession(sessionId) {
    const session = await this.prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    // Remove from cache if Redis is available
    if (this.redis) {
      try {
        await this.redis.del(`${this.cacheKeyPrefix}${session.sessionKey}`);
      } catch (error) {
        console.warn('Failed to remove session from Redis cache', error);
      }
    }

    return session;
  }

  /**
   * End all sessions for a patient
   */
  async endPatientSessions(organizationId, patientPhone) {
    const sessions = await this.prisma.conversationSession.findMany({
      where: {
        organizationId,
        patientPhone,
        isActive: true,
      },
    });

    const endedSessions = await Promise.all(
      sessions.map(session => this.endSession(session.id))
    );

    return endedSessions;
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(organizationId = null) {
    const sessions = await this.prisma.conversationSession.findMany({
      where: {
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(maxInactiveHours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxInactiveHours);

    const expiredSessions = await this.prisma.conversationSession.findMany({
      where: {
        isActive: false,
        endedAt: { lt: cutoffTime },
      },
    });

    // Delete expired sessions
    const deleted = await this.prisma.conversationSession.deleteMany({
      where: {
        isActive: false,
        endedAt: { lt: cutoffTime },
      },
    });

    // Clean up from Redis cache
    if (this.redis && expiredSessions.length > 0) {
      try {
        const cacheKeys = expiredSessions.map(s =>
          `${this.cacheKeyPrefix}${s.sessionKey}`
        );
        await Promise.all(cacheKeys.map(key => this.redis.del(key)));
      } catch (error) {
        console.warn('Failed to clean Redis cache', error);
      }
    }

    return {
      deletedCount: deleted.count,
      totalProcessed: expiredSessions.length,
    };
  }

  /**
   * Generate session key
   */
  generateSessionKey(organizationId, patientPhone) {
    // Normalize phone by removing special characters
    const normalizedPhone = patientPhone.replace(/\D/g, '');
    return `${organizationId}:${normalizedPhone}`;
  }

  /**
   * Store temporary conversation context in Redis (optional)
   */
  async storeTempContext(organizationId, patientPhone, contextData, ttlSeconds = 3600) {
    if (!this.redis) {
      return null;
    }

    const cacheKey = `temp_context:${organizationId}:${patientPhone}`;

    try {
      await this.redis.setex(
        cacheKey,
        ttlSeconds,
        JSON.stringify(contextData)
      );
      return contextData;
    } catch (error) {
      console.warn('Failed to store temporary context in Redis', error);
      return null;
    }
  }

  /**
   * Retrieve temporary conversation context from Redis
   */
  async getTempContext(organizationId, patientPhone) {
    if (!this.redis) {
      return null;
    }

    const cacheKey = `temp_context:${organizationId}:${patientPhone}`;

    try {
      const cachedData = await this.redis.get(cacheKey);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.warn('Failed to retrieve temporary context from Redis', error);
      return null;
    }
  }

  /**
   * Clear temporary context
   */
  async clearTempContext(organizationId, patientPhone) {
    if (!this.redis) {
      return false;
    }

    const cacheKey = `temp_context:${organizationId}:${patientPhone}`;

    try {
      await this.redis.del(cacheKey);
      return true;
    } catch (error) {
      console.warn('Failed to clear temporary context from Redis', error);
      return false;
    }
  }
}

module.exports = ConversationSessionService;
