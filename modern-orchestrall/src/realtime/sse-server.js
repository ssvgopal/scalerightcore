const { PrismaClient } = require('@prisma/client');

class SSEServer {
  constructor(prisma) {
    this.prisma = prisma;
    this.connections = new Map(); // connectionId -> SSE connection
    this.userConnections = new Map(); // userId -> Set of connectionIds
    this.subscriptions = new Map(); // connectionId -> Set of topics
  }

  initialize(app) {
    // SSE endpoint
    app.get('/events', async (request, reply) => {
      await this.handleSSEConnection(request, reply);
    });

    console.log('✅ SSE server initialized on /events');
  }

  async handleSSEConnection(request, reply) {
    const connectionId = this.generateConnectionId();
    const token = request.query.token;
    
    let userId = null;
    let organizationId = null;

    // Authenticate user if token provided
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const config = require('../../config');
        const decoded = jwt.verify(token, config.jwt.secret);
        userId = decoded.userId;
        organizationId = decoded.organizationId;
      } catch (error) {
        console.warn('Invalid SSE token:', error.message);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store connection
    const connection = {
      reply,
      userId,
      organizationId,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: new Set()
    };

    this.connections.set(connectionId, connection);

    // Track user connections
    if (userId) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId).add(connectionId);
    }

    // Send initial connection event
    this.sendSSEMessage(connectionId, {
      type: 'connection_established',
      data: {
        connectionId,
        userId,
        timestamp: new Date().toISOString()
      }
    });

    // Handle connection cleanup
    request.raw.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Start ping interval
    const pingInterval = setInterval(() => {
      if (this.connections.has(connectionId)) {
        this.sendSSEMessage(connectionId, {
          type: 'ping',
          data: { timestamp: new Date().toISOString() }
        });
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

    console.log(`📡 SSE connected: ${connectionId} (user: ${userId || 'anonymous'})`);

    // Keep connection alive
    return new Promise(() => {}); // Never resolve to keep connection open
  }

  sendSSEMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      const data = JSON.stringify(message);
      connection.reply.raw.write(`data: ${data}\n\n`);
      return true;
    } catch (error) {
      console.error(`Failed to send SSE message to ${connectionId}:`, error);
      return false;
    }
  }

  sendToUser(userId, message) {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let sentCount = 0;
    for (const connectionId of userConnections) {
      if (this.sendSSEMessage(connectionId, message)) {
        sentCount++;
      }
    }
    return sentCount;
  }

  sendToOrganization(organizationId, message) {
    let sentCount = 0;
    for (const [connectionId, connection] of this.connections) {
      if (connection.organizationId === organizationId) {
        if (this.sendSSEMessage(connectionId, message)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  broadcast(message, filter = null) {
    let sentCount = 0;
    for (const [connectionId, connection] of this.connections) {
      if (!filter || filter(connection)) {
        if (this.sendSSEMessage(connectionId, message)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  async broadcastEvent(eventType, data, options = {}) {
    const message = {
      type: 'event',
      eventType,
      data,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;

    // Store event in database
    try {
      await this.prisma.realTimeEvent.create({
        data: {
          type: eventType,
          data,
          userId: options.userId,
          organizationId: options.organizationId,
          expiresAt: options.expiresAt
        }
      });
    } catch (error) {
      console.error('Failed to store real-time event:', error);
    }

    // Broadcast based on options
    if (options.userId) {
      sentCount = this.sendToUser(options.userId, message);
    } else if (options.organizationId) {
      sentCount = this.sendToOrganization(options.organizationId, message);
    } else {
      sentCount = this.broadcast(message, options.filter);
    }

    console.log(`📢 SSE Broadcasted ${eventType} to ${sentCount} connections`);
    return sentCount;
  }

  handleDisconnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    if (connection.userId && this.userConnections.has(connection.userId)) {
      this.userConnections.get(connection.userId).delete(connectionId);
      if (this.userConnections.get(connection.userId).size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from connections
    this.connections.delete(connectionId);
    this.subscriptions.delete(connectionId);

    console.log(`📡 SSE disconnected: ${connectionId}`);
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      userConnections: this.userConnections.size,
      connectionsByUser: Array.from(this.userConnections.entries()).map(([userId, connections]) => ({
        userId,
        connectionCount: connections.size
      }))
    };
  }

  generateConnectionId() {
    return 'sse_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // Subscribe to specific topics
  subscribe(connectionId, topics) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    if (!this.subscriptions.has(connectionId)) {
      this.subscriptions.set(connectionId, new Set());
    }

    const topicsArray = Array.isArray(topics) ? topics : [topics];
    topicsArray.forEach(topic => {
      this.subscriptions.get(connectionId).add(topic);
    });

    this.sendSSEMessage(connectionId, {
      type: 'subscription_confirmed',
      data: {
        topics: topicsArray,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📡 SSE Subscription: ${connectionId} -> ${topicsArray.join(', ')}`);
    return true;
  }

  // Unsubscribe from topics
  unsubscribe(connectionId, topics) {
    const connection = this.connections.get(connectionId);
    if (!connection || !this.subscriptions.has(connectionId)) return false;

    const topicsArray = Array.isArray(topics) ? topics : [topics];
    topicsArray.forEach(topic => {
      this.subscriptions.get(connectionId).delete(topic);
    });

    this.sendSSEMessage(connectionId, {
      type: 'unsubscription_confirmed',
      data: {
        topics: topicsArray,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📡 SSE Unsubscription: ${connectionId} -> ${topicsArray.join(', ')}`);
    return true;
  }

  // Send event to subscribers of specific topics
  async sendToSubscribers(topics, message) {
    const topicsArray = Array.isArray(topics) ? topics : [topics];
    let sentCount = 0;

    for (const [connectionId, subscribedTopics] of this.subscriptions) {
      const hasAnyTopic = topicsArray.some(topic => subscribedTopics.has(topic));
      if (hasAnyTopic && this.sendSSEMessage(connectionId, message)) {
        sentCount++;
      }
    }

    console.log(`📢 SSE Sent to ${sentCount} subscribers of topics: ${topicsArray.join(', ')}`);
    return sentCount;
  }
}

module.exports = SSEServer;
