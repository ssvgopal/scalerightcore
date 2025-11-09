const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');

class PushNotificationService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Set VAPID keys (you should set these in environment variables)
    const vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI8L8z9Qj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8',
      privateKey: process.env.VAPID_PRIVATE_KEY || 'private_key_here'
    };

    webpush.setVapidDetails(
      'mailto:admin@kisaansay.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );

    this.isInitialized = true;
    console.log('✅ Push notification service initialized');
  }

  async subscribeUser(userId, subscriptionData) {
    try {
      const subscription = await this.prisma.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId,
            endpoint: subscriptionData.endpoint
          }
        },
        update: {
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
          isActive: true
        },
        create: {
          userId,
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
          isActive: true
        }
      });

      console.log(`📱 Push subscription created for user ${userId}`);
      return subscription;
    } catch (error) {
      console.error('Failed to create push subscription:', error);
      throw error;
    }
  }

  async unsubscribeUser(userId, endpoint) {
    try {
      await this.prisma.pushSubscription.updateMany({
        where: {
          userId,
          endpoint
        },
        data: {
          isActive: false
        }
      });

      console.log(`📱 Push subscription deactivated for user ${userId}`);
    } catch (error) {
      console.error('Failed to deactivate push subscription:', error);
      throw error;
    }
  }

  async sendNotification(userId, notification) {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId,
          isActive: true
        }
      });

      if (subscriptions.length === 0) {
        console.warn(`No active push subscriptions found for user ${userId}`);
        return 0;
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/icons/badge-72x72.png',
        data: notification.data || {},
        actions: notification.actions || [],
        tag: notification.tag,
        requireInteraction: notification.requireInteraction || false,
        silent: notification.silent || false
      });

      let sentCount = 0;
      const results = [];

      for (const subscription of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          };

          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
          results.push({ success: true, subscriptionId: subscription.id });
        } catch (error) {
          console.error(`Failed to send push notification to subscription ${subscription.id}:`, error);
          results.push({ success: false, subscriptionId: subscription.id, error: error.message });
          
          // If subscription is invalid, deactivate it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { isActive: false }
            });
          }
        }
      }

      // Log notification history
      await this.prisma.notificationHistory.create({
        data: {
          userId,
          channel: 'PUSH',
          type: notification.type || 'general',
          subject: notification.title,
          body: notification.body,
          status: sentCount > 0 ? 'SENT' : 'FAILED',
          metadata: {
            sentCount,
            totalSubscriptions: subscriptions.length,
            results
          }
        }
      });

      console.log(`📱 Push notification sent to ${sentCount}/${subscriptions.length} subscriptions for user ${userId}`);
      return sentCount;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }

  async sendToMultipleUsers(userIds, notification) {
    let totalSent = 0;
    const results = [];

    for (const userId of userIds) {
      try {
        const sentCount = await this.sendNotification(userId, notification);
        totalSent += sentCount;
        results.push({ userId, sentCount, success: true });
      } catch (error) {
        console.error(`Failed to send push notification to user ${userId}:`, error);
        results.push({ userId, sentCount: 0, success: false, error: error.message });
      }
    }

    console.log(`📱 Push notifications sent to ${totalSent} total subscriptions across ${userIds.length} users`);
    return { totalSent, results };
  }

  async sendToOrganization(organizationId, notification) {
    try {
      const users = await this.prisma.user.findMany({
        where: { organizationId },
        select: { id: true }
      });

      const userIds = users.map(user => user.id);
      return await this.sendToMultipleUsers(userIds, notification);
    } catch (error) {
      console.error('Failed to send push notification to organization:', error);
      throw error;
    }
  }

  async getSubscriptionStats(userId) {
    try {
      const stats = await this.prisma.pushSubscription.aggregate({
        where: { userId },
        _count: {
          id: true
        }
      });

      const activeStats = await this.prisma.pushSubscription.aggregate({
        where: {
          userId,
          isActive: true
        },
        _count: {
          id: true
        }
      });

      return {
        totalSubscriptions: stats._count.id,
        activeSubscriptions: activeStats._count.id
      };
    } catch (error) {
      console.error('Failed to get subscription stats:', error);
      throw error;
    }
  }

  async getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI8L8z9Qj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8zQj8';
  }
}

module.exports = PushNotificationService;
