const ElasticsearchService = require('./elasticsearch-service');

class SearchIndexingService {
  constructor(prisma) {
    this.prisma = prisma;
    this.elasticsearch = new ElasticsearchService();
    this.indexingJobs = new Map();
  }

  async initializeIndexes() {
    try {
      // Product index mapping
      const productMapping = {
        properties: {
          id: { type: 'keyword' },
          name: { 
            type: 'text',
            analyzer: 'custom_analyzer',
            fields: {
              keyword: { type: 'keyword' },
              suggest: { type: 'completion' }
            }
          },
          description: { 
            type: 'text',
            analyzer: 'custom_analyzer'
          },
          category: { type: 'keyword' },
          brand: { type: 'keyword' },
          price: { type: 'float' },
          sku: { type: 'keyword' },
          tags: { type: 'keyword' },
          organizationId: { type: 'keyword' },
          storeId: { type: 'keyword' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          isActive: { type: 'boolean' }
        }
      };

      // User index mapping
      const userMapping = {
        properties: {
          id: { type: 'keyword' },
          name: { 
            type: 'text',
            analyzer: 'custom_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          email: { type: 'keyword' },
          phone: { type: 'keyword' },
          role: { type: 'keyword' },
          organizationId: { type: 'keyword' },
          createdAt: { type: 'date' },
          lastLoginAt: { type: 'date' },
          isActive: { type: 'boolean' }
        }
      };

      // Order index mapping
      const orderMapping = {
        properties: {
          id: { type: 'keyword' },
          orderNumber: { type: 'keyword' },
          customerId: { type: 'keyword' },
          customerName: { 
            type: 'text',
            analyzer: 'custom_analyzer'
          },
          status: { type: 'keyword' },
          totalAmount: { type: 'float' },
          organizationId: { type: 'keyword' },
          storeId: { type: 'keyword' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          items: {
            type: 'nested',
            properties: {
              productId: { type: 'keyword' },
              productName: { type: 'text' },
              quantity: { type: 'integer' },
              price: { type: 'float' }
            }
          }
        }
      };

      // Create indexes
      await this.elasticsearch.createIndex('products', productMapping);
      await this.elasticsearch.createIndex('users', userMapping);
      await this.elasticsearch.createIndex('orders', orderMapping);

      return {
        success: true,
        message: 'Indexes initialized successfully'
      };
    } catch (error) {
      console.error('Index initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async startIndexingJob(entityType, organizationId, options = {}) {
    const jobId = `indexing_${entityType}_${organizationId}_${Date.now()}`;
    
    const job = {
      id: jobId,
      entityType,
      organizationId,
      status: 'running',
      startedAt: new Date(),
      options: {
        batchSize: options.batchSize || 100,
        ...options
      },
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0
      },
      results: {
        indexed: [],
        errors: []
      }
    };

    this.indexingJobs.set(jobId, job);

    // Start indexing process in background
    this.performIndexing(jobId).catch(error => {
      console.error(`Indexing job ${jobId} failed:`, error);
      const job = this.indexingJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
      }
    });

    return {
      success: true,
      jobId,
      message: `${entityType} indexing job started`
    };
  }

  async performIndexing(jobId) {
    const job = this.indexingJobs.get(jobId);
    if (!job) {
      throw new Error('Indexing job not found');
    }

    try {
      let documents = [];
      
      switch (job.entityType) {
        case 'products':
          documents = await this.getProductsForIndexing(job.organizationId, job.options);
          break;
        case 'users':
          documents = await this.getUsersForIndexing(job.organizationId, job.options);
          break;
        case 'orders':
          documents = await this.getOrdersForIndexing(job.organizationId, job.options);
          break;
        default:
          throw new Error(`Unsupported entity type: ${job.entityType}`);
      }

      job.progress.total = documents.length;

      // Index documents in batches
      const batchSize = job.options.batchSize;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const result = await this.elasticsearch.bulkIndex(job.entityType, batch);
        
        job.progress.processed += batch.length;
        job.progress.successful += result.results.successful;
        job.progress.failed += result.results.failed;
        
        if (result.results.errors.length > 0) {
          job.results.errors.push(...result.results.errors);
        }
      }

      job.status = 'completed';
      job.completedAt = new Date();
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      throw error;
    }
  }

  async getProductsForIndexing(organizationId, options) {
    const products = await this.prisma.product.findMany({
      where: { organizationId },
      include: {
        category: true,
        store: true
      },
      take: options.limit || 10000
    });

    return products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category?.name,
      brand: product.brand,
      price: product.price,
      sku: product.sku,
      tags: product.tags || [],
      organizationId: product.organizationId,
      storeId: product.storeId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      isActive: product.isActive
    }));
  }

  async getUsersForIndexing(organizationId, options) {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      take: options.limit || 10000
    });

    return users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive
    }));
  }

  async getOrdersForIndexing(organizationId, options) {
    const orders = await this.prisma.order.findMany({
      where: { organizationId },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        store: true
      },
      take: options.limit || 10000
    });

    return orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer?.name,
      status: order.status,
      totalAmount: order.totalAmount,
      organizationId: order.organizationId,
      storeId: order.storeId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.product?.name,
        quantity: item.quantity,
        price: item.price
      }))
    }));
  }

  async searchProducts(query, organizationId, options = {}) {
    try {
      const searchQuery = {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['name^3', 'description^2', 'category', 'brand', 'tags'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ],
          filter: [
            { term: { organizationId } },
            { term: { isActive: true } }
          ]
        }
      };

      if (options.storeId) {
        searchQuery.bool.filter.push({ term: { storeId: options.storeId } });
      }

      if (options.category) {
        searchQuery.bool.filter.push({ term: { category: options.category } });
      }

      if (options.priceRange) {
        searchQuery.bool.filter.push({
          range: {
            price: {
              gte: options.priceRange.min,
              lte: options.priceRange.max
            }
          }
        });
      }

      const result = await this.elasticsearch.search('products', searchQuery, {
        size: options.limit || 20,
        from: options.offset || 0,
        sort: options.sort || [{ _score: { order: 'desc' } }]
      });

      return {
        success: true,
        products: result.hits,
        total: result.total,
        took: result.took
      };
    } catch (error) {
      console.error('Product search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchUsers(query, organizationId, options = {}) {
    try {
      const searchQuery = {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['name^2', 'email', 'phone'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ],
          filter: [
            { term: { organizationId } },
            { term: { isActive: true } }
          ]
        }
      };

      if (options.role) {
        searchQuery.bool.filter.push({ term: { role: options.role } });
      }

      const result = await this.elasticsearch.search('users', searchQuery, {
        size: options.limit || 20,
        from: options.offset || 0
      });

      return {
        success: true,
        users: result.hits,
        total: result.total,
        took: result.took
      };
    } catch (error) {
      console.error('User search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchOrders(query, organizationId, options = {}) {
    try {
      const searchQuery = {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['orderNumber^3', 'customerName^2', 'items.productName'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ],
          filter: [
            { term: { organizationId } }
          ]
        }
      };

      if (options.status) {
        searchQuery.bool.filter.push({ term: { status: options.status } });
      }

      if (options.storeId) {
        searchQuery.bool.filter.push({ term: { storeId: options.storeId } });
      }

      if (options.dateRange) {
        searchQuery.bool.filter.push({
          range: {
            createdAt: {
              gte: options.dateRange.start,
              lte: options.dateRange.end
            }
          }
        });
      }

      const result = await this.elasticsearch.search('orders', searchQuery, {
        size: options.limit || 20,
        from: options.offset || 0,
        sort: [{ createdAt: { order: 'desc' } }]
      });

      return {
        success: true,
        orders: result.hits,
        total: result.total,
        took: result.took
      };
    } catch (error) {
      console.error('Order search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getIndexingJobStatus(jobId) {
    const job = this.indexingJobs.get(jobId);
    if (!job) {
      return {
        success: false,
        error: 'Indexing job not found'
      };
    }

    return {
      success: true,
      job: {
        id: job.id,
        entityType: job.entityType,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress,
        results: job.results,
        error: job.error
      }
    };
  }

  async getAllIndexingJobs(organizationId) {
    const jobs = Array.from(this.indexingJobs.values())
      .filter(job => job.organizationId === organizationId)
      .map(job => ({
        id: job.id,
        entityType: job.entityType,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress
      }));

    return {
      success: true,
      jobs
    };
  }

  async updateDocument(entityType, id, document) {
    try {
      const result = await this.elasticsearch.updateDocument(entityType, id, document);
      return result;
    } catch (error) {
      console.error('Document update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteDocument(entityType, id) {
    try {
      const result = await this.elasticsearch.deleteDocument(entityType, id);
      return result;
    } catch (error) {
      console.error('Document deletion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SearchIndexingService;
