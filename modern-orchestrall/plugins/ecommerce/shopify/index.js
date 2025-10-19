// plugins/ecommerce/shopify/index.js - Shopify Connector Plugin
const axios = require('axios');
const crypto = require('crypto');

class ShopifyConnector {
  constructor({ prisma, config, clientId, logger }) {
    this.prisma = prisma;
    this.config = config;
    this.clientId = clientId;
    this.logger = logger;
    this.shopName = config.shopName;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = `https://${this.shopName}.myshopify.com/admin/api/2023-10`;
    this.rateLimitDelay = 500; // 2 calls per second
    this.lastRequestTime = 0;
  }

  async initialize() {
    try {
      this.logger.info(`Initializing Shopify connector for shop: ${this.shopName}`);
      
      // Validate configuration
      if (!this.shopName || !this.apiKey) {
        throw new Error('Missing required Shopify configuration');
      }

      // Test API connection
      await this.testConnection();
      
      // Set up webhook endpoints
      await this.setupWebhooks();
      
      this.logger.info('Shopify connector initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Shopify connector', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.makeRequest('GET', '/shop.json');
      this.logger.info(`Connected to Shopify shop: ${response.data.shop.name}`);
      return response.data;
    } catch (error) {
      this.logger.error('Shopify connection test failed', error);
      throw error;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-Shopify-Access-Token': this.apiKey,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        data
      });

      return response;
    } catch (error) {
      this.logger.error(`Shopify API request failed: ${method} ${endpoint}`, {
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  // Product sync methods
  async syncProductsFromShopify() {
    try {
      this.logger.info('Starting product sync from Shopify');
      
      let pageInfo = null;
      let allProducts = [];
      
      do {
        const endpoint = pageInfo 
          ? `/products.json?limit=250&page_info=${pageInfo}`
          : '/products.json?limit=250';
          
        const response = await this.makeRequest('GET', endpoint);
        const products = response.data.products;
        
        allProducts = allProducts.concat(products);
        
        // Extract page info from Link header
        const linkHeader = response.headers.link;
        pageInfo = this.extractPageInfo(linkHeader);
        
      } while (pageInfo);

      // Process products
      for (const shopifyProduct of allProducts) {
        await this.syncProduct(shopifyProduct);
      }

      this.logger.info(`Synced ${allProducts.length} products from Shopify`);
      return allProducts.length;
      
    } catch (error) {
      this.logger.error('Product sync from Shopify failed', error);
      throw error;
    }
  }

  async syncProduct(shopifyProduct) {
    try {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          sku: shopifyProduct.id.toString(),
          organizationId: this.clientId
        }
      });

      const productData = {
        name: shopifyProduct.title,
        description: shopifyProduct.body_html,
        price: parseFloat(shopifyProduct.variants[0]?.price || 0),
        sku: shopifyProduct.id.toString(),
        attributes: {
          shopifyId: shopifyProduct.id,
          handle: shopifyProduct.handle,
          productType: shopifyProduct.product_type,
          vendor: shopifyProduct.vendor,
          tags: shopifyProduct.tags.split(',').map(tag => tag.trim()),
          variants: shopifyProduct.variants.map(variant => ({
            id: variant.id,
            title: variant.title,
            price: variant.price,
            sku: variant.sku,
            inventoryQuantity: variant.inventory_quantity
          }))
        },
        metadata: {
          lastSync: new Date().toISOString(),
          shopifyData: shopifyProduct
        },
        organizationId: this.clientId
      };

      if (existingProduct) {
        await this.prisma.product.update({
          where: { id: existingProduct.id },
          data: productData
        });
        this.logger.debug(`Updated product: ${shopifyProduct.title}`);
      } else {
        await this.prisma.product.create({
          data: productData
        });
        this.logger.debug(`Created product: ${shopifyProduct.title}`);
      }

    } catch (error) {
      this.logger.error(`Failed to sync product ${shopifyProduct.title}`, error);
    }
  }

  // Order sync methods
  async syncOrdersFromShopify() {
    try {
      this.logger.info('Starting order sync from Shopify');
      
      const endpoint = '/orders.json?status=any&limit=250';
      const response = await this.makeRequest('GET', endpoint);
      const orders = response.data.orders;

      for (const shopifyOrder of orders) {
        await this.syncOrder(shopifyOrder);
      }

      this.logger.info(`Synced ${orders.length} orders from Shopify`);
      return orders.length;
      
    } catch (error) {
      this.logger.error('Order sync from Shopify failed', error);
      throw error;
    }
  }

  async syncOrder(shopifyOrder) {
    try {
      // Find or create customer
      let customer = await this.prisma.customer.findFirst({
        where: {
          email: shopifyOrder.customer?.email,
          organizationId: this.clientId
        }
      });

      if (!customer && shopifyOrder.customer) {
        customer = await this.prisma.customer.create({
          data: {
            email: shopifyOrder.customer.email,
            name: `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`,
            phone: shopifyOrder.customer.phone,
            organizationId: this.clientId
          }
        });
      }

      // Find or create order
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          orderNumber: shopifyOrder.name,
          organizationId: this.clientId
        }
      });

      const orderData = {
        orderNumber: shopifyOrder.name,
        customerId: customer?.id,
        status: this.mapOrderStatus(shopifyOrder.financial_status),
        total: parseFloat(shopifyOrder.total_price),
        organizationId: this.clientId,
        items: {
          create: shopifyOrder.line_items.map(item => ({
            productId: await this.findProductByShopifyId(item.product_id),
            quantity: item.quantity,
            price: parseFloat(item.price)
          }))
        }
      };

      if (existingOrder) {
        await this.prisma.order.update({
          where: { id: existingOrder.id },
          data: orderData
        });
      } else {
        await this.prisma.order.create({
          data: orderData
        });
      }

    } catch (error) {
      this.logger.error(`Failed to sync order ${shopifyOrder.name}`, error);
    }
  }

  // Inventory sync methods
  async syncInventoryToShopify() {
    try {
      this.logger.info('Starting inventory sync to Shopify');
      
      const products = await this.prisma.product.findMany({
        where: {
          organizationId: this.clientId,
          attributes: {
            path: ['shopifyId'],
            not: null
          }
        }
      });

      for (const product of products) {
        await this.syncProductInventory(product);
      }

      this.logger.info(`Synced inventory for ${products.length} products to Shopify`);
      
    } catch (error) {
      this.logger.error('Inventory sync to Shopify failed', error);
      throw error;
    }
  }

  async syncProductInventory(product) {
    try {
      const shopifyId = product.attributes.shopifyId;
      if (!shopifyId) return;

      // Get inventory levels from our database
      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where: {
          productId: product.id
        },
        include: {
          location: true
        }
      });

      // Calculate total available inventory
      const totalQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

      // Update Shopify inventory
      const endpoint = `/products/${shopifyId}.json`;
      const productData = {
        product: {
          id: shopifyId,
          variants: product.attributes.variants.map(variant => ({
            id: variant.id,
            inventory_quantity: totalQuantity
          }))
        }
      };

      await this.makeRequest('PUT', endpoint, productData);
      
    } catch (error) {
      this.logger.error(`Failed to sync inventory for product ${product.name}`, error);
    }
  }

  // Webhook handling
  async setupWebhooks() {
    // This would typically register webhooks with Shopify
    // For now, we'll just log that webhooks would be set up
    this.logger.info('Webhook setup would be implemented here');
  }

  async handleWebhook(payload, signature) {
    try {
      // Verify webhook signature
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(payload, 'utf8');
      const calculatedSignature = hmac.digest('base64');

      if (signature !== calculatedSignature) {
        throw new Error('Invalid webhook signature');
      }

      const data = JSON.parse(payload);
      
      // Handle different webhook types
      switch (data.topic) {
        case 'orders/create':
          await this.syncOrder(data);
          break;
        case 'orders/updated':
          await this.syncOrder(data);
          break;
        case 'products/create':
          await this.syncProduct(data);
          break;
        case 'products/update':
          await this.syncProduct(data);
          break;
        default:
          this.logger.info(`Unhandled webhook topic: ${data.topic}`);
      }

    } catch (error) {
      this.logger.error('Webhook handling failed', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.testConnection();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Utility methods
  mapOrderStatus(shopifyStatus) {
    const statusMap = {
      'pending': 'pending',
      'authorized': 'confirmed',
      'partially_paid': 'confirmed',
      'paid': 'confirmed',
      'partially_refunded': 'confirmed',
      'refunded': 'cancelled',
      'voided': 'cancelled'
    };
    return statusMap[shopifyStatus] || 'pending';
  }

  async findProductByShopifyId(shopifyId) {
    const product = await this.prisma.product.findFirst({
      where: {
        attributes: {
          path: ['shopifyId'],
          equals: shopifyId
        },
        organizationId: this.clientId
      }
    });
    return product?.id;
  }

  extractPageInfo(linkHeader) {
    if (!linkHeader) return null;
    
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      const url = new URL(match[1]);
      return url.searchParams.get('page_info');
    }
    return null;
  }

  async cleanup() {
    this.logger.info('Cleaning up Shopify connector');
    // Any cleanup logic would go here
  }
}

module.exports = ShopifyConnector;
