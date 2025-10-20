const twilio = require('twilio');
const { PrismaClient } = require('@prisma/client');

class SMSService {
  constructor(prisma) {
    this.prisma = prisma;
    this.client = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'AC_test_sid',
      process.env.TWILIO_AUTH_TOKEN || 'test_auth_token'
    );

    this.isInitialized = true;
    console.log('✅ SMS service initialized');
  }

  async sendSMS(to, message, options = {}) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        to: to,
        ...options
      });

      // Log SMS in database
      await this.prisma.notificationHistory.create({
        data: {
          userId: options.userId,
          channel: 'SMS',
          type: options.type || 'general',
          subject: options.subject,
          body: message,
          status: 'SENT',
          metadata: {
            twilioSid: result.sid,
            to,
            from: result.from,
            status: result.status
          }
        }
      });

      console.log(`📱 SMS sent to ${to}: ${result.sid}`);
      return result;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      
      // Log failed SMS
      await this.prisma.notificationHistory.create({
        data: {
          userId: options.userId,
          channel: 'SMS',
          type: options.type || 'general',
          subject: options.subject,
          body: message,
          status: 'FAILED',
          errorMessage: error.message,
          metadata: {
            to,
            error: error.message
          }
        }
      });

      throw error;
    }
  }

  async sendBulkSMS(recipients, message, options = {}) {
    const results = [];
    let successCount = 0;

    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS(recipient.phone, message, {
          ...options,
          userId: recipient.userId
        });
        results.push({ success: true, recipient, result });
        successCount++;
      } catch (error) {
        results.push({ success: false, recipient, error: error.message });
      }
    }

    console.log(`📱 Bulk SMS sent: ${successCount}/${recipients.length} successful`);
    return { successCount, totalCount: recipients.length, results };
  }

  async sendToFarmers(farmerIds, message, options = {}) {
    try {
      const farmers = await this.prisma.farmerProfile.findMany({
        where: {
          id: { in: farmerIds },
          phone: { not: null }
        },
        select: {
          id: true,
          phone: true,
          name: true
        }
      });

      const recipients = farmers.map(farmer => ({
        userId: farmer.id,
        phone: farmer.phone,
        name: farmer.name
      }));

      return await this.sendBulkSMS(recipients, message, options);
    } catch (error) {
      console.error('Failed to send SMS to farmers:', error);
      throw error;
    }
  }

  async sendToOrganization(organizationId, message, options = {}) {
    try {
      const farmers = await this.prisma.farmerProfile.findMany({
        where: {
          organizationId,
          phone: { not: null }
        },
        select: {
          id: true,
          phone: true,
          name: true
        }
      });

      const recipients = farmers.map(farmer => ({
        userId: farmer.id,
        phone: farmer.phone,
        name: farmer.name
      }));

      return await this.sendBulkSMS(recipients, message, options);
    } catch (error) {
      console.error('Failed to send SMS to organization:', error);
      throw error;
    }
  }

  async getSMSHistory(userId, options = {}) {
    try {
      const where = {
        userId,
        channel: 'SMS',
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
      console.error('Failed to get SMS history:', error);
      throw error;
    }
  }

  async getSMSStats(userId, options = {}) {
    try {
      const where = {
        userId,
        channel: 'SMS',
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
      console.error('Failed to get SMS stats:', error);
      throw error;
    }
  }

  async validatePhoneNumber(phoneNumber) {
    try {
      const result = await this.client.lookups.v1.phoneNumbers(phoneNumber).fetch();
      return {
        valid: true,
        formatted: result.phoneNumber,
        countryCode: result.countryCode,
        nationalFormat: result.nationalFormat
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async getAccountBalance() {
    try {
      const balance = await this.client.balance.fetch();
      return {
        currency: balance.currency,
        balance: balance.balance
      };
    } catch (error) {
      console.error('Failed to get account balance:', error);
      throw error;
    }
  }
}

module.exports = SMSService;
