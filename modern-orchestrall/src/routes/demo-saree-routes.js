// src/routes/demo-saree-routes.js - Saree Demo API Routes
const { z } = require('zod');
const SareeService = require('../demo/saree/saree-service');
const authService = require('../auth');

// Validation schemas
const ingestSchema = z.object({
  productImageUrl: z.string().url('Invalid URL format'),
});

const tryOnSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  avatarSpec: z.object({
    skinTone: z.enum(['fair', 'medium', 'olive', 'tan', 'dark']).optional(),
    hair: z.enum(['long', 'short', 'bun', 'braid']).optional(),
    jewelryMinimal: z.enum(['minimal', 'traditional']).optional(),
    pose: z.enum(['front', 'side', 'threeQuarter']).optional(),
    background: z.enum(['studio', 'lifestyle']).optional(),
  }).optional(),
});

const videoSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  keyframeUrl: z.string().url().optional(),
  style: z.enum(['studioTurntable', 'runwaySubtle']).optional(),
});

const depthmapSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  imageUrl: z.string().url().optional(),
});

// Create service instance
const sareeService = new SareeService();

async function demoSareeRoutes(fastify, options) {
  // Initialize service
  await sareeService.initialize();

  // POST /demo/saree/ingest - Ingest saree product image
  fastify.post('/demo/saree/ingest', {
    schema: {
      description: 'Ingest saree product image',
      tags: ['Demo', 'Saree'],
      body: {
        type: 'object',
        required: ['productImageUrl'],
        properties: {
          productImageUrl: { type: 'string', format: 'uri' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                assetId: { type: 'string' },
                sourceUrl: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [authService.authenticateToken()],
  }, async (request, reply) => {
    try {
      const { productImageUrl } = request.body;
      const result = await sareeService.ingestSaree(productImageUrl);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      fastify.log.error('Saree ingest error', { error: error.message });
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INGEST_ERROR',
          message: error.message,
        },
      });
    }
  });

  // POST /demo/saree/tryon - Generate virtual try-on images
  fastify.post('/demo/saree/tryon', {
    schema: {
      description: 'Generate virtual try-on images',
      tags: ['Demo', 'Saree'],
      body: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
          avatarSpec: {
            type: 'object',
            properties: {
              skinTone: { type: 'string', enum: ['fair', 'medium', 'olive', 'tan', 'dark'] },
              hair: { type: 'string', enum: ['long', 'short', 'bun', 'braid'] },
              jewelryMinimal: { type: 'string', enum: ['minimal', 'traditional'] },
              pose: { type: 'string', enum: ['front', 'side', 'threeQuarter'] },
              background: { type: 'string', enum: ['studio', 'lifestyle'] },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                images: { type: 'array', items: { type: 'string' } },
                count: { type: 'number' },
              },
            },
          },
        },
      },
    },
    preHandler: [authService.authenticateToken()],
  }, async (request, reply) => {
    try {
      const { assetId, avatarSpec } = request.body;
      const result = await sareeService.generateTryOn(assetId, avatarSpec);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      fastify.log.error('Try-on generation error', { error: error.message });
      return reply.code(400).send({
        success: false,
        error: {
          code: 'TRYON_ERROR',
          message: error.message,
        },
      });
    }
  });

  // POST /demo/saree/video - Generate cinematic video
  fastify.post('/demo/saree/video', {
    schema: {
      description: 'Generate cinematic video',
      tags: ['Demo', 'Saree'],
      body: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
          keyframeUrl: { type: 'string', format: 'uri' },
          style: { type: 'string', enum: ['studioTurntable', 'runwaySubtle'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                videoUrl: { type: 'string' },
                provider: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [authService.authenticateToken()],
  }, async (request, reply) => {
    try {
      const { assetId, keyframeUrl, style } = request.body;
      const result = await sareeService.generateVideo(assetId, keyframeUrl, style);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      fastify.log.error('Video generation error', { error: error.message });
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VIDEO_ERROR',
          message: error.message,
        },
      });
    }
  });

  // POST /demo/saree/depthmap - Generate depth map and normals
  fastify.post('/demo/saree/depthmap', {
    schema: {
      description: 'Generate depth map and normals',
      tags: ['Demo', 'Saree'],
      body: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
          imageUrl: { type: 'string', format: 'uri' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                depthUrl: { type: 'string' },
                normalsUrl: { type: 'string' },
                cameraParams: { type: 'object' },
                provider: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [authService.authenticateToken()],
  }, async (request, reply) => {
    try {
      const { assetId, imageUrl } = request.body;
      const result = await sareeService.generateDepthMap(assetId, imageUrl);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      fastify.log.error('Depth map generation error', { error: error.message });
      return reply.code(400).send({
        success: false,
        error: {
          code: 'DEPTHMAP_ERROR',
          message: error.message,
        },
      });
    }
  });

  // GET /demo/saree/status/:assetId - Get asset status and URLs
  fastify.get('/demo/saree/status/:assetId', {
    schema: {
      description: 'Get asset status and URLs',
      tags: ['Demo', 'Saree'],
      params: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                assetId: { type: 'string' },
                kind: { type: 'string' },
                status: { type: 'string' },
                urls: { type: 'object' },
                meta: { type: 'object' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    preHandler: [authService.authenticateToken()],
  }, async (request, reply) => {
    try {
      const { assetId } = request.params;
      const result = await sareeService.getAssetStatus(assetId);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      fastify.log.error('Asset status error', { assetId: request.params.assetId, error: error.message });
      return reply.code(404).send({
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: error.message,
        },
      });
    }
  });

  // GET /demo/saree/embed/:assetId - Get embed HTML
  fastify.get('/demo/saree/embed/:assetId', {
    schema: {
      description: 'Get embed HTML for demo',
      tags: ['Demo', 'Saree'],
      params: {
        type: 'object',
        required: ['assetId'],
        properties: {
          assetId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'string',
        },
      },
    },
    preHandler: [authService.authenticateToken()],
  }, async (request, reply) => {
    try {
      const { assetId } = request.params;
      const html = await sareeService.generateEmbedHtml(assetId);
      
      reply.type('text/html');
      return html;
    } catch (error) {
      fastify.log.error('Embed HTML error', { assetId: request.params.assetId, error: error.message });
      return reply.code(404).send({
        success: false,
        error: {
          code: 'EMBED_ERROR',
          message: error.message,
        },
      });
    }
  });
}

module.exports = demoSareeRoutes;