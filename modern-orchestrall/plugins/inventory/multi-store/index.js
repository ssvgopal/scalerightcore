// plugins/inventory/multi-store/index.js - Multi-Store Inventory Management Plugin
const cron = require('node-cron');
const QRCode = require('qrcode');
const Queue = require('bull');
const logger = require('../../../src/utils/logger');

class MultiStoreInventoryPlugin {
  constructor(config, prisma, loggerInstance) {
    this.config = config;
    this.prisma = prisma;
    this.logger = loggerInstance || logger;
    this.reorderCheckInterval = config.reorderCheckInterval || 3600000; // 1 hour
    this.transferApprovalRequired = config.transferApprovalRequired !== false;
    this.lowStockThreshold = config.lowStockThreshold || 10;
    this.barcodeApiUrl = config.barcodeApiUrl || 'https://api.barcode.com/v1/';
    this.notificationEmail = config.notificationEmail;
    this.initialized = false;
    
    // Initialize job queue
    this.reorderQueue = new Queue('reorder processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    // Setup job processors
    this.setupJobProcessors();
  }

  async initialize() {
    this.logger.info('Initializing Multi-Store Inventory Management...');
    
    try {
      // Test Redis connection
      await this.reorderQueue.isReady();
      
      // Start reorder monitoring
      this.startReorderMonitoring();
      
      this.initialized = true;
      this.logger.info('Multi-Store Inventory Management initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Multi-Store Inventory: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Multi-Store Inventory Management...');
    
    // Stop cron jobs
    cron.getTasks().forEach(task => task.stop());
    
    // Close job queue
    await this.reorderQueue.close();
    
    this.initialized = false;
    this.logger.info('Multi-Store Inventory Management shut down');
  }

  async healthCheck() {
    if (!this.initialized) {
      throw new Error('Multi-Store Inventory plugin not initialized');
    }
    
    try {
      const queueHealth = await this.reorderQueue.isReady();
      
      return { 
        status: 'ok', 
        message: 'Multi-Store Inventory is operational',
        redis: queueHealth ? 'connected' : 'disconnected',
        stores: await this.getStoreCount()
      };
    } catch (error) {
      this.logger.error(`Multi-Store Inventory health check failed: ${error.message}`);
      throw new Error(`Multi-Store Inventory connectivity issue: ${error.message}`);
    }
  }

  // Get store inventory
  async getStoreInventory(storeId, organizationId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const inventory = await this.prisma.inventoryItem.findMany({
        where: {
          storeId: storeId,
          organizationId: organizationId
        },
        include: {
          product: true,
          location: true
        }
      });

      // Group by product and calculate totals
      const inventorySummary = inventory.reduce((acc, item) => {
        const productId = item.productId;
        if (!acc[productId]) {
          acc[productId] = {
            product: item.product,
            totalQuantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            locations: []
          };
        }
        
        acc[productId].totalQuantity += item.quantity;
        acc[productId].reservedQuantity += item.reserved;
        acc[productId].availableQuantity += (item.quantity - item.reserved);
        acc[productId].locations.push({
          location: item.location,
          quantity: item.quantity,
          reserved: item.reserved
        });
        
        return acc;
      }, {});

      return {
        storeId: storeId,
        inventory: Object.values(inventorySummary),
        totalProducts: Object.keys(inventorySummary).length,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to get store inventory: ${error.message}`);
      throw error;
    }
  }

  // Create inventory transfer
  async createInventoryTransfer(transferData, organizationId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      // Validate transfer
      await this.validateTransfer(transferData);
      
      // Check if approval is required
      const status = this.transferApprovalRequired ? 'pending' : 'approved';
      
      const transfer = await this.prisma.inventoryTransfer.create({
        data: {
          fromStoreId: transferData.fromStoreId,
          toStoreId: transferData.toStoreId,
          productId: transferData.productId,
          quantity: transferData.quantity,
          status: status,
          requestedBy: transferData.requestedBy,
          metadata: transferData.metadata || {}
        }
      });

      // If no approval required, process immediately
      if (!this.transferApprovalRequired) {
        await this.processTransfer(transfer.id);
      }

      this.logger.info(`Inventory transfer created: ${transfer.id}`);
      return transfer;
    } catch (error) {
      this.logger.error(`Failed to create inventory transfer: ${error.message}`);
      throw error;
    }
  }

  // Approve inventory transfer
  async approveTransfer(transferId, approvedBy) {
    try {
      const transfer = await this.prisma.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'approved',
          approvedBy: approvedBy
        }
      });

      // Process the transfer
      await this.processTransfer(transferId);

      this.logger.info(`Transfer approved and processed: ${transferId}`);
      return transfer;
    } catch (error) {
      this.logger.error(`Failed to approve transfer: ${error.message}`);
      throw error;
    }
  }

  // Process inventory transfer
  async processTransfer(transferId) {
    try {
      const transfer = await this.prisma.inventoryTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromStore: true,
          toStore: true,
          product: true
        }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      // Check source inventory
      const sourceInventory = await this.prisma.inventoryItem.findFirst({
        where: {
          storeId: transfer.fromStoreId,
          productId: transfer.productId
        }
      });

      if (!sourceInventory || sourceInventory.quantity < transfer.quantity) {
        throw new Error('Insufficient inventory for transfer');
      }

      // Update source inventory
      await this.prisma.inventoryItem.update({
        where: { id: sourceInventory.id },
        data: {
          quantity: sourceInventory.quantity - transfer.quantity
        }
      });

      // Update or create destination inventory
      const destInventory = await this.prisma.inventoryItem.findFirst({
        where: {
          storeId: transfer.toStoreId,
          productId: transfer.productId
        }
      });

      if (destInventory) {
        await this.prisma.inventoryItem.update({
          where: { id: destInventory.id },
          data: {
            quantity: destInventory.quantity + transfer.quantity
          }
        });
      } else {
        // Create new inventory item for destination store
        await this.prisma.inventoryItem.create({
          data: {
            storeId: transfer.toStoreId,
            productId: transfer.productId,
            locationId: transfer.toStore.locationId || 'default',
            organizationId: transfer.fromStore.organizationId,
            quantity: transfer.quantity,
            reserved: 0
          }
        });
      }

      // Update transfer status
      await this.prisma.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          metadata: {
            ...transfer.metadata,
            processedAt: new Date().toISOString()
          }
        }
      });

      this.logger.info(`Transfer processed successfully: ${transferId}`);
    } catch (error) {
      // Mark transfer as failed
      await this.prisma.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'failed',
          metadata: {
            error: error.message,
            failedAt: new Date().toISOString()
          }
        }
      });

      this.logger.error(`Failed to process transfer: ${error.message}`);
      throw error;
    }
  }

  // Get transfer history
  async getTransferHistory(storeId, filters = {}) {
    try {
      const where = {
        OR: [
          { fromStoreId: storeId },
          { toStoreId: storeId }
        ]
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.dateRange) {
        where.createdAt = {
          gte: new Date(filters.dateRange.start),
          lte: new Date(filters.dateRange.end)
        };
      }

      const transfers = await this.prisma.inventoryTransfer.findMany({
        where: where,
        include: {
          fromStore: true,
          toStore: true,
          product: true
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      });

      return transfers;
    } catch (error) {
      this.logger.error(`Failed to get transfer history: ${error.message}`);
      throw error;
    }
  }

  // Create reorder rule
  async createReorderRule(storeId, productId, minQuantity, maxQuantity) {
    try {
      const rule = await this.prisma.reorderRule.create({
        data: {
          storeId: storeId,
          productId: productId,
          minQuantity: minQuantity,
          maxQuantity: maxQuantity,
          isActive: true
        }
      });

      this.logger.info(`Reorder rule created: ${rule.id}`);
      return rule;
    } catch (error) {
      this.logger.error(`Failed to create reorder rule: ${error.message}`);
      throw error;
    }
  }

  // Get low stock alerts
  async getLowStockAlerts(storeId, organizationId) {
    try {
      const alerts = await this.prisma.inventoryItem.findMany({
        where: {
          storeId: storeId,
          organizationId: organizationId,
          quantity: { lte: this.lowStockThreshold }
        },
        include: {
          product: true,
          store: true
        }
      });

      return alerts.map(item => ({
        productId: item.productId,
        productName: item.product.name,
        currentQuantity: item.quantity,
        threshold: this.lowStockThreshold,
        storeName: item.store.name,
        alertLevel: item.quantity === 0 ? 'critical' : 'warning'
      }));
    } catch (error) {
      this.logger.error(`Failed to get low stock alerts: ${error.message}`);
      throw error;
    }
  }

  // Generate QR code for product
  async generateProductQRCode(productId, storeId) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const qrData = {
        productId: productId,
        storeId: storeId,
        sku: product.sku,
        timestamp: Date.now()
      };

      const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
      
      return {
        qrCode: qrCode,
        product: product,
        data: qrData
      };
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`);
      throw error;
    }
  }

  // Scan barcode/QR code
  async scanBarcode(barcodeData, storeId) {
    try {
      let productData;
      
      try {
        // Try to parse as QR code data
        productData = JSON.parse(barcodeData);
      } catch {
        // Treat as regular barcode
        productData = { sku: barcodeData };
      }

      const product = await this.prisma.product.findFirst({
        where: {
          OR: [
            { sku: productData.sku },
            { id: productData.productId }
          ]
        }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Get inventory for this product in the store
      const inventory = await this.prisma.inventoryItem.findFirst({
        where: {
          storeId: storeId,
          productId: product.id
        }
      });

      return {
        product: product,
        inventory: inventory,
        found: true
      };
    } catch (error) {
      this.logger.error(`Failed to scan barcode: ${error.message}`);
      return {
        found: false,
        error: error.message
      };
    }
  }

  // Get store performance analytics
  async getStorePerformance(storeId, dateRange) {
    try {
      const performance = await this.prisma.storePerformance.findMany({
        where: {
          storeId: storeId,
          date: {
            gte: new Date(dateRange.start),
            lte: new Date(dateRange.end)
          }
        },
        orderBy: { date: 'asc' }
      });

      const analytics = {
        totalSales: performance.reduce((sum, p) => sum + parseFloat(p.sales), 0),
        totalOrders: performance.reduce((sum, p) => sum + p.orders, 0),
        averageOrderValue: 0,
        dailyData: performance,
        trends: this.calculateTrends(performance)
      };

      if (analytics.totalOrders > 0) {
        analytics.averageOrderValue = analytics.totalSales / analytics.totalOrders;
      }

      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get store performance: ${error.message}`);
      throw error;
    }
  }

  // Validate transfer
  async validateTransfer(transferData) {
    // Check if stores exist
    const fromStore = await this.prisma.store.findUnique({
      where: { id: transferData.fromStoreId }
    });
    
    const toStore = await this.prisma.store.findUnique({
      where: { id: transferData.toStoreId }
    });

    if (!fromStore || !toStore) {
      throw new Error('Invalid store IDs');
    }

    if (fromStore.id === toStore.id) {
      throw new Error('Cannot transfer to the same store');
    }

    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: transferData.productId }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Check quantity
    if (transferData.quantity <= 0) {
      throw new Error('Transfer quantity must be positive');
    }
  }

  // Setup job processors
  setupJobProcessors() {
    this.reorderQueue.process('check-reorders', async (job) => {
      try {
        await this.checkReorderRules(job.data.storeId);
      } catch (error) {
        this.logger.error(`Reorder check job failed: ${error.message}`);
        throw error;
      }
    });
  }

  // Start reorder monitoring
  startReorderMonitoring() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.checkAllReorderRules();
      } catch (error) {
        this.logger.error(`Reorder monitoring failed: ${error.message}`);
      }
    });
  }

  // Check all reorder rules
  async checkAllReorderRules() {
    try {
      const stores = await this.prisma.store.findMany();
      
      for (const store of stores) {
        await this.checkReorderRules(store.id);
      }
    } catch (error) {
      this.logger.error(`Failed to check all reorder rules: ${error.message}`);
    }
  }

  // Check reorder rules for a store
  async checkReorderRules(storeId) {
    try {
      const rules = await this.prisma.reorderRule.findMany({
        where: {
          storeId: storeId,
          isActive: true
        },
        include: {
          product: true
        }
      });

      for (const rule of rules) {
        const inventory = await this.prisma.inventoryItem.findFirst({
          where: {
            storeId: storeId,
            productId: rule.productId
          }
        });

        if (!inventory || inventory.quantity <= rule.minQuantity) {
          // Trigger reorder
          await this.triggerReorder(rule, inventory);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check reorder rules for store ${storeId}: ${error.message}`);
    }
  }

  // Trigger reorder
  async triggerReorder(rule, inventory) {
    try {
      const reorderQuantity = rule.maxQuantity - (inventory?.quantity || 0);
      
      // Add job to queue for processing
      await this.reorderQueue.add('process-reorder', {
        ruleId: rule.id,
        productId: rule.productId,
        storeId: rule.storeId,
        quantity: reorderQuantity
      });

      this.logger.info(`Reorder triggered for product ${rule.productId} in store ${rule.storeId}`);
    } catch (error) {
      this.logger.error(`Failed to trigger reorder: ${error.message}`);
    }
  }

  // Calculate trends
  calculateTrends(data) {
    if (data.length < 2) return { sales: 'stable', orders: 'stable' };
    
    const recent = data.slice(-7);
    const previous = data.slice(-14, -7);
    
    const recentSales = recent.reduce((sum, d) => sum + parseFloat(d.sales), 0);
    const previousSales = previous.reduce((sum, d) => sum + parseFloat(d.sales), 0);
    
    const recentOrders = recent.reduce((sum, d) => sum + d.orders, 0);
    const previousOrders = previous.reduce((sum, d) => sum + d.orders, 0);
    
    const salesTrend = recentSales > previousSales ? 'rising' : 
                     recentSales < previousSales ? 'falling' : 'stable';
    
    const ordersTrend = recentOrders > previousOrders ? 'rising' : 
                       recentOrders < previousOrders ? 'falling' : 'stable';
    
    return { sales: salesTrend, orders: ordersTrend };
  }

  // Get store count
  async getStoreCount() {
    try {
      return await this.prisma.store.count();
    } catch (error) {
      return 0;
    }
  }
}

module.exports = MultiStoreInventoryPlugin;
