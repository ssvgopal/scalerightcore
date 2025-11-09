// src/notifications/providers/email.js - Email provider using Nodemailer
const nodemailer = require('nodemailer');

class EmailProvider {
  constructor(config = {}) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || config.host || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || config.port || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || config.user,
        pass: process.env.SMTP_PASS || config.pass,
      },
    });
    this.from = process.env.SMTP_FROM || config.from || (process.env.SMTP_USER || 'no-reply@orchestrall.ai');
  }

  async send({ to, subject, text, html }) {
    if (!to) throw new Error('EmailProvider: "to" is required');
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject: subject || 'Notification from Orchestrall',
      text: text || (html ? undefined : 'You have a new notification.'),
      html,
    });
    return { id: info.messageId, accepted: info.accepted, rejected: info.rejected };
  }
}

module.exports = EmailProvider;


