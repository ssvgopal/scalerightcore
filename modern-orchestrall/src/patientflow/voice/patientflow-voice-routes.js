const fs = require('fs');
const twilio = require('twilio');
const PatientflowVoiceService = require('./patientflow-voice-service');
const config = require('../../config');
const logger = require('../../utils/logger');

function buildBaseUrl(request) {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const protocol = forwardedProto || request.protocol || 'https';
  const host = forwardedHost || request.headers.host;
  return `${protocol}://${host}`;
}

async function resolveOrganizationId(prisma, request, payload = {}) {
  const query = request.query || {};
  if (query.orgId) return query.orgId;
  if (query.organizationId) return query.organizationId;
  if (payload.OrganizationId) return payload.OrganizationId;

  const toNumber = payload.To || payload.called;
  if (!toNumber) {
    return config.voice.defaultOrganizationId || null;
  }

  try {
    const notificationConfig = await prisma.notificationConfig.findFirst({
      where: {
        enabled: true,
        config: {
          path: ['phoneNumber'],
          equals: toNumber,
        },
      },
      select: {
        organizationId: true,
      },
    });

    if (notificationConfig) {
      return notificationConfig.organizationId;
    }
  } catch (error) {
    logger.error('Failed to resolve organization from phone number', { error: error.message });
  }

  return config.voice.defaultOrganizationId || null;
}

async function patientflowVoiceRoutes(fastify, options) {
  const prisma = options.prisma;
  if (!prisma) {
    throw new Error('Prisma client is required for patientflow voice routes');
  }

  const voiceService = new PatientflowVoiceService(prisma);
  await voiceService.initialize();

  const VoiceResponse = twilio.twiml.VoiceResponse;

  fastify.post('/patientflow/webhooks/voice', async (request, reply) => {
    try {
      const payload = request.body || {};
      const organizationId = await resolveOrganizationId(prisma, request, payload);
      const baseUrl = buildBaseUrl(request);

      const twiml = await voiceService.handleIncomingCall(payload, organizationId, baseUrl);
      reply.header('Content-Type', 'text/xml').send(twiml);
    } catch (error) {
      logger.error('Voice webhook error', { error: error.message });
      const response = new VoiceResponse();
      response.say('We are experiencing technical difficulties. Please try again later.');
      response.hangup();
      reply.header('Content-Type', 'text/xml').send(response.toString());
    }
  });

  fastify.post('/patientflow/webhooks/voice/gather', async (request, reply) => {
    try {
      const payload = request.body || {};
      const query = request.query || {};
      const organizationId = query.orgId || query.organizationId || (await resolveOrganizationId(prisma, request, payload));
      const baseUrl = buildBaseUrl(request);

      const twiml = await voiceService.handleGather(payload, organizationId, baseUrl);
      reply.header('Content-Type', 'text/xml').send(twiml);
    } catch (error) {
      logger.error('Voice gather webhook error', { error: error.message });
      const response = new VoiceResponse();
      response.say('I am having trouble understanding. Goodbye.');
      response.hangup();
      reply.header('Content-Type', 'text/xml').send(response.toString());
    }
  });

  fastify.post('/patientflow/webhooks/voice/recording', async (request, reply) => {
    try {
      const payload = request.body || {};
      const organizationId = await resolveOrganizationId(prisma, request, payload);

      await voiceService.handleRecording(payload, organizationId);
      reply.header('Content-Type', 'text/xml').send(new VoiceResponse().toString());
    } catch (error) {
      logger.error('Voice recording webhook error', { error: error.message });
      reply.header('Content-Type', 'text/xml').send(new VoiceResponse().toString());
    }
  });

  fastify.get('/patientflow/voice/audio/:id', async (request, reply) => {
    const { id } = request.params;
    const resource = voiceService.getAudioResource(id);

    if (!resource) {
      return reply.code(404).send({ error: 'Audio not found or expired' });
    }

    try {
      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Cache-Control', 'no-store, max-age=0');
      reply.header('Content-Disposition', 'inline; filename="voice-response.mp3"');
      return reply.send(fs.createReadStream(resource.filePath));
    } catch (error) {
      logger.error('Failed to stream audio response', { error: error.message });
      return reply.code(500).send({ error: 'Failed to stream audio' });
    }
  });
}

module.exports = patientflowVoiceRoutes;
