const config = require('../config');
const logger = require('../utils/logger');
const cacheService = require('../cache');
const metrics = require('./metrics');
const patientService = require('./services/patient-service');
const conversationOrchestrator = require('./services/conversation-orchestrator');
const twilioIntegration = require('./integrations/twilio');

function buildWhatsAppWebhookHandler({
  configService = config,
  loggerService = logger,
  cache = cacheService,
  metricsService = metrics,
  patientResolver = patientService,
  orchestrator = conversationOrchestrator,
  twilio = twilioIntegration,
} = {}) {
  const dedupeTtl = Math.max(
    parseInt(configService.patientflow.messaging.dedupeTtlSeconds, 10) || 86400,
    60
  );

  return async function whatsappWebhookHandler(request, reply) {
    const startedAt = Date.now();
    const requestId = request.id || `webhook-${Date.now()}`;
    let organizationId = configService.patientflow.defaultOrganizationId;
    const headers = request.headers || {};
    let dedupeKey;

    try {
      if (!organizationId) {
        throw new Error('PATIENTFLOW_ORGANIZATION_ID is not configured');
      }

      if (!twilio.isConfigured) {
        throw new Error('Twilio WhatsApp credentials are not configured');
      }

      const signature = headers['x-twilio-signature'];
      if (configService.patientflow.twilio.enableSignatureValidation && !signature) {
        reply
          .code(403)
          .header('Content-Type', 'application/xml')
          .send('<Response></Response>');
        return;
      }

      const retryCount = parseInt(headers['x-twilio-retry-count'] || '0', 10);
      const protocol = request.protocol || headers['x-forwarded-proto'] || 'https';
      const hostHeader = headers.host || request.hostname || configService.server?.host || 'localhost';
      const rawUrl = `${protocol}://${hostHeader}${request.raw.url}`;
      const params = request.body || {};

      if (!twilio.validateSignature(signature, rawUrl, params)) {
        loggerService.warn('Invalid Twilio signature on webhook', {
          requestId,
          url: rawUrl,
        });
        reply
          .code(403)
          .header('Content-Type', 'application/xml')
          .send('<Response></Response>');
        return;
      }

      const messageSid = params.MessageSid;
      if (!messageSid) {
        reply
          .code(400)
          .header('Content-Type', 'application/xml')
          .send('<Response></Response>');
        return;
      }

      dedupeKey = `patientflow:whatsapp:message:${messageSid}`;
      const cachedDelivery = await cache.get(dedupeKey);
      if (cachedDelivery && cachedDelivery.status === 'processed') {
        loggerService.info('Ignoring duplicate Twilio webhook delivery', {
          messageSid,
          requestId,
        });
        metricsService.observeWebhookDuration(organizationId, Date.now() - startedAt);
        reply
          .code(200)
          .header('Content-Type', 'application/xml')
          .send('<Response></Response>');
        return;
      }

      await cache.set(dedupeKey, {
        status: 'processing',
        seenAt: new Date().toISOString(),
        retryCount,
      }, dedupeTtl);

      const inboundPayload = {
        sid: messageSid,
        from: params.From,
        to: params.To,
        body: params.Body || '',
        waId: params.WaId,
        profileName: params.ProfileName,
        raw: params,
        retryCount,
        receivedAt: new Date(),
      };

      const patient = await patientResolver.resolveOrCreatePatient({
        organizationId,
        fromNumber: inboundPayload.from,
        waId: inboundPayload.waId,
        profileName: inboundPayload.profileName,
      });

      await orchestrator.handleInboundMessage({
        organizationId,
        patient,
        inboundMessage: inboundPayload,
      });

      await cache.set(dedupeKey, {
        status: 'processed',
        processedAt: new Date().toISOString(),
      }, dedupeTtl);

      metricsService.observeWebhookDuration(organizationId, Date.now() - startedAt);

      reply
        .code(200)
        .header('Content-Type', 'application/xml')
        .send('<Response></Response>');
    } catch (error) {
      metricsService.observeWebhookDuration(organizationId, Date.now() - startedAt);
      loggerService.error('PatientFlow WhatsApp webhook handling error', {
        requestId,
        error: error.message,
      });

      try {
        if (dedupeKey) {
          await cache.del(dedupeKey);
        }
      } catch (cacheError) {
        loggerService.warn('Failed to reset dedupe flag after error', {
          error: cacheError.message,
        });
      }

      reply
        .code(500)
        .header('Content-Type', 'application/xml')
        .send('<Response></Response>');
    }
  };
}

function registerWhatsAppWebhookRoute(app, deps) {
  const handler = buildWhatsAppWebhookHandler(deps);

  app.post('/patientflow/webhooks/whatsapp', {
    config: {
      rateLimit: false,
    },
  }, handler);
}

module.exports = {
  buildWhatsAppWebhookHandler,
  registerWhatsAppWebhookRoute,
};
