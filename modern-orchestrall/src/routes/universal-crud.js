// src/routes/universal-crud.js - Universal CRUD API Routes
const { z } = require('zod');
const UniversalCRUDService = require('../core/crud/UniversalCRUDService');

// Validation schemas
const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  include: z.string().optional().transform(str => str ? str.split(',') : [])
});

const bulkCreateSchema = z.object({
  items: z.array(z.any()).min(1).max(100)
});

const bulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string(),
    data: z.any()
  })).min(1).max(50)
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(50)
});

async function universalCRUDRoutes(fastify, options) {
  const { prisma } = options;
  const crudService = new UniversalCRUDService(prisma);

  // Get all available entities
  fastify.get('/api/entities', {
    schema: {
      description: 'Get all available entities',
      tags: ['Universal CRUD'],
      response: {
        200: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  fields: { type: 'array' },
                  searchFields: { type: 'array' },
                  relations: { type: 'array' },
                  model: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const entities = crudService.getAvailableEntities();
      return { entities };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to get entities' });
    }
  });

  // Get entity schema
  fastify.get('/api/entities/:entityName/schema', {
    schema: {
      description: 'Get entity schema',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const schema = crudService.getEntitySchema(entityName);
      return { schema };
    } catch (error) {
      fastify.log.error(error);
      reply.code(404).send({ error: error.message });
    }
  });

  // GET /api/:entityName - Get all entities with pagination and filtering
  fastify.get('/api/:entityName', {
    schema: {
      description: 'Get all entities with pagination and filtering',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', default: '1' },
          limit: { type: 'string', default: '20' },
          sortBy: { type: 'string', default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          search: { type: 'string' },
          include: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const organizationId = request.user.organizationId;
      
      // Parse query parameters
      const queryParams = paginationSchema.parse(request.query);
      
      // Parse filters from query string
      const filters = {};
      Object.keys(request.query).forEach(key => {
        if (!['page', 'limit', 'sortBy', 'sortOrder', 'search', 'include'].includes(key)) {
          filters[key] = request.query[key];
        }
      });

      const result = await crudService.getAll(entityName, organizationId, {
        ...queryParams,
        filters
      });

      return result;
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to get entities' });
      }
    }
  });

  // GET /api/:entityName/:id - Get single entity by ID
  fastify.get('/api/:entityName/:id', {
    schema: {
      description: 'Get single entity by ID',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['entityName', 'id']
      },
      querystring: {
        type: 'object',
        properties: {
          include: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName, id } = request.params;
      const organizationId = request.user.organizationId;
      const include = request.query.include ? request.query.include.split(',') : [];

      const entity = await crudService.getById(entityName, id, organizationId, include);
      return entity;
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to get entity' });
      }
    }
  });

  // POST /api/:entityName - Create new entity
  fastify.post('/api/:entityName', {
    schema: {
      description: 'Create new entity',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      },
      body: {
        type: 'object'
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const organizationId = request.user.organizationId;
      const data = request.body;

      // Validate entity data
      crudService.validateEntityData(entityName, data, 'create');

      const entity = await crudService.create(entityName, data, organizationId);
      reply.code(201).send(entity);
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('Validation errors')) {
        reply.code(400).send({ error: error.message });
      } else if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to create entity' });
      }
    }
  });

  // PUT /api/:entityName/:id - Update entity
  fastify.put('/api/:entityName/:id', {
    schema: {
      description: 'Update entity',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['entityName', 'id']
      },
      body: {
        type: 'object'
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName, id } = request.params;
      const organizationId = request.user.organizationId;
      const data = request.body;

      // Validate entity data
      crudService.validateEntityData(entityName, data, 'update');

      const entity = await crudService.update(entityName, id, data, organizationId);
      return entity;
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('Validation errors')) {
        reply.code(400).send({ error: error.message });
      } else if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to update entity' });
      }
    }
  });

  // DELETE /api/:entityName/:id - Delete entity
  fastify.delete('/api/:entityName/:id', {
    schema: {
      description: 'Delete entity',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['entityName', 'id']
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName, id } = request.params;
      const organizationId = request.user.organizationId;

      const result = await crudService.delete(entityName, id, organizationId);
      return result;
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to delete entity' });
      }
    }
  });

  // POST /api/:entityName/bulk - Bulk create entities
  fastify.post('/api/:entityName/bulk', {
    schema: {
      description: 'Bulk create entities',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      },
      body: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object' },
            minItems: 1,
            maxItems: 100
          }
        },
        required: ['items']
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const organizationId = request.user.organizationId;
      const { items } = request.body;

      const result = await crudService.bulkCreate(entityName, items, organizationId);
      reply.code(201).send(result);
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to bulk create entities' });
      }
    }
  });

  // PUT /api/:entityName/bulk - Bulk update entities
  fastify.put('/api/:entityName/bulk', {
    schema: {
      description: 'Bulk update entities',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      },
      body: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                data: { type: 'object' }
              },
              required: ['id', 'data']
            },
            minItems: 1,
            maxItems: 50
          }
        },
        required: ['updates']
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const organizationId = request.user.organizationId;
      const { updates } = request.body;

      const result = await crudService.bulkUpdate(entityName, updates, organizationId);
      return result;
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to bulk update entities' });
      }
    }
  });

  // DELETE /api/:entityName/bulk - Bulk delete entities
  fastify.delete('/api/:entityName/bulk', {
    schema: {
      description: 'Bulk delete entities',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      },
      body: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 50
          }
        },
        required: ['ids']
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const organizationId = request.user.organizationId;
      const { ids } = request.body;

      const result = await crudService.bulkDelete(entityName, ids, organizationId);
      return result;
    } catch (error) {
      fastify.log.error(error);
      if (error.message.includes('not found')) {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to bulk delete entities' });
      }
    }
  });

  // GET /api/:entityName/stats - Get entity statistics
  fastify.get('/api/:entityName/stats', {
    schema: {
      description: 'Get entity statistics',
      tags: ['Universal CRUD'],
      params: {
        type: 'object',
        properties: {
          entityName: { type: 'string' }
        },
        required: ['entityName']
      }
    }
  }, async (request, reply) => {
    try {
      const { entityName } = request.params;
      const organizationId = request.user.organizationId;
      const entityConfig = crudService.entities[entityName];
      
      if (!entityConfig) {
        reply.code(404).send({ error: `Entity ${entityName} not found` });
        return;
      }

      // Get basic stats
      const total = await prisma[entityConfig.model].count({
        where: { organizationId }
      });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recent = await prisma[entityConfig.model].count({
        where: {
          organizationId,
          createdAt: { gte: thirtyDaysAgo }
        }
      });

      return {
        total,
        recent,
        entityName,
        organizationId
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to get entity statistics' });
    }
  });
}

module.exports = universalCRUDRoutes;
