const { PrismaClient } = require('@prisma/client');

class InteractionLogger {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Log a message interaction
   */
  async logMessage(organizationId, patientId, channel, direction, payload, externalMessageId = null) {
    const messageLog = await this.prisma.patientMessageLog.create({
      data: {
        organizationId,
        patientId,
        channel,
        direction,
        payload,
        externalMessageId,
      },
    });

    return messageLog;
  }

  /**
   * Log a call interaction
   */
  async logCall(organizationId, patientId, callSid, status, startTime, callMetadata = {}) {
    const callLog = await this.prisma.patientCallLog.create({
      data: {
        organizationId,
        patientId,
        callSid,
        status,
        startTime: new Date(startTime),
        callMetadata,
      },
    });

    return callLog;
  }

  /**
   * Update call log with end time and duration
   */
  async updateCallEnd(callLogId, endTime, durationSeconds, transcription = null, summary = null) {
    const callLog = await this.prisma.patientCallLog.update({
      where: { id: callLogId },
      data: {
        endTime: new Date(endTime),
        durationSeconds,
        transcription,
        summary,
      },
    });

    return callLog;
  }

  /**
   * Get recent messages for a patient
   */
  async getRecentMessages(patientId, limit = 20) {
    const messages = await this.prisma.patientMessageLog.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages;
  }

  /**
   * Get recent calls for a patient
   */
  async getRecentCalls(patientId, limit = 20) {
    const calls = await this.prisma.patientCallLog.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return calls;
  }

  /**
   * Get messages by channel
   */
  async getMessagesByChannel(organizationId, channel, limit = 50) {
    const messages = await this.prisma.patientMessageLog.findMany({
      where: {
        organizationId,
        channel,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    return messages;
  }

  /**
   * Get call statistics
   */
  async getCallStatistics(organizationId, startDate = null, endDate = null) {
    const calls = await this.prisma.patientCallLog.findMany({
      where: {
        organizationId,
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        } : {}),
      },
    });

    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'COMPLETED').length;
    const failedCalls = calls.filter(c => c.status === 'FAILED').length;
    const missedCalls = calls.filter(c => c.status === 'MISSED').length;

    const totalDuration = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      missedCalls,
      successRate: totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0,
      totalDuration,
      avgDuration,
    };
  }

  /**
   * Get message statistics
   */
  async getMessageStatistics(organizationId, startDate = null, endDate = null) {
    const messages = await this.prisma.patientMessageLog.findMany({
      where: {
        organizationId,
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        } : {}),
      },
    });

    const inbound = messages.filter(m => m.direction === 'INBOUND').length;
    const outbound = messages.filter(m => m.direction === 'OUTBOUND').length;
    const byChannel = {};

    for (const message of messages) {
      byChannel[message.channel] = (byChannel[message.channel] || 0) + 1;
    }

    return {
      totalMessages: messages.length,
      inbound,
      outbound,
      byChannel,
    };
  }

  /**
   * Export patient interaction history
   */
  async exportPatientHistory(patientId) {
    const [messages, calls, notes] = await Promise.all([
      this.getRecentMessages(patientId, 100),
      this.getRecentCalls(patientId, 100),
      this.prisma.patientNote.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return {
      messages,
      calls,
      notes,
      exportedAt: new Date(),
    };
  }

  /**
   * Delete old interaction logs
   */
  async deleteOldLogs(organizationId, daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const [messagesDeleted, callsDeleted] = await Promise.all([
      this.prisma.patientMessageLog.deleteMany({
        where: {
          organizationId,
          createdAt: { lt: cutoffDate },
        },
      }),
      this.prisma.patientCallLog.deleteMany({
        where: {
          organizationId,
          createdAt: { lt: cutoffDate },
        },
      }),
    ]);

    return {
      messagesDeleted: messagesDeleted.count,
      callsDeleted: callsDeleted.count,
    };
  }
}

module.exports = InteractionLogger;
