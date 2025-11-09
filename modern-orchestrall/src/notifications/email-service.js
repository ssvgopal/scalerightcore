const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

class EmailService {
  constructor(prisma) {
    this.prisma = prisma;
    this.transporter = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'test@example.com',
        pass: process.env.SMTP_PASS || 'test_password'
      }
    });

    // Verify connection
    try {
      await this.transporter.verify();
      this.isInitialized = true;
      console.log('✅ Email service initialized');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  async sendEmail(to, subject, html, options = {}) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'Kisaansay <noreply@kisaansay.com>',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        ...options
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Log email in database
      await this.prisma.notificationHistory.create({
        data: {
          userId: options.userId,
          channel: 'EMAIL',
          type: options.type || 'general',
          subject,
          body: html,
          status: 'SENT',
          metadata: {
            messageId: result.messageId,
            to: Array.isArray(to) ? to : [to],
            from: result.from,
            response: result.response
          }
        }
      });

      console.log(`📧 Email sent to ${to}: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error('Failed to send email:', error);
      
      // Log failed email
      await this.prisma.notificationHistory.create({
        data: {
          userId: options.userId,
          channel: 'EMAIL',
          type: options.type || 'general',
          subject,
          body: html,
          status: 'FAILED',
          errorMessage: error.message,
          metadata: {
            to: Array.isArray(to) ? to : [to],
            error: error.message
          }
        }
      });

      throw error;
    }
  }

  async sendBulkEmail(recipients, subject, html, options = {}) {
    const results = [];
    let successCount = 0;

    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail(recipient.email, subject, html, {
          ...options,
          userId: recipient.userId
        });
        results.push({ success: true, recipient, result });
        successCount++;
      } catch (error) {
        results.push({ success: false, recipient, error: error.message });
      }
    }

    console.log(`📧 Bulk email sent: ${successCount}/${recipients.length} successful`);
    return { successCount, totalCount: recipients.length, results };
  }

  async sendToFarmers(farmerIds, subject, html, options = {}) {
    try {
      const farmers = await this.prisma.farmerProfile.findMany({
        where: {
          id: { in: farmerIds },
          email: { not: null }
        },
        select: {
          id: true,
          email: true,
          name: true
        }
      });

      const recipients = farmers.map(farmer => ({
        userId: farmer.id,
        email: farmer.email,
        name: farmer.name
      }));

      return await this.sendBulkEmail(recipients, subject, html, options);
    } catch (error) {
      console.error('Failed to send email to farmers:', error);
      throw error;
    }
  }

  async sendToOrganization(organizationId, subject, html, options = {}) {
    try {
      const farmers = await this.prisma.farmerProfile.findMany({
        where: {
          organizationId,
          email: { not: null }
        },
        select: {
          id: true,
          email: true,
          name: true
        }
      });

      const recipients = farmers.map(farmer => ({
        userId: farmer.id,
        email: farmer.email,
        name: farmer.name
      }));

      return await this.sendBulkEmail(recipients, subject, html, options);
    } catch (error) {
      console.error('Failed to send email to organization:', error);
      throw error;
    }
  }

  async getEmailHistory(userId, options = {}) {
    try {
      const where = {
        userId,
        channel: 'EMAIL',
        ...(options.type && { type: options.type }),
        ...(options.status && { status: options.status }),
        ...(options.dateFrom && options.dateTo && {
          createdAt: {
            gte: new Date(options.dateFrom),
            lte: new Date(options.dateTo)
          }
        })
      };

      const history = await this.prisma.notificationHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0
      });

      return history;
    } catch (error) {
      console.error('Failed to get email history:', error);
      throw error;
    }
  }

  async getEmailStats(userId, options = {}) {
    try {
      const where = {
        userId,
        channel: 'EMAIL',
        ...(options.dateFrom && options.dateTo && {
          createdAt: {
            gte: new Date(options.dateFrom),
            lte: new Date(options.dateTo)
          }
        })
      };

      const stats = await this.prisma.notificationHistory.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true
        }
      });

      return stats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count.id;
        return acc;
      }, {});
    } catch (error) {
      console.error('Failed to get email stats:', error);
      throw error;
    }
  }

  async createTemplate(name, subject, html, variables = []) {
    try {
      const template = await this.prisma.notificationTemplate.create({
        data: {
          name,
          channel: 'EMAIL',
          subject,
          body: html,
          variables: { variables },
          isActive: true
        }
      });

      console.log(`📧 Email template created: ${template.id}`);
      return template;
    } catch (error) {
      console.error('Failed to create email template:', error);
      throw error;
    }
  }

  async sendTemplateEmail(to, templateName, variables = {}, options = {}) {
    try {
      const template = await this.prisma.notificationTemplate.findFirst({
        where: {
          name: templateName,
          channel: 'EMAIL',
          isActive: true
        }
      });

      if (!template) {
        throw new Error(`Email template '${templateName}' not found`);
      }

      // Replace variables in subject and body
      let subject = template.subject || '';
      let html = template.body;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
        html = html.replace(new RegExp(placeholder, 'g'), value);
      }

      return await this.sendEmail(to, subject, html, {
        ...options,
        type: templateName
      });
    } catch (error) {
      console.error('Failed to send template email:', error);
      throw error;
    }
  }
}

module.exports = EmailService;
