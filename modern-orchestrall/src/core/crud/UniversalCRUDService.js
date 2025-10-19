// src/core/crud/UniversalCRUDService.js - Universal CRUD API Service
const logger = require('../../utils/logger');

class UniversalCRUDService {
  constructor(prisma) {
    this.prisma = prisma;
    this.logger = logger;
    
    // Define entity configurations
    this.entities = {
      // Core entities
      organizations: {
        model: 'organization',
        fields: ['id', 'name', 'slug', 'tier', 'status', 'createdAt', 'updatedAt'],
        searchFields: ['name', 'slug'],
        relations: ['users', 'teams', 'products', 'orders']
      },
      users: {
        model: 'user',
        fields: ['id', 'email', 'name', 'avatar', 'status', 'lastLoginAt', 'createdAt', 'updatedAt'],
        searchFields: ['email', 'name'],
        relations: ['organization', 'teams', 'apiKeys']
      },
      teams: {
        model: 'team',
        fields: ['id', 'name', 'description', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['name', 'description'],
        relations: ['organization', 'members', 'workflows', 'agents']
      },
      
      // Retail entities
      products: {
        model: 'product',
        fields: ['id', 'name', 'description', 'price', 'sku', 'attributes', 'metadata', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['name', 'description', 'sku'],
        relations: ['organization', 'inventoryItems', 'orderItems']
      },
      orders: {
        model: 'order',
        fields: ['id', 'orderNumber', 'status', 'totalAmount', 'customerId', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['orderNumber'],
        relations: ['organization', 'customer', 'items', 'paymentIntents']
      },
      customers: {
        model: 'customer',
        fields: ['id', 'name', 'email', 'phone', 'address', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['name', 'email', 'phone'],
        relations: ['organization', 'orders']
      },
      
      // Client-specific entities
      stories: {
        model: 'story',
        fields: ['id', 'title', 'content', 'status', 'publishedAt', 'views', 'likes', 'authorId', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['title', 'content'],
        relations: ['author', 'organization', 'template', 'media', 'analytics']
      },
      crops: {
        model: 'crop',
        fields: ['id', 'name', 'variety', 'plantingDate', 'harvestDate', 'yield', 'status', 'farmerId', 'createdAt', 'updatedAt'],
        searchFields: ['name', 'variety'],
        relations: ['farmer']
      },
      stores: {
        model: 'store',
        fields: ['id', 'name', 'address', 'city', 'state', 'pincode', 'managerId', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['name', 'address', 'city'],
        relations: ['organization', 'manager', 'inventory', 'transfers']
      },
      voiceCalls: {
        model: 'voiceCall',
        fields: ['id', 'sessionId', 'language', 'duration', 'status', 'transcript', 'farmerId', 'organizationId', 'createdAt', 'updatedAt'],
        searchFields: ['sessionId', 'transcript'],
        relations: ['farmer', 'organization', 'analytics']
      }
    };
  }

  // Get all entities for a given model
  async getAll(entityName, organizationId, options = {}) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = '',
        filters = {},
        include = []
      } = options;

      // Build where clause
      const where = { organizationId };
      
      // Add search
      if (search && entityConfig.searchFields.length > 0) {
        where.OR = entityConfig.searchFields.map(field => ({
          [field]: { contains: search, mode: 'insensitive' }
        }));
      }

      // Add filters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          where[key] = filters[key];
        }
      });

      // Build include clause
      const includeClause = {};
      if (include.length > 0) {
        include.forEach(relation => {
          if (entityConfig.relations.includes(relation)) {
            includeClause[relation] = true;
          }
        });
      }

      // Execute query
      const [data, total] = await Promise.all([
        this.prisma[entityConfig.model].findMany({
          where,
          include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma[entityConfig.model].count({ where })
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          search,
          sortBy,
          sortOrder,
          appliedFilters: filters
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get all ${entityName}: ${error.message}`);
      throw error;
    }
  }

  // Get single entity by ID
  async getById(entityName, id, organizationId, include = []) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      const includeClause = {};
      if (include.length > 0) {
        include.forEach(relation => {
          if (entityConfig.relations.includes(relation)) {
            includeClause[relation] = true;
          }
        });
      }

      const entity = await this.prisma[entityConfig.model].findFirst({
        where: { id, organizationId },
        include: Object.keys(includeClause).length > 0 ? includeClause : undefined
      });

      if (!entity) {
        throw new Error(`${entityName} not found`);
      }

      return entity;
    } catch (error) {
      this.logger.error(`Failed to get ${entityName} by ID: ${error.message}`);
      throw error;
    }
  }

  // Create new entity
  async create(entityName, data, organizationId) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      // Add organizationId to data
      const createData = {
        ...data,
        organizationId
      };

      // Remove fields that shouldn't be set during creation
      delete createData.id;
      delete createData.createdAt;
      delete createData.updatedAt;

      const entity = await this.prisma[entityConfig.model].create({
        data: createData
      });

      this.logger.info(`${entityName} created: ${entity.id}`);
      return entity;
    } catch (error) {
      this.logger.error(`Failed to create ${entityName}: ${error.message}`);
      throw error;
    }
  }

  // Update entity
  async update(entityName, id, data, organizationId) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      // Check if entity exists and belongs to organization
      const existingEntity = await this.prisma[entityConfig.model].findFirst({
        where: { id, organizationId }
      });

      if (!existingEntity) {
        throw new Error(`${entityName} not found`);
      }

      // Remove fields that shouldn't be updated
      const updateData = { ...data };
      delete updateData.id;
      delete updateData.organizationId;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const entity = await this.prisma[entityConfig.model].update({
        where: { id },
        data: updateData
      });

      this.logger.info(`${entityName} updated: ${id}`);
      return entity;
    } catch (error) {
      this.logger.error(`Failed to update ${entityName}: ${error.message}`);
      throw error;
    }
  }

  // Delete entity
  async delete(entityName, id, organizationId) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      // Check if entity exists and belongs to organization
      const existingEntity = await this.prisma[entityConfig.model].findFirst({
        where: { id, organizationId }
      });

      if (!existingEntity) {
        throw new Error(`${entityName} not found`);
      }

      await this.prisma[entityConfig.model].delete({
        where: { id }
      });

      this.logger.info(`${entityName} deleted: ${id}`);
      return { success: true, message: `${entityName} deleted successfully` };
    } catch (error) {
      this.logger.error(`Failed to delete ${entityName}: ${error.message}`);
      throw error;
    }
  }

  // Bulk operations
  async bulkCreate(entityName, items, organizationId) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      const createData = items.map(item => ({
        ...item,
        organizationId
      }));

      const entities = await this.prisma[entityConfig.model].createMany({
        data: createData,
        skipDuplicates: true
      });

      this.logger.info(`${entities.count} ${entityName} created in bulk`);
      return { success: true, count: entities.count };
    } catch (error) {
      this.logger.error(`Failed to bulk create ${entityName}: ${error.message}`);
      throw error;
    }
  }

  async bulkUpdate(entityName, updates, organizationId) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      const results = [];
      for (const update of updates) {
        const { id, ...data } = update;
        const result = await this.update(entityName, id, data, organizationId);
        results.push(result);
      }

      this.logger.info(`${results.length} ${entityName} updated in bulk`);
      return { success: true, count: results.length, results };
    } catch (error) {
      this.logger.error(`Failed to bulk update ${entityName}: ${error.message}`);
      throw error;
    }
  }

  async bulkDelete(entityName, ids, organizationId) {
    try {
      const entityConfig = this.entities[entityName];
      if (!entityConfig) {
        throw new Error(`Entity ${entityName} not found`);
      }

      const result = await this.prisma[entityConfig.model].deleteMany({
        where: {
          id: { in: ids },
          organizationId
        }
      });

      this.logger.info(`${result.count} ${entityName} deleted in bulk`);
      return { success: true, count: result.count };
    } catch (error) {
      this.logger.error(`Failed to bulk delete ${entityName}: ${error.message}`);
      throw error;
    }
  }

  // Get entity schema for frontend
  getEntitySchema(entityName) {
    const entityConfig = this.entities[entityName];
    if (!entityConfig) {
      throw new Error(`Entity ${entityName} not found`);
    }

    return {
      name: entityName,
      fields: entityConfig.fields,
      searchFields: entityConfig.searchFields,
      relations: entityConfig.relations,
      model: entityConfig.model
    };
  }

  // Get all available entities
  getAvailableEntities() {
    return Object.keys(this.entities).map(name => ({
      name,
      ...this.getEntitySchema(name)
    }));
  }

  // Validate entity data
  validateEntityData(entityName, data, operation = 'create') {
    const entityConfig = this.entities[entityName];
    if (!entityConfig) {
      throw new Error(`Entity ${entityName} not found`);
    }

    const errors = [];
    const requiredFields = entityConfig.fields.filter(field => 
      !['id', 'createdAt', 'updatedAt'].includes(field)
    );

    // Check required fields for create operation
    if (operation === 'create') {
      requiredFields.forEach(field => {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          errors.push(`${field} is required`);
        }
      });
    }

    // Validate field types and constraints
    Object.keys(data).forEach(field => {
      if (!entityConfig.fields.includes(field)) {
        errors.push(`Unknown field: ${field}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }

    return true;
  }
}

module.exports = UniversalCRUDService;
