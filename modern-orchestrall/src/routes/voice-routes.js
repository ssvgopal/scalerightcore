const SarvamVoiceService = require('../voice/sarvam-voice-service');

class VoiceRoutes {
  constructor(app, prisma) {
    this.app = app;
    this.prisma = prisma;
    this.voiceService = new SarvamVoiceService(prisma);
  }

  async initialize() {
    await this.voiceService.initialize();
    this.registerRoutes();
  }

  registerRoutes() {
    // Voice processing endpoints
    this.app.post('/api/voice/process', async (request, reply) => {
      try {
        const { audioData, farmerId, language = 'hi' } = request.body;

        if (!audioData || !farmerId) {
          return reply.status(400).send({
            error: 'Missing required fields: audioData, farmerId'
          });
        }

        const result = await this.voiceService.processVoiceInput(audioData, farmerId, language);
        
        reply.send({
          success: true,
          data: result
        });

      } catch (error) {
        console.error('Voice processing error:', error);
        reply.status(500).send({
          error: 'Failed to process voice input',
          message: error.message
        });
      }
    });

    // Get supported languages
    this.app.get('/api/voice/languages', async (request, reply) => {
      try {
        const languages = await this.voiceService.getSupportedLanguages();
        
        reply.send({
          success: true,
          data: languages
        });

      } catch (error) {
        console.error('Failed to get supported languages:', error);
        reply.status(500).send({
          error: 'Failed to get supported languages',
          message: error.message
        });
      }
    });

    // Get voice command templates
    this.app.get('/api/voice/commands', async (request, reply) => {
      try {
        const commands = Array.from(this.voiceService.voiceCommands.values()).map(cmd => ({
          id: cmd.id,
          name: cmd.name,
          patterns: cmd.patterns.map(p => ({
            language: p.language,
            pattern: p.pattern
          })),
          requiredData: cmd.requiredData
        }));
        
        reply.send({
          success: true,
          data: commands
        });

      } catch (error) {
        console.error('Failed to get voice commands:', error);
        reply.status(500).send({
          error: 'Failed to get voice commands',
          message: error.message
        });
      }
    });

    // Voice call analytics
    this.app.get('/api/voice/analytics', async (request, reply) => {
      try {
        const { organizationId, dateFrom, dateTo } = request.query;

        if (!organizationId) {
          return reply.status(400).send({
            error: 'Missing required parameter: organizationId'
          });
        }

        const analytics = await this.voiceService.getCallAnalytics(organizationId, {
          dateFrom,
          dateTo
        });
        
        reply.send({
          success: true,
          data: analytics
        });

      } catch (error) {
        console.error('Failed to get voice analytics:', error);
        reply.status(500).send({
          error: 'Failed to get voice analytics',
          message: error.message
        });
      }
    });

    // Get farmer's voice call history
    this.app.get('/api/voice/history/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const { limit = 10, offset = 0 } = request.query;

        const calls = await this.prisma.voiceCall.findMany({
          where: { farmerId },
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit),
          skip: parseInt(offset),
          select: {
            id: true,
            sessionId: true,
            language: true,
            duration: true,
            status: true,
            transcription: true,
            command: true,
            response: true,
            createdAt: true,
            metadata: true
          }
        });

        const totalCount = await this.prisma.voiceCall.count({
          where: { farmerId }
        });
        
        reply.send({
          success: true,
          data: {
            calls,
            pagination: {
              total: totalCount,
              limit: parseInt(limit),
              offset: parseInt(offset),
              hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
            }
          }
        });

      } catch (error) {
        console.error('Failed to get voice call history:', error);
        reply.status(500).send({
          error: 'Failed to get voice call history',
          message: error.message
        });
      }
    });

    // Test voice command (for development/testing)
    this.app.post('/api/voice/test', async (request, reply) => {
      try {
        const { transcription, farmerId, language = 'hi' } = request.body;

        if (!transcription || !farmerId) {
          return reply.status(400).send({
            error: 'Missing required fields: transcription, farmerId'
          });
        }

        // Simulate voice processing with text input
        const command = await this.voiceService.identifyCommand(transcription, language);
        const response = await this.voiceService.executeCommand(command, farmerId, language);
        
        reply.send({
          success: true,
          data: {
            transcription,
            command: command.id,
            response: response.text,
            language
          }
        });

      } catch (error) {
        console.error('Voice test error:', error);
        reply.status(500).send({
          error: 'Failed to test voice command',
          message: error.message
        });
      }
    });

    // Voice call statistics for dashboard
    this.app.get('/api/voice/stats', async (request, reply) => {
      try {
        const { organizationId } = request.query;

        if (!organizationId) {
          return reply.status(400).send({
            error: 'Missing required parameter: organizationId'
          });
        }

        const stats = await this.prisma.voiceCall.groupBy({
          by: ['status'],
          where: {
            farmer: {
              organizationId
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          _count: {
            id: true
          }
        });

        const totalCalls = await this.prisma.voiceCall.count({
          where: {
            farmer: {
              organizationId
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        });

        const avgDuration = await this.prisma.voiceCall.aggregate({
          where: {
            farmer: {
              organizationId
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          _avg: {
            duration: true
          }
        });

        const languageStats = await this.prisma.voiceCall.groupBy({
          by: ['language'],
          where: {
            farmer: {
              organizationId
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
          _count: {
            id: true
          }
        });
        
        reply.send({
          success: true,
          data: {
            totalCalls,
            averageDuration: Math.round(avgDuration._avg.duration || 0),
            statusDistribution: stats.map(s => ({
              status: s.status,
              count: s._count.id
            })),
            languageDistribution: languageStats.map(l => ({
              language: l.language,
              count: l._count.id
            }))
          }
        });

      } catch (error) {
        console.error('Failed to get voice stats:', error);
        reply.status(500).send({
          error: 'Failed to get voice statistics',
          message: error.message
        });
      }
    });
  }
}

module.exports = VoiceRoutes;
