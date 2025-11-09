const Razorpay = require('razorpay');
const { PrismaClient } = require('@prisma/client');

class RazorpayService {
  constructor(prisma) {
    this.prisma = prisma;
    this.razorpay = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key_id',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_key_secret'
    });

    this.isInitialized = true;
    console.log('✅ Razorpay service initialized');
  }

  async createOrder(orderData) {
    try {
      const razorpayOrder = await this.razorpay.orders.create({
        amount: Math.round(orderData.amount * 100), // Convert to paise
        currency: orderData.currency || 'INR',
        receipt: orderData.receipt || `order_${Date.now()}`,
        notes: orderData.notes || {}
      });

      // Store in database
      const payment = await this.prisma.payment.create({
        data: {
          razorpayOrderId: razorpayOrder.id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          status: 'PENDING',
          farmerId: orderData.farmerId,
          organizationId: orderData.organizationId,
          metadata: {
            razorpayOrder,
            receipt: orderData.receipt,
            notes: orderData.notes
          }
        }
      });

      console.log(`💳 Payment order created: ${payment.id} (Razorpay: ${razorpayOrder.id})`);
      return {
        payment,
        razorpayOrder
      };
    } catch (error) {
      console.error('Failed to create payment order:', error);
      throw error;
    }
  }

  async verifyPayment(paymentId, razorpayPaymentId, razorpaySignature) {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${paymentId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        throw new Error('Invalid payment signature');
      }

      // Fetch payment details from Razorpay
      const razorpayPayment = await this.razorpay.payments.fetch(razorpayPaymentId);

      // Update payment in database
      const payment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          razorpayPaymentId,
          status: razorpayPayment.status === 'captured' ? 'CAPTURED' : 'FAILED',
          metadata: {
            ...payment.metadata,
            razorpayPayment,
            verifiedAt: new Date().toISOString()
          }
        }
      });

      console.log(`💳 Payment verified: ${payment.id} (Status: ${payment.status})`);
      return payment;
    } catch (error) {
      console.error('Failed to verify payment:', error);
      throw error;
    }
  }

  async processRefund(paymentId, refundData) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'CAPTURED') {
        throw new Error('Payment must be captured to process refund');
      }

      // Create refund in Razorpay
      const razorpayRefund = await this.razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(refundData.amount * 100), // Convert to paise
        notes: refundData.notes || {}
      });

      // Store refund in database
      const refund = await this.prisma.refund.create({
        data: {
          paymentId,
          razorpayRefundId: razorpayRefund.id,
          amount: refundData.amount,
          reason: refundData.reason,
          status: 'PENDING',
          metadata: {
            razorpayRefund
          }
        }
      });

      console.log(`💳 Refund created: ${refund.id} (Razorpay: ${razorpayRefund.id})`);
      return refund;
    } catch (error) {
      console.error('Failed to process refund:', error);
      throw error;
    }
  }

  async getPaymentHistory(farmerId, options = {}) {
    try {
      const where = {
        farmerId,
        ...(options.status && { status: options.status }),
        ...(options.dateFrom && options.dateTo && {
          createdAt: {
            gte: new Date(options.dateFrom),
            lte: new Date(options.dateTo)
          }
        })
      };

      const payments = await this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
        include: {
          refunds: true
        }
      });

      return payments;
    } catch (error) {
      console.error('Failed to get payment history:', error);
      throw error;
    }
  }

  async getPaymentStats(farmerId, options = {}) {
    try {
      const where = {
        farmerId,
        ...(options.dateFrom && options.dateTo && {
          createdAt: {
            gte: new Date(options.dateFrom),
            lte: new Date(options.dateTo)
          }
        })
      };

      const stats = await this.prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true
        },
        _sum: {
          amount: true
        }
      });

      return stats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = {
          count: stat._count.id,
          amount: stat._sum.amount || 0
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('Failed to get payment stats:', error);
      throw error;
    }
  }

  async handleWebhook(webhookData) {
    try {
      const { event, payload } = webhookData;

      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(payload);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload);
          break;
        case 'refund.created':
          await this.handleRefundCreated(payload);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(payload);
          break;
        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      console.log(`🔔 Webhook processed: ${event}`);
    } catch (error) {
      console.error('Failed to handle webhook:', error);
      throw error;
    }
  }

  async handlePaymentCaptured(payload) {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayPaymentId: payload.payment.entity.id }
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CAPTURED',
          metadata: {
            ...payment.metadata,
            webhookData: payload,
            capturedAt: new Date().toISOString()
          }
        }
      });
    }
  }

  async handlePaymentFailed(payload) {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayPaymentId: payload.payment.entity.id }
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...payment.metadata,
            webhookData: payload,
            failedAt: new Date().toISOString()
          }
        }
      });
    }
  }

  async handleRefundCreated(payload) {
    const refund = await this.prisma.refund.findFirst({
      where: { razorpayRefundId: payload.refund.entity.id }
    });

    if (refund) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'PROCESSED',
          metadata: {
            ...refund.metadata,
            webhookData: payload,
            processedAt: new Date().toISOString()
          }
        }
      });
    }
  }

  async handleRefundProcessed(payload) {
    const refund = await this.prisma.refund.findFirst({
      where: { razorpayRefundId: payload.refund.entity.id }
    });

    if (refund) {
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'PROCESSED',
          metadata: {
            ...refund.metadata,
            webhookData: payload,
            processedAt: new Date().toISOString()
          }
        }
      });
    }
  }
}

module.exports = RazorpayService;