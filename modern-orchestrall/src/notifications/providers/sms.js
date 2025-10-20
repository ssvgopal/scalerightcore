// src/notifications/providers/sms.js - SMS provider using Twilio
let twilioClient = null;

class SMSProvider {
  constructor(config = {}) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || config.accountSid;
    const authToken = process.env.TWILIO_AUTH_TOKEN || config.authToken;
    this.from = process.env.TWILIO_FROM || config.from;
    if (accountSid && authToken) {
      // Lazy import to avoid dependency if not configured
      // eslint-disable-next-line global-require
      const twilio = require('twilio');
      twilioClient = twilio(accountSid, authToken);
    }
  }

  async send({ to, body }) {
    if (!to) throw new Error('SMSProvider: "to" is required');
    if (!twilioClient) throw new Error('SMSProvider: Twilio not configured');
    const msg = await twilioClient.messages.create({
      from: this.from,
      to,
      body: body || 'You have a new notification from Orchestrall.'
    });
    return { id: msg.sid, status: msg.status };
  }
}

module.exports = SMSProvider;


