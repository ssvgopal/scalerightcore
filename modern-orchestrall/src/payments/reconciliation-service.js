const RazorpayService = require('./razorpay-service');

class PaymentReconciliationService {
  constructor(prisma) {
    this.prisma = prisma;
    this.razorpay = new RazorpayService();
  }

  async generateReconciliationReport(organizationId, startDate, endDate) {
    try {
      // Get Razorpay data
      const razorpayData = await this.razorpay.getReconciliationData(startDate, endDate);
      
      if (!razorpayData.success) {
        throw new Error(razorpayData.error);
      }

      // Get local payment records
      const localPayments = await this.prisma.payment.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        include: {
          order: true,
          refunds: true
        }
      });

      // Generate reconciliation report
      const report = {
        period: { startDate, endDate },
        organizationId,
        generatedAt: new Date().toISOString(),
        summary: {
          razorpay: {
            totalPayments: razorpayData.reconciliation.totalPayments,
            totalAmount: razorpayData.reconciliation.totalAmount,
            successfulPayments: razorpayData.reconciliation.successfulPayments,
            failedPayments: razorpayData.reconciliation.failedPayments,
            pendingPayments: razorpayData.reconciliation.pendingPayments
          },
          local: {
            totalPayments: localPayments.length,
            totalAmount: localPayments.reduce((sum, p) => sum + p.amount, 0),
            successfulPayments: localPayments.filter(p => p.status === 'captured').length,
            failedPayments: localPayments.filter(p => p.status === 'failed').length,
            pendingPayments: localPayments.filter(p => p.status === 'authorized').length
          }
        },
        discrepancies: [],
        matchedPayments: [],
        unmatchedPayments: {
          razorpay: [],
          local: []
        }
      };

      // Find discrepancies and matches
      const razorpayPayments = razorpayData.reconciliation.payments;
      
      for (const razorpayPayment of razorpayPayments) {
        const localPayment = localPayments.find(
          lp => lp.razorpayPaymentId === razorpayPayment.id
        );

        if (localPayment) {
          // Check for discrepancies
          const discrepancies = [];
          
          if (localPayment.amount !== razorpayPayment.amount) {
            discrepancies.push({
              type: 'amount_mismatch',
              razorpay: razorpayPayment.amount,
              local: localPayment.amount
            });
          }
          
          if (localPayment.status !== razorpayPayment.status) {
            discrepancies.push({
              type: 'status_mismatch',
              razorpay: razorpayPayment.status,
              local: localPayment.status
            });
          }

          if (discrepancies.length > 0) {
            report.discrepancies.push({
              paymentId: razorpayPayment.id,
              discrepancies
            });
          } else {
            report.matchedPayments.push({
              paymentId: razorpayPayment.id,
              amount: razorpayPayment.amount,
              status: razorpayPayment.status,
              createdAt: razorpayPayment.created_at
            });
          }
        } else {
          report.unmatchedPayments.razorpay.push(razorpayPayment);
        }
      }

      // Find local payments not in Razorpay
      for (const localPayment of localPayments) {
        const razorpayPayment = razorpayPayments.find(
          rp => rp.id === localPayment.razorpayPaymentId
        );

        if (!razorpayPayment) {
          report.unmatchedPayments.local.push({
            id: localPayment.id,
            razorpayPaymentId: localPayment.razorpayPaymentId,
            amount: localPayment.amount,
            status: localPayment.status,
            createdAt: localPayment.createdAt
          });
        }
      }

      return {
        success: true,
        report
      };
    } catch (error) {
      console.error('Reconciliation report generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async syncPaymentStatus(paymentId) {
    try {
      const localPayment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: true }
      });

      if (!localPayment) {
        throw new Error('Payment not found');
      }

      const razorpayData = await this.razorpay.getPaymentDetails(
        localPayment.razorpayPaymentId
      );

      if (!razorpayData.success) {
        throw new Error(razorpayData.error);
      }

      const razorpayPayment = razorpayData.payment;

      // Update local payment if status changed
      if (localPayment.status !== razorpayPayment.status) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: razorpayPayment.status,
            updatedAt: new Date()
          }
        });

        // Update order status if needed
        if (razorpayPayment.status === 'captured' && localPayment.order) {
          await this.prisma.order.update({
            where: { id: localPayment.order.id },
            data: {
              status: 'paid',
              paidAt: new Date()
            }
          });
        }

        return {
          success: true,
          message: 'Payment status synchronized',
          oldStatus: localPayment.status,
          newStatus: razorpayPayment.status
        };
      }

      return {
        success: true,
        message: 'Payment status already synchronized',
        status: razorpayPayment.status
      };
    } catch (error) {
      console.error('Payment sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createRefundRecord(paymentId, amount, reason) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: true }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Create refund in Razorpay
      const razorpayRefund = await this.razorpay.createRefund(
        payment.razorpayPaymentId,
        amount,
        reason
      );

      if (!razorpayRefund.success) {
        throw new Error(razorpayRefund.error);
      }

      // Create local refund record
      const refund = await this.prisma.refund.create({
        data: {
          paymentId,
          organizationId: payment.organizationId,
          razorpayRefundId: razorpayRefund.refundId,
          amount,
          reason,
          status: 'created',
          createdAt: new Date()
        }
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          razorpayRefundId: razorpayRefund.refundId,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason
        }
      };
    } catch (error) {
      console.error('Refund creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPaymentAnalytics(organizationId, startDate, endDate) {
    try {
      const payments = await this.prisma.payment.findMany({
        where: {
          organizationId,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        include: {
          refunds: true,
          order: true
        }
      });

      const analytics = {
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
        successfulPayments: payments.filter(p => p.status === 'captured').length,
        failedPayments: payments.filter(p => p.status === 'failed').length,
        pendingPayments: payments.filter(p => p.status === 'authorized').length,
        totalRefunds: payments.reduce((sum, p) => sum + p.refunds.length, 0),
        refundAmount: payments.reduce((sum, p) => 
          sum + p.refunds.reduce((refundSum, r) => refundSum + r.amount, 0), 0
        ),
        averagePaymentAmount: payments.length > 0 
          ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length 
          : 0,
        paymentMethods: payments.reduce((methods, p) => {
          methods[p.method] = (methods[p.method] || 0) + 1;
          return methods;
        }, {}),
        dailyBreakdown: this.generateDailyBreakdown(payments)
      };

      return {
        success: true,
        analytics
      };
    } catch (error) {
      console.error('Payment analytics failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateDailyBreakdown(payments) {
    const breakdown = {};
    
    payments.forEach(payment => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!breakdown[date]) {
        breakdown[date] = {
          count: 0,
          amount: 0,
          successful: 0,
          failed: 0
        };
      }
      
      breakdown[date].count++;
      breakdown[date].amount += payment.amount;
      
      if (payment.status === 'captured') {
        breakdown[date].successful++;
      } else if (payment.status === 'failed') {
        breakdown[date].failed++;
      }
    });

    return breakdown;
  }
}

module.exports = PaymentReconciliationService;
