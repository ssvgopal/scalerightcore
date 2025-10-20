const crypto = require('crypto');
const axios = require('axios');

class RazorpayService {
  constructor() {
    this.apiKey = process.env.RAZORPAY_API_KEY;
    this.apiSecret = process.env.RAZORPAY_API_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    this.baseUrl = 'https://api.razorpay.com/v1';
  }

  verifyWebhookSignature(body, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  async createPaymentIntent(amount, currency = 'INR', metadata = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/orders`,
        {
          amount: amount * 100, // Convert to paise
          currency,
          receipt: `receipt_${Date.now()}`,
          notes: metadata
        },
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        orderId: response.data.id,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
        receipt: response.data.receipt
      };
    } catch (error) {
      console.error('Payment intent creation failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.description || error.message
      };
    }
  }

  async capturePayment(paymentId, amount) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/payments/${paymentId}/capture`,
        {
          amount: amount * 100 // Convert to paise
        },
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentId: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        captured: response.data.captured
      };
    } catch (error) {
      console.error('Payment capture failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.description || error.message
      };
    }
  }

  async createRefund(paymentId, amount, reason = 'requested_by_customer') {
    try {
      const refundData = {
        amount: amount * 100, // Convert to paise
        notes: {
          reason,
          timestamp: new Date().toISOString()
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/payments/${paymentId}/refund`,
        refundData,
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        refundId: response.data.id,
        paymentId: response.data.payment_id,
        amount: response.data.amount,
        status: response.data.status,
        notes: response.data.notes
      };
    } catch (error) {
      console.error('Refund creation failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.description || error.message
      };
    }
  }

  async getPaymentDetails(paymentId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${paymentId}`,
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret
          }
        }
      );

      return {
        success: true,
        payment: {
          id: response.data.id,
          amount: response.data.amount,
          currency: response.data.currency,
          status: response.data.status,
          method: response.data.method,
          description: response.data.description,
          email: response.data.email,
          contact: response.data.contact,
          notes: response.data.notes,
          created_at: response.data.created_at
        }
      };
    } catch (error) {
      console.error('Payment details fetch failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.description || error.message
      };
    }
  }

  async getRefunds(paymentId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${paymentId}/refunds`,
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret
          }
        }
      );

      return {
        success: true,
        refunds: response.data.items.map(refund => ({
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          notes: refund.notes,
          created_at: refund.created_at
        }))
      };
    } catch (error) {
      console.error('Refunds fetch failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.description || error.message
      };
    }
  }

  async getReconciliationData(startDate, endDate) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments`,
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret
          },
          params: {
            'from': Math.floor(new Date(startDate).getTime() / 1000),
            'to': Math.floor(new Date(endDate).getTime() / 1000),
            'count': 100
          }
        }
      );

      const payments = response.data.items;
      const reconciliation = {
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
        successfulPayments: payments.filter(p => p.status === 'captured').length,
        failedPayments: payments.filter(p => p.status === 'failed').length,
        pendingPayments: payments.filter(p => p.status === 'authorized').length,
        payments: payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          created_at: payment.created_at,
          email: payment.email,
          contact: payment.contact
        }))
      };

      return {
        success: true,
        reconciliation
      };
    } catch (error) {
      console.error('Reconciliation data fetch failed:', error);
      return {
        success: false,
        error: error.response?.data?.error?.description || error.message
      };
    }
  }

  async processWebhookEvent(eventType, eventData) {
    console.log(`Processing Razorpay webhook: ${eventType}`, eventData);

    switch (eventType) {
      case 'payment.captured':
        return await this.handlePaymentCaptured(eventData);
      
      case 'payment.failed':
        return await this.handlePaymentFailed(eventData);
      
      case 'refund.created':
        return await this.handleRefundCreated(eventData);
      
      case 'refund.processed':
        return await this.handleRefundProcessed(eventData);
      
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
        return { success: true, message: 'Event logged' };
    }
  }

  async handlePaymentCaptured(eventData) {
    // Update order status, send confirmation emails, etc.
    console.log('Payment captured:', eventData.payment.entity.id);
    return { success: true, message: 'Payment captured processed' };
  }

  async handlePaymentFailed(eventData) {
    // Update order status, send failure notifications, etc.
    console.log('Payment failed:', eventData.payment.entity.id);
    return { success: true, message: 'Payment failure processed' };
  }

  async handleRefundCreated(eventData) {
    // Update refund status, send notifications, etc.
    console.log('Refund created:', eventData.refund.entity.id);
    return { success: true, message: 'Refund creation processed' };
  }

  async handleRefundProcessed(eventData) {
    // Update refund status, send completion notifications, etc.
    console.log('Refund processed:', eventData.refund.entity.id);
    return { success: true, message: 'Refund processing completed' };
  }
}

module.exports = RazorpayService;
