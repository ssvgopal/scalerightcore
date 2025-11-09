// plugins/payments/razorpay/index.js - Razorpay Payment Gateway Plugin
const axios = require('axios');
const crypto = require('crypto');

class RazorpayPaymentGateway {
  constructor({ prisma, config, clientId, logger }) {
    this.prisma = prisma;
    this.config = config;
    this.clientId = clientId;
    this.logger = logger;
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
    this.environment = config.environment || 'sandbox';
    this.currency = config.currency || 'INR';
    this.timeout = config.timeout || 30000;
    
    // Set base URL based on environment
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.razorpay.com/v1'
      : 'https://api.razorpay.com/v1';
    
    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info(`Initializing Razorpay payment gateway for client: ${this.clientId}`);
      
      // Validate configuration
      if (!this.keyId || !this.keySecret) {
        throw new Error('Missing required Razorpay configuration (keyId, keySecret)');
      }

      // Test API connection
      await this.testConnection();
      
      this.initialized = true;
      this.logger.info('Razorpay payment gateway initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Razorpay payment gateway', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.makeRequest('GET', '/payments?count=1');
      this.logger.info('Razorpay API connection test successful');
      return response.data;
    } catch (error) {
      this.logger.error('Razorpay connection test failed', error);
      throw error;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: this.timeout
      });

      return response;
    } catch (error) {
      this.logger.error(`Razorpay API request failed: ${method} ${endpoint}`, {
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  // Payment processing methods
  async createPaymentIntent(orderData) {
    try {
      this.logger.info(`Creating payment intent for order: ${orderData.orderNumber}`);
      
      const paymentData = {
        amount: Math.round(orderData.total * 100), // Convert to paise
        currency: this.currency,
        receipt: orderData.orderNumber,
        notes: {
          orderId: orderData.id,
          customerId: orderData.customerId,
          organizationId: this.clientId
        }
      };

      const response = await this.makeRequest('POST', '/orders', paymentData);
      const order = response.data;

      // Store payment intent in database
      await this.prisma.paymentIntent.create({
        data: {
          razorpayOrderId: order.id,
          orderId: orderData.id,
          amount: orderData.total,
          currency: this.currency,
          status: 'created',
          organizationId: this.clientId,
          metadata: {
            razorpayData: order,
            clientId: this.clientId
          }
        }
      });

      this.logger.info(`Payment intent created: ${order.id}`);
      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: this.keyId
      };

    } catch (error) {
      this.logger.error('Failed to create payment intent', error);
      throw error;
    }
  }

  async capturePayment(paymentId, amount) {
    try {
      this.logger.info(`Capturing payment: ${paymentId}`);
      
      const captureData = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: this.currency
      };

      const response = await this.makeRequest('POST', `/payments/${paymentId}/capture`, captureData);
      const payment = response.data;

      // Update payment intent status
      await this.prisma.paymentIntent.updateMany({
        where: {
          razorpayPaymentId: paymentId,
          organizationId: this.clientId
        },
        data: {
          status: 'captured',
          capturedAt: new Date(),
          metadata: {
            ...this.prisma.paymentIntent.findFirst({
              where: { razorpayPaymentId: paymentId }
            }).metadata,
            capturedData: payment
          }
        }
      });

      this.logger.info(`Payment captured successfully: ${paymentId}`);
      return payment;

    } catch (error) {
      this.logger.error(`Failed to capture payment ${paymentId}`, error);
      throw error;
    }
  }

  async refundPayment(paymentId, amount, reason = 'Refund requested') {
    try {
      this.logger.info(`Processing refund for payment: ${paymentId}`);
      
      const refundData = {
        amount: Math.round(amount * 100), // Convert to paise
        notes: {
          reason: reason,
          organizationId: this.clientId
        }
      };

      const response = await this.makeRequest('POST', `/payments/${paymentId}/refund`, refundData);
      const refund = response.data;

      // Store refund record
      await this.prisma.refund.create({
        data: {
          razorpayRefundId: refund.id,
          paymentId: paymentId,
          amount: amount,
          currency: this.currency,
          status: refund.status,
          reason: reason,
          organizationId: this.clientId,
          metadata: {
            razorpayData: refund,
            clientId: this.clientId
          }
        }
      });

      this.logger.info(`Refund processed successfully: ${refund.id}`);
      return refund;

    } catch (error) {
      this.logger.error(`Failed to process refund for payment ${paymentId}`, error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      const response = await this.makeRequest('GET', `/payments/${paymentId}`);
      const payment = response.data;

      // Update local payment intent status
      await this.prisma.paymentIntent.updateMany({
        where: {
          razorpayPaymentId: paymentId,
          organizationId: this.clientId
        },
        data: {
          status: payment.status,
          metadata: {
            ...this.prisma.paymentIntent.findFirst({
              where: { razorpayPaymentId: paymentId }
            }).metadata,
            razorpayData: payment
          }
        }
      });

      return {
        id: payment.id,
        status: payment.status,
        amount: payment.amount / 100, // Convert from paise
        currency: payment.currency,
        method: payment.method,
        captured: payment.captured,
        createdAt: payment.created_at
      };

    } catch (error) {
      this.logger.error(`Failed to get payment status for ${paymentId}`, error);
      throw error;
    }
  }

  // Webhook handling
  async handleWebhook(payload, signature) {
    try {
      // Verify webhook signature
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(payload, 'utf8');
      const calculatedSignature = hmac.digest('hex');

      if (signature !== calculatedSignature) {
        throw new Error('Invalid webhook signature');
      }

      const data = JSON.parse(payload);
      
      // Handle different webhook events
      switch (data.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(data.payload.payment.entity);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(data.payload.payment.entity);
          break;
        case 'refund.created':
          await this.handleRefundCreated(data.payload.refund.entity);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(data.payload.refund.entity);
          break;
        default:
          this.logger.info(`Unhandled webhook event: ${data.event}`);
      }

      return { success: true, event: data.event };

    } catch (error) {
      this.logger.error('Webhook handling failed', error);
      throw error;
    }
  }

  async handlePaymentCaptured(payment) {
    try {
      // Update order status
      const paymentIntent = await this.prisma.paymentIntent.findFirst({
        where: {
          razorpayPaymentId: payment.id,
          organizationId: this.clientId
        }
      });

      if (paymentIntent) {
        await this.prisma.order.update({
          where: { id: paymentIntent.orderId },
          data: { status: 'confirmed' }
        });

        await this.prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: 'captured',
            capturedAt: new Date()
          }
        });
      }

      this.logger.info(`Payment captured webhook processed: ${payment.id}`);

    } catch (error) {
      this.logger.error('Failed to handle payment captured webhook', error);
    }
  }

  async handlePaymentFailed(payment) {
    try {
      const paymentIntent = await this.prisma.paymentIntent.findFirst({
        where: {
          razorpayPaymentId: payment.id,
          organizationId: this.clientId
        }
      });

      if (paymentIntent) {
        await this.prisma.order.update({
          where: { id: paymentIntent.orderId },
          data: { status: 'cancelled' }
        });

        await this.prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: { status: 'failed' }
        });
      }

      this.logger.info(`Payment failed webhook processed: ${payment.id}`);

    } catch (error) {
      this.logger.error('Failed to handle payment failed webhook', error);
    }
  }

  async handleRefundCreated(refund) {
    try {
      await this.prisma.refund.updateMany({
        where: {
          razorpayRefundId: refund.id,
          organizationId: this.clientId
        },
        data: {
          status: refund.status,
          metadata: {
            ...this.prisma.refund.findFirst({
              where: { razorpayRefundId: refund.id }
            }).metadata,
            razorpayData: refund
          }
        }
      });

      this.logger.info(`Refund created webhook processed: ${refund.id}`);

    } catch (error) {
      this.logger.error('Failed to handle refund created webhook', error);
    }
  }

  async handleRefundProcessed(refund) {
    try {
      await this.prisma.refund.updateMany({
        where: {
          razorpayRefundId: refund.id,
          organizationId: this.clientId
        },
        data: {
          status: refund.status,
          processedAt: new Date(),
          metadata: {
            ...this.prisma.refund.findFirst({
              where: { razorpayRefundId: refund.id }
            }).metadata,
            razorpayData: refund
          }
        }
      });

      this.logger.info(`Refund processed webhook processed: ${refund.id}`);

    } catch (error) {
      this.logger.error('Failed to handle refund processed webhook', error);
    }
  }

  // Reporting and analytics
  async getPaymentAnalytics(startDate, endDate) {
    try {
      const params = new URLSearchParams({
        from: Math.floor(new Date(startDate).getTime() / 1000),
        to: Math.floor(new Date(endDate).getTime() / 1000),
        count: 100
      });

      const response = await this.makeRequest('GET', `/payments?${params}`);
      const payments = response.data.items;

      const analytics = {
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, payment) => sum + (payment.amount / 100), 0),
        successfulPayments: payments.filter(p => p.status === 'captured').length,
        failedPayments: payments.filter(p => p.status === 'failed').length,
        averageAmount: 0,
        paymentMethods: {}
      };

      analytics.averageAmount = analytics.totalAmount / analytics.totalPayments;

      // Count payment methods
      payments.forEach(payment => {
        const method = payment.method || 'unknown';
        analytics.paymentMethods[method] = (analytics.paymentMethods[method] || 0) + 1;
      });

      return analytics;

    } catch (error) {
      this.logger.error('Failed to get payment analytics', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.testConnection();
      return { 
        status: 'healthy', 
        environment: this.environment,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  async cleanup() {
    this.logger.info('Cleaning up Razorpay payment gateway');
    this.initialized = false;
  }
}

module.exports = RazorpayPaymentGateway;
