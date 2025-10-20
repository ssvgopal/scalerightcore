// src/frontend/WebSocketManager.js - Real-time Updates Manager
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000;
    this.isConnected = false;
    this.listeners = new Map();
    this.heartbeatInterval = null;
  }

  // Connect to WebSocket server
  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('⚠️ WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };
      
    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      this.emit('error', error);
    }
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.isConnected = false;
  }

  // Send message to server
  send(type, data = {}) {
    if (this.isConnected && this.ws) {
      const message = {
        type,
        data,
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
    }
  }

  // Subscribe to specific event types
  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  // Unsubscribe from specific event types
  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emit event to all listeners
  emit(eventType, data = null) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in WebSocket listener for ${eventType}:`, error);
        }
      });
    }
  }

  // Handle incoming messages
  handleMessage(message) {
    const { type, data, timestamp } = message;
    
    switch (type) {
      case 'entity_created':
        this.emit('entityCreated', { entity: data.entity, data: data.data });
        break;
      case 'entity_updated':
        this.emit('entityUpdated', { entity: data.entity, data: data.data });
        break;
      case 'entity_deleted':
        this.emit('entityDeleted', { entity: data.entity, id: data.id });
        break;
      case 'bulk_operation':
        this.emit('bulkOperation', { entity: data.entity, operation: data.operation, data: data.data });
        break;
      case 'system_status':
        this.emit('systemStatus', data);
        break;
      case 'notification':
        this.emit('notification', { message: data.message, type: data.type });
        break;
      case 'heartbeat':
        // Heartbeat response, connection is alive
        break;
      default:
        console.log('📨 Unknown WebSocket message type:', type);
    }
  }

  // Start heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('heartbeat');
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
    }
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      listeners: this.listeners.size
    };
  }
}

// Global WebSocket manager instance
window.WebSocketManager = window.WebSocketManager || new WebSocketManager();

module.exports = WebSocketManager;
