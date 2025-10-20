// src/notifications/service.js - Notification Service with simple rules
const EmailProvider = require('./providers/email');
const SMSProvider = require('./providers/sms');

class NotificationService {
  constructor(options = {}) {
    this.email = new EmailProvider(options.email || {});
    this.sms = new SMSProvider(options.sms || {});
    this.rules = options.rules || [];
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  async notify({ type, to, subject, message, html, meta = {} }) {
    switch (type) {
      case 'email':
        return this.email.send({ to, subject, text: message, html });
      case 'sms':
        return this.sms.send({ to, body: message });
      default:
        throw new Error(`Unsupported notification type: ${type}`);
    }
  }

  async processEvent(event) {
    // event: { name, payload }
    const matches = this.rules.filter(r => r.event === event.name);
    const results = [];
    for (const rule of matches) {
      try {
        const renderedMessage = this.renderTemplate(rule.template || '{{message}}', {
          ...event.payload
        });
        const res = await this.notify({
          type: rule.type,
          to: typeof rule.to === 'function' ? rule.to(event.payload) : rule.to,
          subject: rule.subject || 'Orchestrall Notification',
          message: renderedMessage,
          html: rule.html ? renderedMessage : undefined,
          meta: { ruleId: rule.id }
        });
        results.push({ ruleId: rule.id, ok: true, res });
      } catch (err) {
        results.push({ ruleId: rule.id, ok: false, error: err.message });
      }
    }
    return results;
  }

  renderTemplate(tpl, data) {
    return tpl.replace(/{{\s*(\w+)\s*}}/g, (_, key) => (data[key] != null ? String(data[key]) : ''));
  }
}

module.exports = NotificationService;


