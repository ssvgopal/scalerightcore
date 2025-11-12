const twilio = require('twilio');
const config = require('../../config');
const logger = require('../../utils/logger');

class TwilioIntegration {
  constructor() {
    this.client = null;
  }

  get isConfigured() {
    const { accountSid, authToken, whatsappFromNumber } = config.patientflow.twilio;
    return Boolean(accountSid && authToken && whatsappFromNumber);
  }

  getClient() {
    if (!this.isConfigured) {
      throw new Error('Twilio WhatsApp configuration is incomplete');
    }

    if (!this.client) {
      const { accountSid, authToken } = config.patientflow.twilio;
      this.client = twilio(accountSid, authToken, {
        lazyLoading: true,
      });
    }

    return this.client;
  }

  getFromNumber() {
    const from = config.patientflow.twilio.whatsappFromNumber;

    if (!from) {
      throw new Error('Twilio WhatsApp sender number is not configured');
    }

    return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  }

  validateSignature(signature, url, params) {
    if (!config.patientflow.twilio.enableSignatureValidation) {
      return true;
    }

    if (!config.patientflow.twilio.authToken) {
      logger.error('Cannot validate Twilio signature without auth token');
      return false;
    }

    return twilio.validateRequest(
      config.patientflow.twilio.authToken,
      signature,
      url,
      params
    );
  }

  async sendWhatsAppMessage({ to, body, mediaUrls = [], persistentAction }) {
    if (!body) {
      throw new Error('Missing message body for WhatsApp send');
    }

    if (!to) {
      throw new Error('Missing WhatsApp recipient number');
    }

    const client = this.getClient();
    const from = this.getFromNumber();
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const payload = {
      from,
      to: toNumber,
      body,
    };

    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      payload.mediaUrl = mediaUrls;
    }

    if (persistentAction) {
      payload.persistentAction = persistentAction;
    }

    if (config.patientflow.twilio.statusCallbackUrl) {
      payload.statusCallback = config.patientflow.twilio.statusCallbackUrl;
    }

    const startedAt = Date.now();
    const response = await client.messages.create(payload);
    const latencyMs = Date.now() - startedAt;

    logger.info('Twilio WhatsApp message sent', {
      sid: response.sid,
      to: response.to,
      latencyMs,
    });

    return { response, latencyMs };
  }
}

module.exports = new TwilioIntegration();
