const fastifySwagger = require('@fastify/swagger');
const fastifySwaggerUi = require('@fastify/swagger-ui');
const { PrismaClient } = require('@prisma/client');

class APIDocumentationService {
  constructor(app, prisma) {
    this.app = app;
    this.prisma = prisma;
    this.isInitialized = false;
    this.apiSpec = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Generate OpenAPI specification
      await this.generateOpenAPISpec();
      
      // Register Swagger plugins
      await this.registerSwaggerPlugins();
      
      // Create API explorer routes
      await this.createAPIExplorerRoutes();
      
      // Create developer portal
      await this.createDeveloperPortal();
      
      this.isInitialized = true;
      console.log('✅ API Documentation Service initialized');
    } catch (error) {
      console.error('Failed to initialize API Documentation Service:', error);
      throw error;
    }
  }

  async generateOpenAPISpec() {
    this.apiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Modern Orchestrall Platform API',
        description: 'Comprehensive API for agricultural technology platform with voice integration, multi-tenancy, and advanced analytics',
        version: '2.0.0',
        contact: {
          name: 'API Support',
          email: 'support@orchestrall.com',
          url: 'https://orchestrall.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        },
        {
          url: 'https://api.orchestrall.com',
          description: 'Production server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              code: { type: 'string' }
            }
          },
          Success: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              message: { type: 'string' }
            }
          },
          Pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              hasMore: { type: 'boolean' }
            }
          },
          // Agricultural Models
          FarmerProfile: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' },
              region: { type: 'string' },
              landSize: { type: 'number' },
              organizationId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          Crop: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              plantingDate: { type: 'string', format: 'date' },
              expectedHarvestDate: { type: 'string', format: 'date' },
              status: { type: 'string', enum: ['planted', 'growing', 'harvested', 'failed'] },
              farmerId: { type: 'string' },
              organizationId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          CropHealthRecord: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              cropId: { type: 'string' },
              healthScore: { type: 'number', minimum: 0, maximum: 100 },
              diseaseDetected: { type: 'boolean' },
              pestDetected: { type: 'boolean' },
              notes: { type: 'string' },
              recordedAt: { type: 'string', format: 'date-time' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          // Voice Models
          VoiceCall: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sessionId: { type: 'string' },
              farmerId: { type: 'string' },
              organizationId: { type: 'string' },
              language: { type: 'string', enum: ['hi', 'te', 'ta', 'en'] },
              duration: { type: 'integer' },
              status: { type: 'string', enum: ['processing', 'completed', 'failed'] },
              transcription: { type: 'string' },
              command: { type: 'string' },
              response: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          // Payment Models
          Payment: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              amount: { type: 'number' },
              currency: { type: 'string', default: 'INR' },
              status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
              paymentMethod: { type: 'string' },
              farmerId: { type: 'string' },
              organizationId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          },
          // Multi-tenancy Models
          Organization: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              tier: { type: 'string', enum: ['starter', 'professional', 'enterprise'] },
              status: { type: 'string', enum: ['active', 'suspended', 'cancelled'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          },
          // Backup Models
          BackupRecord: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['full', 'incremental', 'tenant'] },
              status: { type: 'string', enum: ['in_progress', 'completed', 'failed'] },
              startTime: { type: 'string', format: 'date-time' },
              endTime: { type: 'string', format: 'date-time' },
              size: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        }
      },
      paths: {}
    };

    // Add API paths
    await this.addAPIPaths();
    
    console.log('✅ OpenAPI specification generated');
  }

  async addAPIPaths() {
    // Health Check endpoints
    this.apiSpec.paths['/health'] = {
      get: {
        tags: ['System'],
        summary: 'System Health Check',
        description: 'Check the overall health of the system',
        responses: {
          200: {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string' },
                    uptime: { type: 'number' },
                    environment: { type: 'string' },
                    database: { type: 'string' },
                    dashboard: { type: 'string' }
                  }
                }
              }
            }
          },
          503: {
            description: 'System is unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    };

    // Voice API endpoints
    this.apiSpec.paths['/api/voice/process'] = {
      post: {
        tags: ['Voice'],
        summary: 'Process Voice Input',
        description: 'Process voice input and return response',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['audioData', 'farmerId'],
                properties: {
                  audioData: { type: 'string', description: 'Base64 encoded audio data' },
                  farmerId: { type: 'string', description: 'ID of the farmer' },
                  language: { type: 'string', enum: ['hi', 'te', 'ta', 'en'], default: 'hi' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Voice processed successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            sessionId: { type: 'string' },
                            transcription: { type: 'string' },
                            command: { type: 'string' },
                            response: { type: 'string' },
                            audioResponse: { type: 'object' },
                            language: { type: 'string' },
                            duration: { type: 'integer' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    };

    // Agricultural API endpoints
    this.apiSpec.paths['/api/agricultural/farmers'] = {
      get: {
        tags: ['Agricultural'],
        summary: 'Get Farmers',
        description: 'Retrieve list of farmers with pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Organization ID to filter farmers'
          },
          {
            name: 'region',
            in: 'query',
            schema: { type: 'string' },
            description: 'Region to filter farmers'
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
            description: 'Number of farmers to return'
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: 'Number of farmers to skip'
          }
        ],
        responses: {
          200: {
            description: 'Farmers retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/FarmerProfile' }
                        },
                        pagination: { $ref: '#/components/schemas/Pagination' }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Agricultural'],
        summary: 'Create Farmer',
        description: 'Create a new farmer profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'region', 'organizationId'],
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  region: { type: 'string' },
                  landSize: { type: 'number' },
                  organizationId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Farmer created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/FarmerProfile' }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    };

    // Multi-tenancy API endpoints
    this.apiSpec.paths['/api/tenants'] = {
      get: {
        tags: ['Multi-tenancy'],
        summary: 'Get Tenants',
        description: 'Retrieve list of all tenants',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Tenants retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Organization' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Multi-tenancy'],
        summary: 'Create Tenant',
        description: 'Create a new tenant organization',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  tier: { type: 'string', enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
                  customConfig: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Tenant created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Organization' }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    };

    // Backup API endpoints
    this.apiSpec.paths['/api/backup/full'] = {
      post: {
        tags: ['Backup & Recovery'],
        summary: 'Create Full Backup',
        description: 'Create a full system backup',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  options: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Full backup created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            backupId: { type: 'string' },
                            path: { type: 'string' },
                            size: { type: 'integer' },
                            manifest: { type: 'object' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    };

    // Observability API endpoints
    this.apiSpec.paths['/api/observability/health'] = {
      get: {
        tags: ['Observability'],
        summary: 'System Health Status',
        description: 'Get detailed system health information',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Organization ID for tenant-specific health'
          }
        ],
        responses: {
          200: {
            description: 'Health status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Success' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            timestamp: { type: 'string', format: 'date-time' },
                            status: { type: 'string', enum: ['healthy', 'warning', 'critical'] },
                            metrics: { type: 'object' },
                            alerts: { type: 'array' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    };

    // Metrics endpoint
    this.apiSpec.paths['/metrics'] = {
      get: {
        tags: ['Observability'],
        summary: 'Prometheus Metrics',
        description: 'Get Prometheus-formatted metrics',
        responses: {
          200: {
            description: 'Metrics in Prometheus format',
            content: {
              'text/plain': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    };
  }

  async registerSwaggerPlugins() {
    // Register Swagger plugin
    await this.app.register(fastifySwagger, {
      openapi: this.apiSpec
    });

    // Register Swagger UI plugin
    await this.app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        }
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request, reply) => {
        return swaggerObject;
      },
      transformSpecificationClone: true
    });

    console.log('✅ Swagger plugins registered');
  }

  async createAPIExplorerRoutes() {
    // API Explorer main page
    this.app.get('/api/explorer', async (request, reply) => {
      const explorerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Explorer - Modern Orchestrall Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header h1 { color: #2c3e50; margin-bottom: 10px; }
        .header p { color: #7f8c8d; font-size: 16px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .card:hover { transform: translateY(-2px); }
        .card h3 { color: #2c3e50; margin-bottom: 15px; font-size: 18px; }
        .card p { color: #7f8c8d; margin-bottom: 15px; line-height: 1.6; }
        .endpoints { list-style: none; }
        .endpoints li { margin-bottom: 8px; }
        .endpoints a { color: #3498db; text-decoration: none; font-weight: 500; }
        .endpoints a:hover { text-decoration: underline; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-left: 8px; }
        .badge.get { background: #e8f5e8; color: #27ae60; }
        .badge.post { background: #e3f2fd; color: #1976d2; }
        .badge.put { background: #fff3e0; color: #f57c00; }
        .badge.delete { background: #ffebee; color: #d32f2f; }
        .quick-links { background: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .quick-links h2 { color: #2c3e50; margin-bottom: 15px; }
        .quick-links ul { list-style: none; }
        .quick-links li { margin-bottom: 10px; }
        .quick-links a { color: #3498db; text-decoration: none; font-weight: 500; }
        .quick-links a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 API Explorer</h1>
            <p>Explore the Modern Orchestrall Platform API endpoints and test them interactively</p>
        </div>

        <div class="quick-links">
            <h2>Quick Links</h2>
            <ul>
                <li><a href="/docs" target="_blank">📚 Interactive API Documentation (Swagger UI)</a></li>
                <li><a href="/api/spec" target="_blank">📋 OpenAPI Specification (JSON)</a></li>
                <li><a href="/health" target="_blank">💚 System Health Check</a></li>
                <li><a href="/metrics" target="_blank">📊 Prometheus Metrics</a></li>
            </ul>
        </div>

        <div class="grid">
            <div class="card">
                <h3>🌾 Agricultural APIs</h3>
                <p>Manage farmers, crops, and agricultural data</p>
                <ul class="endpoints">
                    <li><a href="/docs#/Agricultural/get_api_agricultural_farmers">GET /api/agricultural/farmers</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Agricultural/post_api_agricultural_farmers">POST /api/agricultural/farmers</a> <span class="badge post">POST</span></li>
                    <li><a href="/docs#/Agricultural/get_api_agricultural_crops">GET /api/agricultural/crops</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Agricultural/post_api_agricultural_crops">POST /api/agricultural/crops</a> <span class="badge post">POST</span></li>
                </ul>
            </div>

            <div class="card">
                <h3>🎤 Voice APIs</h3>
                <p>Voice processing and multilingual support</p>
                <ul class="endpoints">
                    <li><a href="/docs#/Voice/post_api_voice_process">POST /api/voice/process</a> <span class="badge post">POST</span></li>
                    <li><a href="/docs#/Voice/get_api_voice_languages">GET /api/voice/languages</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Voice/get_api_voice_analytics">GET /api/voice/analytics</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Voice/get_api_voice_history__farmerId_">GET /api/voice/history/:farmerId</a> <span class="badge get">GET</span></li>
                </ul>
            </div>

            <div class="card">
                <h3>🏢 Multi-tenancy APIs</h3>
                <p>Tenant management and data isolation</p>
                <ul class="endpoints">
                    <li><a href="/docs#/Multi-tenancy/get_api_tenants">GET /api/tenants</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Multi-tenancy/post_api_tenants">POST /api/tenants</a> <span class="badge post">POST</span></li>
                    <li><a href="/docs#/Multi-tenancy/get_api_tenants__tenantId_">GET /api/tenants/:tenantId</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Multi-tenancy/post_api_tenants__tenantId__migrate">POST /api/tenants/:tenantId/migrate</a> <span class="badge post">POST</span></li>
                </ul>
            </div>

            <div class="card">
                <h3>💾 Backup & Recovery APIs</h3>
                <p>System backup and disaster recovery</p>
                <ul class="endpoints">
                    <li><a href="/docs#/Backup & Recovery/post_api_backup_full">POST /api/backup/full</a> <span class="badge post">POST</span></li>
                    <li><a href="/docs#/Backup & Recovery/post_api_backup_incremental">POST /api/backup/incremental</a> <span class="badge post">POST</span></li>
                    <li><a href="/docs#/Backup & Recovery/post_api_restore__backupId_">POST /api/restore/:backupId</a> <span class="badge post">POST</span></li>
                    <li><a href="/docs#/Backup & Recovery/get_api_backup_health">GET /api/backup/health</a> <span class="badge get">GET</span></li>
                </ul>
            </div>

            <div class="card">
                <h3>📊 Observability APIs</h3>
                <p>System monitoring and analytics</p>
                <ul class="endpoints">
                    <li><a href="/docs#/Observability/get_api_observability_health">GET /api/observability/health</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Observability/get_api_observability_metrics">GET /api/observability/metrics</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Observability/get_api_observability_performance">GET /api/observability/performance</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Observability/get_api_observability_alerts">GET /api/observability/alerts</a> <span class="badge get">GET</span></li>
                </ul>
            </div>

            <div class="card">
                <h3>🔧 System APIs</h3>
                <p>System health and configuration</p>
                <ul class="endpoints">
                    <li><a href="/docs#/System/get_health">GET /health</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/Observability/get_metrics">GET /metrics</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/System/get_health_database">GET /health/database</a> <span class="badge get">GET</span></li>
                    <li><a href="/docs#/System/get_health_redis">GET /health/redis</a> <span class="badge get">GET</span></li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      reply.type('text/html').send(explorerHtml);
    });

    // OpenAPI specification endpoint
    this.app.get('/api/spec', async (request, reply) => {
      reply.send(this.apiSpec);
    });

    console.log('✅ API Explorer routes created');
  }

  async createDeveloperPortal() {
    // Developer Portal main page
    this.app.get('/developer', async (request, reply) => {
      const portalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Developer Portal - Modern Orchestrall Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: rgba(255,255,255,0.95); padding: 40px; border-radius: 15px; margin-bottom: 30px; backdrop-filter: blur(10px); }
        .header h1 { color: #2c3e50; margin-bottom: 15px; font-size: 2.5em; }
        .header p { color: #7f8c8d; font-size: 18px; line-height: 1.6; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; }
        .card { background: rgba(255,255,255,0.95); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px); transition: all 0.3s; }
        .card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .card h3 { color: #2c3e50; margin-bottom: 20px; font-size: 20px; }
        .card p { color: #7f8c8d; margin-bottom: 20px; line-height: 1.6; }
        .features { list-style: none; }
        .features li { margin-bottom: 10px; padding-left: 25px; position: relative; }
        .features li:before { content: "✓"; position: absolute; left: 0; color: #27ae60; font-weight: bold; }
        .code-block { background: #2c3e50; color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 15px 0; font-family: 'Courier New', monospace; overflow-x: auto; }
        .btn { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; transition: background 0.3s; }
        .btn:hover { background: #2980b9; }
        .btn.secondary { background: #95a5a6; }
        .btn.secondary:hover { background: #7f8c8d; }
        .section { margin-bottom: 40px; }
        .section h2 { color: white; margin-bottom: 20px; font-size: 1.8em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛠️ Developer Portal</h1>
            <p>Everything you need to integrate with the Modern Orchestrall Platform API</p>
        </div>

        <div class="section">
            <h2>🚀 Getting Started</h2>
            <div class="grid">
                <div class="card">
                    <h3>📚 API Documentation</h3>
                    <p>Comprehensive API documentation with interactive examples</p>
                    <ul class="features">
                        <li>OpenAPI 3.0 specification</li>
                        <li>Interactive Swagger UI</li>
                        <li>Code examples in multiple languages</li>
                        <li>Request/response schemas</li>
                    </ul>
                    <a href="/docs" class="btn" target="_blank">View Documentation</a>
                </div>

                <div class="card">
                    <h3>🔑 Authentication</h3>
                    <p>Secure API access with JWT tokens and API keys</p>
                    <div class="code-block">
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     -H "Content-Type: application/json" \\
     https://api.orchestrall.com/api/agricultural/farmers
                    </div>
                    <a href="/docs#/Authentication" class="btn secondary">Authentication Guide</a>
                </div>

                <div class="card">
                    <h3>🧪 API Testing</h3>
                    <p>Test API endpoints with our interactive explorer</p>
                    <ul class="features">
                        <li>Live endpoint testing</li>
                        <li>Request/response inspection</li>
                        <li>Error handling examples</li>
                        <li>Rate limiting information</li>
                    </ul>
                    <a href="/api/explorer" class="btn">API Explorer</a>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🌾 Core Features</h2>
            <div class="grid">
                <div class="card">
                    <h3>Agricultural Management</h3>
                    <p>Complete farmer and crop management system</p>
                    <ul class="features">
                        <li>Farmer profile management</li>
                        <li>Crop monitoring and health tracking</li>
                        <li>Weather integration</li>
                        <li>Market intelligence</li>
                        <li>Financial services integration</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>Voice Integration</h3>
                    <p>Multilingual voice processing for accessibility</p>
                    <ul class="features">
                        <li>Hindi, Telugu, Tamil, English support</li>
                        <li>Voice-to-text processing</li>
                        <li>Text-to-speech responses</li>
                        <li>Call analytics and insights</li>
                        <li>Command recognition</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>Multi-tenancy</h3>
                    <p>Scalable multi-tenant architecture</p>
                    <ul class="features">
                        <li>Tenant isolation (schema/database/table)</li>
                        <li>Custom configurations per tenant</li>
                        <li>Usage tracking and limits</li>
                        <li>Tenant migration support</li>
                        <li>Analytics per tenant</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>Backup & Recovery</h3>
                    <p>Enterprise-grade data protection</p>
                    <ul class="features">
                        <li>Automated full and incremental backups</li>
                        <li>Tenant-specific backups</li>
                        <li>Point-in-time recovery</li>
                        <li>Data integrity verification</li>
                        <li>Disaster recovery procedures</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>Observability</h3>
                    <p>Comprehensive system monitoring</p>
                    <ul class="features">
                        <li>Prometheus metrics</li>
                        <li>Grafana dashboards</li>
                        <li>Real-time alerting</li>
                        <li>Performance monitoring</li>
                        <li>Business analytics</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>Real-time Features</h3>
                    <p>Live updates and notifications</p>
                    <ul class="features">
                        <li>WebSocket connections</li>
                        <li>Server-Sent Events (SSE)</li>
                        <li>Push notifications</li>
                        <li>Email and SMS alerts</li>
                        <li>Live dashboard updates</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📖 Integration Examples</h2>
            <div class="grid">
                <div class="card">
                    <h3>JavaScript/Node.js</h3>
                    <div class="code-block">
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://api.orchestrall.com',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
});

// Get farmers
const farmers = await api.get('/api/agricultural/farmers');

// Create a farmer
const newFarmer = await api.post('/api/agricultural/farmers', {
  name: 'John Doe',
  phone: '+1234567890',
  region: 'North',
  organizationId: 'org_123'
});
                    </div>
                </div>

                <div class="card">
                    <h3>Python</h3>
                    <div class="code-block">
import requests

headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
}

# Get farmers
response = requests.get(
    'https://api.orchestrall.com/api/agricultural/farmers',
    headers=headers
)

farmers = response.json()

# Create a farmer
new_farmer = requests.post(
    'https://api.orchestrall.com/api/agricultural/farmers',
    headers=headers,
    json={
        'name': 'John Doe',
        'phone': '+1234567890',
        'region': 'North',
        'organizationId': 'org_123'
    }
)
                    </div>
                </div>

                <div class="card">
                    <h3>cURL</h3>
                    <div class="code-block">
# Get farmers
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     -H "Content-Type: application/json" \\
     https://api.orchestrall.com/api/agricultural/farmers

# Create a farmer
curl -X POST \\
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     -H "Content-Type: application/json" \\
     -d '{"name":"John Doe","phone":"+1234567890","region":"North","organizationId":"org_123"}' \\
     https://api.orchestrall.com/api/agricultural/farmers
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔗 Resources</h2>
            <div class="grid">
                <div class="card">
                    <h3>📋 API Reference</h3>
                    <p>Complete API reference with all endpoints</p>
                    <a href="/docs" class="btn" target="_blank">OpenAPI Docs</a>
                </div>

                <div class="card">
                    <h3>📊 Status & Health</h3>
                    <p>Check system status and health metrics</p>
                    <a href="/health" class="btn secondary" target="_blank">System Health</a>
                </div>

                <div class="card">
                    <h3>📈 Metrics</h3>
                    <p>Prometheus metrics for monitoring</p>
                    <a href="/metrics" class="btn secondary" target="_blank">View Metrics</a>
                </div>

                <div class="card">
                    <h3>💬 Support</h3>
                    <p>Get help and support for API integration</p>
                    <ul class="features">
                        <li>Email: support@orchestrall.com</li>
                        <li>Documentation: /docs</li>
                        <li>Status Page: /health</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
      
      reply.type('text/html').send(portalHtml);
    });

    console.log('✅ Developer Portal created');
  }

  // API documentation management methods
  async getAPISpec() {
    return this.apiSpec;
  }

  async updateAPISpec(updates) {
    try {
      // Merge updates into existing spec
      Object.assign(this.apiSpec, updates);
      
      // Regenerate Swagger documentation
      await this.registerSwaggerPlugins();
      
      console.log('✅ API specification updated');
    } catch (error) {
      console.error('Failed to update API specification:', error);
      throw error;
    }
  }

  async addCustomEndpoint(endpoint) {
    try {
      const { path, method, spec } = endpoint;
      
      if (!this.apiSpec.paths[path]) {
        this.apiSpec.paths[path] = {};
      }
      
      this.apiSpec.paths[path][method.toLowerCase()] = spec;
      
      // Regenerate Swagger documentation
      await this.registerSwaggerPlugins();
      
      console.log(`✅ Custom endpoint added: ${method.toUpperCase()} ${path}`);
    } catch (error) {
      console.error('Failed to add custom endpoint:', error);
      throw error;
    }
  }

  async generateClientSDK(language) {
    try {
      const sdks = {
        javascript: this.generateJavaScriptSDK(),
        python: this.generatePythonSDK(),
        java: this.generateJavaSDK(),
        csharp: this.generateCSharpSDK()
      };

      return sdks[language] || null;
    } catch (error) {
      console.error(`Failed to generate ${language} SDK:`, error);
      throw error;
    }
  }

  generateJavaScriptSDK() {
    return `
// Modern Orchestrall Platform JavaScript SDK
class OrchestrallAPI {
  constructor(baseURL = 'https://api.orchestrall.com', token = null) {
    this.baseURL = baseURL;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, endpoint, data = null) {
    const url = \`\${this.baseURL}\${endpoint}\`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': \`Bearer \${this.token}\` })
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    return response.json();
  }

  // Agricultural APIs
  async getFarmers(organizationId = null, region = null) {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    if (region) params.append('region', region);
    
    return this.request('GET', \`/api/agricultural/farmers?\${params}\`);
  }

  async createFarmer(farmerData) {
    return this.request('POST', '/api/agricultural/farmers', farmerData);
  }

  // Voice APIs
  async processVoice(audioData, farmerId, language = 'hi') {
    return this.request('POST', '/api/voice/process', {
      audioData,
      farmerId,
      language
    });
  }

  // Multi-tenancy APIs
  async getTenants() {
    return this.request('GET', '/api/tenants');
  }

  async createTenant(tenantData) {
    return this.request('POST', '/api/tenants', tenantData);
  }

  // Backup APIs
  async createFullBackup(options = {}) {
    return this.request('POST', '/api/backup/full', { options });
  }

  async restoreFromBackup(backupId, options = {}) {
    return this.request('POST', \`/api/restore/\${backupId}\`, options);
  }

  // Observability APIs
  async getSystemHealth(organizationId = null) {
    const params = organizationId ? \`?organizationId=\${organizationId}\` : '';
    return this.request('GET', \`/api/observability/health\${params}\`);
  }
}

// Usage example
const api = new OrchestrallAPI('https://api.orchestrall.com', 'your-jwt-token');

// Get farmers
const farmers = await api.getFarmers('org_123');

// Process voice input
const voiceResult = await api.processVoice('base64-audio-data', 'farmer_123', 'hi');
`;
  }

  generatePythonSDK() {
    return `
# Modern Orchestrall Platform Python SDK
import requests
import json
from typing import Optional, Dict, Any

class OrchestrallAPI:
    def __init__(self, base_url: str = 'https://api.orchestrall.com', token: Optional[str] = None):
        self.base_url = base_url
        self.token = token
        self.session = requests.Session()
        
        if self.token:
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
        
        self.session.headers.update({'Content-Type': 'application/json'})

    def set_token(self, token: str):
        self.token = token
        self.session.headers.update({'Authorization': f'Bearer {token}'})

    def _request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None):
        url = f"{self.base_url}{endpoint}"
        
        if data:
            response = self.session.request(method, url, json=data)
        else:
            response = self.session.request(method, url)
        
        response.raise_for_status()
        return response.json()

    # Agricultural APIs
    def get_farmers(self, organization_id: Optional[str] = None, region: Optional[str] = None):
        params = []
        if organization_id:
            params.append(f'organizationId={organization_id}')
        if region:
            params.append(f'region={region}')
        
        endpoint = f"/api/agricultural/farmers?{'&'.join(params)}" if params else "/api/agricultural/farmers"
        return self._request('GET', endpoint)

    def create_farmer(self, farmer_data: Dict[str, Any]):
        return self._request('POST', '/api/agricultural/farmers', farmer_data)

    # Voice APIs
    def process_voice(self, audio_data: str, farmer_id: str, language: str = 'hi'):
        return self._request('POST', '/api/voice/process', {
            'audioData': audio_data,
            'farmerId': farmer_id,
            'language': language
        })

    # Multi-tenancy APIs
    def get_tenants(self):
        return self._request('GET', '/api/tenants')

    def create_tenant(self, tenant_data: Dict[str, Any]):
        return self._request('POST', '/api/tenants', tenant_data)

    # Backup APIs
    def create_full_backup(self, options: Optional[Dict[str, Any]] = None):
        return self._request('POST', '/api/backup/full', {'options': options or {}})

    def restore_from_backup(self, backup_id: str, options: Optional[Dict[str, Any]] = None):
        return self._request('POST', f'/api/restore/{backup_id}', options or {})

    # Observability APIs
    def get_system_health(self, organization_id: Optional[str] = None):
        endpoint = f"/api/observability/health?organizationId={organization_id}" if organization_id else "/api/observability/health"
        return self._request('GET', endpoint)

# Usage example
api = OrchestrallAPI('https://api.orchestrall.com', 'your-jwt-token')

# Get farmers
farmers = api.get_farmers('org_123')

# Process voice input
voice_result = api.process_voice('base64-audio-data', 'farmer_123', 'hi')
`;
  }

  generateJavaSDK() {
    return `
// Modern Orchestrall Platform Java SDK
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.util.Map;
import java.util.HashMap;
import com.fasterxml.jackson.databind.ObjectMapper;

public class OrchestrallAPI {
    private final String baseUrl;
    private String token;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OrchestrallAPI(String baseUrl, String token) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
    }

    public void setToken(String token) {
        this.token = token;
    }

    private Map<String, Object> request(String method, String endpoint, Map<String, Object> data) throws Exception {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + endpoint))
            .header("Content-Type", "application/json");

        if (token != null) {
            requestBuilder.header("Authorization", "Bearer " + token);
        }

        if (data != null) {
            String jsonData = objectMapper.writeValueAsString(data);
            requestBuilder.method(method, HttpRequest.BodyPublishers.ofString(jsonData));
        } else {
            requestBuilder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        return objectMapper.readValue(response.body(), Map.class);
    }

    // Agricultural APIs
    public Map<String, Object> getFarmers(String organizationId, String region) throws Exception {
        StringBuilder endpoint = new StringBuilder("/api/agricultural/farmers?");
        if (organizationId != null) endpoint.append("organizationId=").append(organizationId);
        if (region != null) endpoint.append("&region=").append(region);
        
        return request("GET", endpoint.toString(), null);
    }

    public Map<String, Object> createFarmer(Map<String, Object> farmerData) throws Exception {
        return request("POST", "/api/agricultural/farmers", farmerData);
    }

    // Voice APIs
    public Map<String, Object> processVoice(String audioData, String farmerId, String language) throws Exception {
        Map<String, Object> data = new HashMap<>();
        data.put("audioData", audioData);
        data.put("farmerId", farmerId);
        data.put("language", language);
        
        return request("POST", "/api/voice/process", data);
    }

    // Multi-tenancy APIs
    public Map<String, Object> getTenants() throws Exception {
        return request("GET", "/api/tenants", null);
    }

    public Map<String, Object> createTenant(Map<String, Object> tenantData) throws Exception {
        return request("POST", "/api/tenants", tenantData);
    }

    // Backup APIs
    public Map<String, Object> createFullBackup(Map<String, Object> options) throws Exception {
        Map<String, Object> data = new HashMap<>();
        data.put("options", options);
        
        return request("POST", "/api/backup/full", data);
    }

    public Map<String, Object> restoreFromBackup(String backupId, Map<String, Object> options) throws Exception {
        return request("POST", "/api/restore/" + backupId, options);
    }

    // Observability APIs
    public Map<String, Object> getSystemHealth(String organizationId) throws Exception {
        String endpoint = organizationId != null ? 
            "/api/observability/health?organizationId=" + organizationId : 
            "/api/observability/health";
        
        return request("GET", endpoint, null);
    }
}

// Usage example
OrchestrallAPI api = new OrchestrallAPI("https://api.orchestrall.com", "your-jwt-token");

// Get farmers
Map<String, Object> farmers = api.getFarmers("org_123", null);

// Process voice input
Map<String, Object> voiceResult = api.processVoice("base64-audio-data", "farmer_123", "hi");
`;
  }

  generateCSharpSDK() {
    return `
// Modern Orchestrall Platform C# SDK
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;

public class OrchestrallAPI
{
    private readonly string baseUrl;
    private string token;
    private readonly HttpClient httpClient;
    private readonly JsonSerializerOptions jsonOptions;

    public OrchestrallAPI(string baseUrl, string token = null)
    {
        this.baseUrl = baseUrl;
        this.token = token;
        this.httpClient = new HttpClient();
        this.jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        
        httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");
        if (token != null)
        {
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
        }
    }

    public void SetToken(string token)
    {
        this.token = token;
        httpClient.DefaultRequestHeaders.Remove("Authorization");
        httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
    }

    private async Task<T> RequestAsync<T>(string method, string endpoint, object data = null)
    {
        var url = $"{baseUrl}{endpoint}";
        var request = new HttpRequestMessage(new HttpMethod(method), url);
        
        if (data != null)
        {
            var json = JsonSerializer.Serialize(data, jsonOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        
        var responseContent = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<T>(responseContent, jsonOptions);
    }

    // Agricultural APIs
    public async Task<object> GetFarmersAsync(string organizationId = null, string region = null)
    {
        var endpoint = "/api/agricultural/farmers";
        var queryParams = new List<string>();
        
        if (!string.IsNullOrEmpty(organizationId))
            queryParams.Add($"organizationId={organizationId}");
        if (!string.IsNullOrEmpty(region))
            queryParams.Add($"region={region}");
        
        if (queryParams.Count > 0)
            endpoint += "?" + string.Join("&", queryParams);
        
        return await RequestAsync<object>("GET", endpoint);
    }

    public async Task<object> CreateFarmerAsync(object farmerData)
    {
        return await RequestAsync<object>("POST", "/api/agricultural/farmers", farmerData);
    }

    // Voice APIs
    public async Task<object> ProcessVoiceAsync(string audioData, string farmerId, string language = "hi")
    {
        var data = new
        {
            audioData = audioData,
            farmerId = farmerId,
            language = language
        };
        
        return await RequestAsync<object>("POST", "/api/voice/process", data);
    }

    // Multi-tenancy APIs
    public async Task<object> GetTenantsAsync()
    {
        return await RequestAsync<object>("GET", "/api/tenants");
    }

    public async Task<object> CreateTenantAsync(object tenantData)
    {
        return await RequestAsync<object>("POST", "/api/tenants", tenantData);
    }

    // Backup APIs
    public async Task<object> CreateFullBackupAsync(object options = null)
    {
        var data = new { options = options ?? new { } };
        return await RequestAsync<object>("POST", "/api/backup/full", data);
    }

    public async Task<object> RestoreFromBackupAsync(string backupId, object options = null)
    {
        return await RequestAsync<object>("POST", $"/api/restore/{backupId}", options);
    }

    // Observability APIs
    public async Task<object> GetSystemHealthAsync(string organizationId = null)
    {
        var endpoint = string.IsNullOrEmpty(organizationId) ? 
            "/api/observability/health" : 
            $"/api/observability/health?organizationId={organizationId}";
        
        return await RequestAsync<object>("GET", endpoint);
    }
}

// Usage example
var api = new OrchestrallAPI("https://api.orchestrall.com", "your-jwt-token");

// Get farmers
var farmers = await api.GetFarmersAsync("org_123");

// Process voice input
var voiceResult = await api.ProcessVoiceAsync("base64-audio-data", "farmer_123", "hi");
`;
  }
}

module.exports = APIDocumentationService;
