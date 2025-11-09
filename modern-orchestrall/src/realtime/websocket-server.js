const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');

class WebSocketServer {
  constructor(server, prisma) {
    this.server = server;
    this.prisma = prisma;
    this.wss = null;
    this.connections = new Map(); // sessionId -> WebSocket connection
    this.userConnections = new Map(); // userId -> Set of sessionIds
  }

  initialize() {
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('✅ WebSocket server initialized on /ws');
  }

  async handleConnection(ws, request) {
    const sessionId = this.generateSessionId();
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    
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
        console.warn('Invalid WebSocket token:', error.message);
      }
    }

    // Store connection
    this.connections.set(sessionId, {
      ws,
      userId,
      organizationId,
      connectedAt: new Date(),
      lastPing: new Date()
    });

    // Track user connections
    if (userId) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId).add(sessionId);
    }

    // Store in database
    try {
      await this.prisma.webSocketConnection.create({
        data: {
          sessionId,
          userId,
          organizationId,
          isActive: true,
          metadata: {
            userAgent: request.headers['user-agent'],
            ip: request.connection.remoteAddress
          }
        }
      });
    } catch (error) {
      console.error('Failed to store WebSocket connection:', error);
    }

    // Send welcome message
    this.sendToConnection(sessionId, {
      type: 'connection_established',
      data: {
        sessionId,
        userId,
        timestamp: new Date().toISOString()
      }
    });

    // Handle messages
    ws.on('message', (message) => {
      this.handleMessage(sessionId, message);
    });

    // Handle ping/pong for connection health
    ws.on('pong', () => {
      const connection = this.connections.get(sessionId);
      if (connection) {
        connection.lastPing = new Date();
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(sessionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      this.handleDisconnection(sessionId);
    });

    console.log(`🔌 WebSocket connected: ${sessionId} (user: ${userId || 'anonymous'})`);
  }

  async handleMessage(sessionId, message) {
    try {
      const data = JSON.parse(message);
      const connection = this.connections.get(sessionId);
      
      if (!connection) {
        console.warn(`No connection found for session ${sessionId}`);
        return;
      }

      switch (data.type) {
        case 'ping':
          this.sendToConnection(sessionId, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() }
          });
          break;

        case 'subscribe':
          await this.handleSubscription(sessionId, data.data);
          break;

        case 'unsubscribe':
          await this.handleUnsubscription(sessionId, data.data);
          break;

        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${sessionId}:`, error);
    }
  }

  async handleSubscription(sessionId, subscriptionData) {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    // Store subscription in connection metadata
    if (!connection.subscriptions) {
      connection.subscriptions = new Set();
    }
    connection.subscriptions.add(subscriptionData.topic);

    this.sendToConnection(sessionId, {
      type: 'subscription_confirmed',
      data: {
        topic: subscriptionData.topic,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📡 Subscription: ${sessionId} -> ${subscriptionData.topic}`);
  }

  async handleUnsubscription(sessionId, subscriptionData) {
    const connection = this.connections.get(sessionId);
    if (!connection || !connection.subscriptions) return;

    connection.subscriptions.delete(subscriptionData.topic);

    this.sendToConnection(sessionId, {
      type: 'unsubscription_confirmed',
      data: {
        topic: subscriptionData.topic,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`📡 Unsubscription: ${sessionId} -> ${subscriptionData.topic}`);
  }

  async handleDisconnection(sessionId) {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    // Remove from user connections
    if (connection.userId && this.userConnections.has(connection.userId)) {
      this.userConnections.get(connection.userId).delete(sessionId);
      if (this.userConnections.get(connection.userId).size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Update database
    try {
      await this.prisma.webSocketConnection.updateMany({
        where: { sessionId },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Failed to update WebSocket connection:', error);
    }

    // Remove from connections
    this.connections.delete(sessionId);

    console.log(`🔌 WebSocket disconnected: ${sessionId}`);
  }

  sendToConnection(sessionId, message) {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${sessionId}:`, error);
      return false;
    }
  }

  sendToUser(userId, message) {
    const userSessions = this.userConnections.get(userId);
    if (!userSessions) return 0;

    let sentCount = 0;
    for (const sessionId of userSessions) {
      if (this.sendToConnection(sessionId, message)) {
        sentCount++;
      }
    }
    return sentCount;
  }

  sendToOrganization(organizationId, message) {
    let sentCount = 0;
    for (const [sessionId, connection] of this.connections) {
      if (connection.organizationId === organizationId) {
        if (this.sendToConnection(sessionId, message)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  broadcast(message, filter = null) {
    let sentCount = 0;
    for (const [sessionId, connection] of this.connections) {
      if (!filter || filter(connection)) {
        if (this.sendToConnection(sessionId, message)) {
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

    console.log(`📢 Broadcasted ${eventType} to ${sentCount} connections`);
    return sentCount;
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      userConnections: this.userConnections.size,
      connectionsByUser: Array.from(this.userConnections.entries()).map(([userId, sessions]) => ({
        userId,
        sessionCount: sessions.size
      }))
    };
  }

  generateSessionId() {
    return 'ws_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // Health check for connections
  async healthCheck() {
    const now = new Date();
    const staleThreshold = 60000; // 1 minute

    for (const [sessionId, connection] of this.connections) {
      if (now - connection.lastPing > staleThreshold) {
        console.warn(`Stale connection detected: ${sessionId}`);
        connection.ws.ping();
      }
    }
  }

  // Start periodic health checks
  startHealthChecks() {
    setInterval(() => {
      this.healthCheck();
    }, 30000); // Every 30 seconds
  }
}

module.exports = WebSocketServer;
