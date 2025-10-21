// src/app-zero-config.js - Zero-config commercial server
require('dotenv').config();
const fastify = require('fastify');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const client = require('prom-client');

// Import services
const DatabaseAutoSetup = require('./database/auto-setup');
const getProfessionalAdminDashboardEnhancedHtml = require('./frontend/professional-admin-dashboard-enhanced').getProfessionalAdminDashboardEnhancedHtml;
const UniversalCRUDService = require('./core/crud/UniversalCRUDService');
const universalCRUDRoutes = require('./routes/universal-crud');
const NotificationService = require('./notifications/service');
const { runBackup } = require('./backup/service');
const { restoreFromSnapshot } = require('./backup/restore');
const BackupRecoveryService = require('./backup/backup-recovery-service');
const APIDocumentationService = require('./documentation/api-documentation-service');
const PerformanceOptimizationService = require('./performance/performance-optimization-service');
const InternationalizationService = require('./i18n/internationalization-service');
const ClientOnboardingService = require('./onboarding/client-onboarding-service');
const { getLang, getDict } = require('./i18n/index');
const { loadClientBundle } = require('./bundles/loader');
const { diffAndApply } = require('./bundles/apply');
const PluginCatalogService = require('./plugins/service');
const RazorpayService = require('./payments/razorpay-service');
const PaymentReconciliationService = require('./payments/reconciliation-service');
const ZohoCRMService = require('./crm/zoho-service');
const CRMSyncService = require('./crm/sync-service');
const InventoryTransferService = require('./inventory/transfer-service');
const ReorderRulesEngine = require('./inventory/reorder-engine');
const ElasticsearchService = require('./search/elasticsearch-service');
const SearchIndexingService = require('./search/indexing-service');
const SarvamVoiceService = require('./voice/sarvam-service');
const TenantObservabilityService = require('./observability/tenant-service');
const ObservabilityService = require('./observability/observability-service');
const RBACService = require('./security/rbac-service');
const MultiTenancyService = require('./multitenancy/service');

// Security and Validation Services
const AuthMiddleware = require('./middleware/auth');
const ValidationService = require('./validation/validation-service');
const ErrorHandler = require('./middleware/error-handler');

// Agricultural Services
const CropMonitoringService = require('./agricultural/crop-monitoring-service');
const FarmerManagementService = require('./agricultural/farmer-management-service');
const MarketIntelligenceService = require('./agricultural/market-intelligence-service');
const AgriculturalFinancialService = require('./agricultural/agricultural-financial-service');
const WeatherIntegrationService = require('./agricultural/weather-integration-service');

// Real-time Services
const WebSocketServer = require('./realtime/websocket-server');
const SSEServer = require('./realtime/sse-server');
const PushNotificationService = require('./notifications/push-service');
const SMSService = require('./notifications/sms-service');
const EmailService = require('./notifications/email-service');

// Analytics and Workflow Services
const AnalyticsService = require('./analytics/analytics-service');
const WorkflowOrchestrationService = require('./workflows/workflow-orchestration-service');

class ZeroConfigServer {
  constructor() {
    this.app = null;
    this.databaseSetup = null;
    this.adminDashboard = null;
    this.prisma = null;
    this.isInitialized = false;
    this.eventBus = new EventEmitter();
    this.sseClients = new Set();
    this.metrics = {
      registry: new client.Registry(),
      httpRequestDurationMs: null,
      httpRequestsTotal: null,
    };
    this.notifications = new NotificationService();
    this.backupRecovery = new BackupRecoveryService(this.prisma);
    this.apiDocumentation = new APIDocumentationService(this.app, this.prisma);
    this.performanceOptimization = new PerformanceOptimizationService(this.prisma);
    this.internationalization = new InternationalizationService(this.prisma);
    this.clientOnboarding = new ClientOnboardingService(this.prisma);
    this.pluginCatalog = new PluginCatalogService();
    this.razorpay = new RazorpayService();
    this.zoho = new ZohoCRMService();
    this.inventoryTransfer = new InventoryTransferService(this.prisma);
    this.reorderEngine = new ReorderRulesEngine(this.prisma);
    this.elasticsearch = new ElasticsearchService();
    this.sarvamVoice = new SarvamVoiceService(this.prisma);
    this.tenantObservability = new TenantObservabilityService(this.prisma);
    this.observability = new ObservabilityService(this.prisma);
    this.rbac = new RBACService(this.prisma);
    this.multitenancy = new MultiTenancyService(this.prisma);
    
    // Initialize Security Services
    this.authMiddleware = new AuthMiddleware();
    this.validationService = new ValidationService();
    this.errorHandler = new ErrorHandler();
    
    // Initialize Agricultural Services
    this.cropMonitoring = new CropMonitoringService(this.prisma);
    this.farmerManagement = new FarmerManagementService(this.prisma);
    this.marketIntelligence = new MarketIntelligenceService(this.prisma);
    this.agriculturalFinance = new AgriculturalFinancialService(this.prisma);
    this.weatherIntegration = new WeatherIntegrationService(this.prisma);
    
    // Initialize Real-time Services
    this.webSocketServer = null;
    this.sseServer = new SSEServer(this.prisma);
    this.pushService = new PushNotificationService(this.prisma);
    this.smsService = new SMSService(this.prisma);
    this.emailService = new EmailService(this.prisma);
    
    // Initialize Analytics and Workflow Services
    this.analytics = new AnalyticsService(this.prisma);
    this.workflowOrchestration = new WorkflowOrchestrationService(this.prisma);
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Zero-Config Orchestrall Platform...');
      
      // Create Fastify app
      this.app = fastify({
        logger: {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        },
        trustProxy: true,
        bodyLimit: 50 * 1024 * 1024, // 50MB
      });

      // Register plugins
      await this.registerPlugins();
      
      // Initialize database with auto-setup
      await this.initializeDatabase();
      
      // Initialize admin dashboard
      await this.initializeAdminDashboard();
      
      // Initialize metrics
      await this.initializeMetrics();

      // Initialize real-time services
      await this.initializeRealTimeServices();

      // Initialize analytics and workflow services
      await this.initializeAnalyticsAndWorkflowServices();

      // Register routes
      await this.registerRoutes();
      
      // Add error handling
      this.addErrorHandling();
      
      this.isInitialized = true;
      console.log('✅ Zero-Config Platform initialized successfully');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      throw error;
    }
  }

  async registerPlugins() {
    // CORS
    await this.app.register(require('@fastify/cors'), {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    });

    // Helmet for security
    await this.app.register(require('@fastify/helmet'), {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
    });

    // Rate limiting
    await this.app.register(require('@fastify/rate-limit'), {
      max: 1000,
      timeWindow: '1 minute',
    });

    // JWT authentication
    await this.app.register(require('@fastify/jwt'), {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    });

    // Swagger documentation
    await this.app.register(require('@fastify/swagger'), {
      swagger: {
        info: {
          title: 'Orchestrall Platform API',
          description: 'Zero-config commercial platform API',
          version: '2.0.0',
        },
        host: 'localhost:3000',
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        securityDefinitions: {
          bearerAuth: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
          },
        },
      },
    });

    await this.app.register(require('@fastify/swagger-ui'), {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });

    // Compression
    await this.app.register(require('@fastify/compress'));

    // Static files
    await this.app.register(require('@fastify/static'), {
      root: path.join(__dirname, '../../public'),
      prefix: '/',
    });
  }

  async initializeMetrics() {
    // Default metrics and custom metrics
    client.collectDefaultMetrics({ register: this.metrics.registry });

    this.metrics.httpRequestDurationMs = new client.Histogram({
      name: 'http_request_duration_ms',
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [25, 50, 100, 200, 300, 400, 500, 750, 1000, 2000]
    });
    this.metrics.registry.registerMetric(this.metrics.httpRequestDurationMs);

    this.metrics.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    this.metrics.registry.registerMetric(this.metrics.httpRequestsTotal);

    // Fastify hooks to record metrics
    this.app.addHook('onRequest', async (request, reply) => {
      request._startAt = process.hrtime.bigint();
    });

    this.app.addHook('onResponse', async (request, reply) => {
      try {
        const route = request.routerPath || request.url;
        const method = request.method;
        const status = String(reply.statusCode);
        if (request._startAt) {
          const diffNs = Number(process.hrtime.bigint() - request._startAt);
          const durationMs = diffNs / 1e6;
          this.metrics.httpRequestDurationMs
            .labels(method, route, status)
            .observe(durationMs);
        }
        this.metrics.httpRequestsTotal
          .labels(method, route, status)
          .inc();
      } catch (_) {
        // ignore metrics errors
      }
    });
  }

  async initializeRealTimeServices() {
    console.log('🔌 Initializing real-time services...');
    
    try {
      // Initialize WebSocket server
      this.webSocketServer = new WebSocketServer(this.app.server, this.prisma);
      this.webSocketServer.initialize();
      this.webSocketServer.startHealthChecks();
      
      // Initialize SSE server
      this.sseServer.initialize(this.app);
      
      // Initialize notification services
      await this.pushService.initialize();
      await this.smsService.initialize();
      await this.emailService.initialize();
      
      // Initialize Razorpay service
      await this.razorpay.initialize();
      
      // Initialize Sarvam Voice service
      await this.sarvamVoice.initialize();
      
      // Initialize Observability service
      await this.observability.initialize();
      
      // Initialize Backup & Recovery service
      await this.backupRecovery.initialize();
      
      // Initialize API Documentation service
      await this.apiDocumentation.initialize();
      
      // Initialize Performance Optimization service
      await this.performanceOptimization.initialize();
      
      // Initialize Internationalization service
      await this.internationalization.initialize();
      
      // Initialize Client Onboarding service
      await this.clientOnboarding.initialize();
      
      console.log('✅ Real-time services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize real-time services:', error);
      throw error;
    }
  }

  async initializeAnalyticsAndWorkflowServices() {
    console.log('📊 Initializing analytics and workflow services...');
    
    try {
      // Initialize workflow orchestration service
      await this.workflowOrchestration.initialize();
      
      // Set up workflow event listeners
      this.workflowOrchestration.on('workflow:completed', (data) => {
        console.log(`✅ Workflow completed: ${data.workflowId}`);
      });
      
      this.workflowOrchestration.on('workflow:step:failed', (data) => {
        console.error(`❌ Workflow step failed: ${data.workflowId} - Step ${data.stepIndex}`);
      });
      
      this.workflowOrchestration.on('notification:send', (data) => {
        // Handle notifications through real-time services
        this.handleWorkflowNotification(data);
      });
      
      console.log('✅ Analytics and workflow services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize analytics and workflow services:', error);
      throw error;
    }
  }

  async handleWorkflowNotification(notificationData) {
    try {
      const { channels, template, context, priority } = notificationData;
      
      // Send notifications through appropriate channels
      for (const channel of channels) {
        switch (channel) {
          case 'email':
            await this.emailService.sendEmail(
              context.email,
              `Workflow Notification - ${template}`,
              `<h2>Workflow Update</h2><p>Template: ${template}</p><p>Priority: ${priority}</p>`,
              { userId: context.userId, type: 'workflow' }
            );
            break;
          case 'sms':
            await this.smsService.sendSMS(
              context.phone,
              `Workflow Update: ${template}`,
              { userId: context.userId, type: 'workflow' }
            );
            break;
          case 'push':
            await this.pushService.sendNotification(
              context.userId,
              {
                title: 'Workflow Update',
                body: `Template: ${template}`,
                type: 'workflow',
                priority
              }
            );
            break;
        }
      }
    } catch (error) {
      console.error('Failed to handle workflow notification:', error);
    }
  }

  async initializeDatabase() {
    console.log('📊 Setting up database...');
    
    this.databaseSetup = new DatabaseAutoSetup();
    const success = await this.databaseSetup.initialize();
    
    if (!success) {
      console.log('⚠️  Database setup failed, using mock data');
      this.prisma = this.createMockPrisma();
    } else {
      this.prisma = this.databaseSetup.prisma;
    }
    
    console.log('✅ Database ready');
  }

  async initializeAdminDashboard() {
    console.log('🎨 Setting up admin dashboard...');
    
    this.adminDashboard = new AdminDashboard();
    await this.adminDashboard.initialize();
    
    console.log('✅ Admin dashboard ready');
  }

  async registerRoutes() {
    // Enhanced Health Check Routes
    this.app.get('/health', async (request, reply) => {
      try {
        if (this.prisma && this.prisma.$queryRaw) {
          await this.prisma.$queryRaw`SELECT 1`;
        }
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          database: this.prisma ? 'connected' : 'mock',
          dashboard: 'ready'
        };
      } catch (error) {
        reply.code(503).send({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
          database: 'disconnected'
        });
      }
    });

    this.app.get('/health/database', async (request, reply) => {
      try {
        if (!this.prisma || !this.prisma.$queryRaw) {
          return reply.send({
            status: 'healthy',
            service: 'database',
            mode: 'mock',
            timestamp: new Date().toISOString()
          });
        }

        const start = Date.now();
        await this.prisma.$queryRaw`SELECT 1`;
        const responseTime = Date.now() - start;
        
        reply.send({
          status: 'healthy',
          service: 'database',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        reply.code(503).send({
          status: 'unhealthy',
          service: 'database',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/health/redis', async (request, reply) => {
      try {
        const start = Date.now();
        // Simple Redis ping test
        const redis = require('ioredis');
        const redisClient = new redis(process.env.REDIS_URL || 'redis://localhost:6379');
        await redisClient.ping();
        await redisClient.disconnect();
        const responseTime = Date.now() - start;
        
        reply.send({
          status: 'healthy',
          service: 'redis',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        reply.code(503).send({
          status: 'unhealthy',
          service: 'redis',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/health/full', async (request, reply) => {
      const healthChecks = {
        database: { status: 'unknown', responseTime: null, error: null },
        redis: { status: 'unknown', responseTime: null, error: null },
        memory: { status: 'unknown', usage: null, limit: null }
      };
      
      let overallStatus = 'healthy';
      
      try {
        // Database check
        if (this.prisma && this.prisma.$queryRaw) {
          const dbStart = Date.now();
          await this.prisma.$queryRaw`SELECT 1`;
          healthChecks.database = {
            status: 'healthy',
            responseTime: Date.now() - dbStart
          };
        } else {
          healthChecks.database = {
            status: 'healthy',
            mode: 'mock'
          };
        }
      } catch (error) {
        healthChecks.database = {
          status: 'unhealthy',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
      
      try {
        // Redis check
        const redisStart = Date.now();
        const redis = require('ioredis');
        const redisClient = new redis(process.env.REDIS_URL || 'redis://localhost:6379');
        await redisClient.ping();
        await redisClient.disconnect();
        healthChecks.redis = {
          status: 'healthy',
          responseTime: Date.now() - redisStart
        };
      } catch (error) {
        healthChecks.redis = {
          status: 'unhealthy',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
      
      // Memory usage check
      const memUsage = process.memoryUsage();
      healthChecks.memory = {
        status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'healthy' : 'warning',
        usage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        limit: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      };
      
      if (healthChecks.memory.status === 'warning') {
        overallStatus = 'warning';
      }
      
      reply.send({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
        checks: healthChecks
      });
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (request, reply) => {
      try {
        reply.header('Content-Type', this.metrics.registry.contentType);
        const metrics = await this.metrics.registry.metrics();
        reply.send(metrics);
      } catch (err) {
        reply.code(500).send('');
      }
    });

    // Root redirect to admin dashboard
    this.app.get('/', async (request, reply) => {
      reply.redirect('/admin/');
    });

    // Admin Dashboard Frontend Route
    this.app.get('/admin', async (request, reply) => {
      try {
        // Fetch entity names to dynamically build navigation
        const entityNames = Object.keys(this.prisma).filter(key => 
          !key.startsWith('$') && typeof this.prisma[key].findMany === 'function'
        );
        const lang = getLang(request);
        reply.header('Content-Type', 'text/html').send(
          getProfessionalAdminDashboardEnhancedHtml(entityNames, getDict(lang))
        );
      } catch (error) {
        console.error('Failed to render admin dashboard', error);
        reply.code(500).send({ error: 'Failed to load admin dashboard' });
      }
    });

    // Server-Sent Events (SSE) for realtime updates
    this.app.get('/events', async (request, reply) => {
      reply.headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      reply.raw.writeHead(200);
      reply.raw.write('\n');

      const clientRef = reply;
      this.sseClients.add(clientRef);

      // Heartbeat to keep connection alive
      const interval = setInterval(() => {
        try {
          reply.raw.write(`event: ping\n`);
          reply.raw.write(`data: {"ts":"${new Date().toISOString()}"}\n\n`);
        } catch (_) {
          // client likely disconnected
        }
      }, 25000);

      request.raw.on('close', () => {
        clearInterval(interval);
        this.sseClients.delete(clientRef);
      });
    });

    // Helper: broadcast events
    const broadcast = (type, payload) => {
      const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
      for (const res of this.sseClients) {
        try { res.raw.write(msg); } catch (_) { /* ignore */ }
      }
      this.eventBus.emit(type, payload);
    };

    // API info
    this.app.get('/api', async (request, reply) => {
      return {
        name: 'Orchestrall Platform API',
        version: '2.0.0',
        description: 'Zero-config commercial platform API',
        endpoints: {
          health: '/health',
          docs: '/docs',
          admin: '/admin/',
          entities: '/api/entities',
          crud: '/api/:entityName'
        },
        features: [
          'Universal CRUD APIs',
          'Multi-tenant support',
          'Admin dashboard',
          'Auto-setup database',
          'Zero configuration required'
        ]
      };
    });

    // Advanced Analytics Endpoints (baseline implementations)
    this.app.get('/api/analytics/cohort', async (request, reply) => {
      try {
        const organizationId = (request.user && request.user.organizationId) || undefined;
        // Group users by month of createdAt (simple cohort by signup month)
        const rows = await this.prisma.$queryRawUnsafe(`
          SELECT to_char(date_trunc('month', "createdAt"),'YYYY-MM') AS cohort,
                 COUNT(*)::int AS users
          FROM "User"
          ${organizationId ? `WHERE "organizationId" = '${organizationId}'` : ''}
          GROUP BY 1
          ORDER BY 1 ASC;
        `);
        reply.send({ success: true, data: rows });
      } catch (err) {
        reply.send({ success: true, data: [] });
      }
    });

    this.app.get('/api/analytics/ltv', async (request, reply) => {
      try {
        const organizationId = (request.user && request.user.organizationId) || undefined;
        // Approx LTV: average totalAmount per customer
        const rows = await this.prisma.$queryRawUnsafe(`
          SELECT o."customerId", COALESCE(SUM(o."totalAmount"),0)::float AS revenue
          FROM "Order" o
          ${organizationId ? `WHERE o."organizationId" = '${organizationId}'` : ''}
          GROUP BY o."customerId";
        `);
        const avg = rows && rows.length ? rows.reduce((a,b)=>a+Number(b.revenue||0),0)/rows.length : 0;
        reply.send({ success: true, data: { averageLTV: Number(avg.toFixed(2)), customers: rows } });
      } catch (err) {
        reply.send({ success: true, data: { averageLTV: 0, customers: [] } });
      }
    });

    this.app.get('/api/analytics/funnel', async (request, reply) => {
      try {
        const organizationId = (request.user && request.user.organizationId) || undefined;
        // Simple funnel: users -> orders -> paid orders (status='PAID')
        const users = await this.prisma.user.count({ where: organizationId ? { organizationId } : {} });
        const orders = await this.prisma.order.count({ where: organizationId ? { organizationId } : {} });
        const paid = await this.prisma.order.count({ where: organizationId ? { organizationId, status: 'PAID' } : { status: 'PAID' } });
        reply.send({ success: true, data: { users, orders, paid } });
      } catch (err) {
        reply.send({ success: true, data: { users: 0, orders: 0, paid: 0 } });
      }
    });

    this.app.get('/api/analytics/retention', async (request, reply) => {
      try {
        const organizationId = (request.user && request.user.organizationId) || undefined;
        // Retention proxy: customers with >1 orders / total customers
        const rows = await this.prisma.$queryRawUnsafe(`
          SELECT o."customerId", COUNT(*)::int AS orders
          FROM "Order" o
          ${organizationId ? `WHERE o."organizationId" = '${organizationId}'` : ''}
          GROUP BY o."customerId";
        `);
        const total = rows.length;
        const retained = rows.filter(r => Number(r.orders||0) > 1).length;
        const rate = total ? Number(((retained/total)*100).toFixed(2)) : 0;
        reply.send({ success: true, data: { retainedCustomers: retained, totalCustomers: total, retentionRate: rate } });
      } catch (err) {
        reply.send({ success: true, data: { retainedCustomers: 0, totalCustomers: 0, retentionRate: 0 } });
      }
    });

    // Backup endpoints (admin)
    this.app.post('/api/admin/backup', async (request, reply) => {
      try {
        const orgId = request.body && request.body.organizationId ? request.body.organizationId : undefined;
        const res = await runBackup({ prisma: this.prisma, organizationId: orgId });
        reply.send({ success: true, output: res.folder, index: res.index });
      } catch (err) {
        reply.code(500).send({ success: false, error: err.message });
      }
    });

    this.app.post('/api/admin/restore', async (request, reply) => {
      try {
        const { folder, organizationId, mode } = request.body || {};
        if (!folder) return reply.code(400).send({ success: false, error: 'folder is required' });
        const res = await restoreFromSnapshot({ prisma: this.prisma, folder, organizationId, mode: mode || 'create-only' });
        reply.send({ success: true, summary: res });
      } catch (err) {
        reply.code(500).send({ success: false, error: err.message });
      }
    });

    // Service Bundles APIs
    this.app.post('/api/admin/bundles/apply', async (request, reply) => {
      const client = request.query && request.query.client;
      const dry = (request.query && String(request.query.dryRun).toLowerCase() === 'true');
      if (!client) return reply.code(400).send({ success: false, error: 'client is required' });
      try {
        const bundle = loadClientBundle(path.join(__dirname, '..'), client);
        const res = await diffAndApply({ prisma: this.prisma, clientId: client, bundle, dryRun: dry });
        // emit events
        try { this.eventBus.emit('bundle:apply', { client, dryRun: dry, status: 'ok' }); } catch(_){}
        reply.send({ success: true, client, ...res });
      } catch (err) {
        try { this.eventBus.emit('bundle:apply', { client, dryRun: dry, status: 'error', error: err.message }); } catch(_){}
        reply.code(500).send({ success: false, error: err.message });
      }
    });

    this.app.get('/api/admin/bundles/status', async (request, reply) => {
      const client = request.query && request.query.client;
      if (!client) return reply.code(400).send({ success: false, error: 'client is required' });
      try {
        const bundle = loadClientBundle(path.join(__dirname, '..'), client);
        reply.send({ success: true, client, bundle: { id: bundle.id, version: bundle.version, plugins: bundle.plugins.map(p=>p.id) } });
      } catch (err) {
        reply.code(404).send({ success: false, error: err.message });
      }
    });

    // Plugin Marketplace APIs
    this.app.get('/api/plugins/catalog', async (request, reply) => {
      try {
        const catalog = await this.pluginCatalog.getCatalog();
        return reply.send(catalog);
      } catch (error) {
        this.app.log.error('Plugin catalog error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/plugins/catalog/:pluginId', async (request, reply) => {
      try {
        const { pluginId } = request.params;
        const plugin = await this.pluginCatalog.getPlugin(pluginId);
        
        if (!plugin) {
          return reply.code(404).send({ error: `Plugin ${pluginId} not found` });
        }

        return reply.send(plugin);
      } catch (error) {
        this.app.log.error('Plugin details error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/plugins/enable', async (request, reply) => {
      try {
        const { pluginId, organizationId } = request.body;
        
        if (!pluginId || !organizationId) {
          return reply.code(400).send({ 
            error: 'pluginId and organizationId are required' 
          });
        }

        const result = await this.pluginCatalog.enablePlugin(pluginId, organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Plugin enable error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/plugins/disable', async (request, reply) => {
      try {
        const { pluginId, organizationId } = request.body;
        
        if (!pluginId || !organizationId) {
          return reply.code(400).send({ 
            error: 'pluginId and organizationId are required' 
          });
        }

        const result = await this.pluginCatalog.disablePlugin(pluginId, organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Plugin disable error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/plugins/health-check/:pluginId', async (request, reply) => {
      try {
        const { pluginId } = request.params;
        const healthData = await this.pluginCatalog.performHealthCheck(pluginId);
        return reply.send(healthData);
      } catch (error) {
        this.app.log.error('Plugin health check error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/plugins/metrics', async (request, reply) => {
      try {
        const metrics = await this.pluginCatalog.getPluginMetrics();
        return reply.send(metrics);
      } catch (error) {
        this.app.log.error('Plugin metrics error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Payment APIs (Razorpay)
    this.app.post('/api/payments/create-intent', async (request, reply) => {
      try {
        const { amount, currency = 'INR', metadata = {} } = request.body;
        
        if (!amount || amount <= 0) {
          return reply.code(400).send({ 
            error: 'Valid amount is required' 
          });
        }

        const result = await this.razorpay.createPaymentIntent(amount, currency, metadata);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Payment intent creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/payments/capture/:paymentId', async (request, reply) => {
      try {
        const { paymentId } = request.params;
        const { amount } = request.body;
        
        if (!amount || amount <= 0) {
          return reply.code(400).send({ 
            error: 'Valid amount is required' 
          });
        }

        const result = await this.razorpay.capturePayment(paymentId, amount);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Payment capture error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/payments/refund/:paymentId', async (request, reply) => {
      try {
        const { paymentId } = request.params;
        const { amount, reason = 'requested_by_customer' } = request.body;
        
        if (!amount || amount <= 0) {
          return reply.code(400).send({ 
            error: 'Valid amount is required' 
          });
        }

        const result = await this.razorpay.createRefund(paymentId, amount, reason);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Refund creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/payments/:paymentId', async (request, reply) => {
      try {
        const { paymentId } = request.params;
        const result = await this.razorpay.getPaymentDetails(paymentId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Payment details error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/payments/:paymentId/refunds', async (request, reply) => {
      try {
        const { paymentId } = request.params;
        const result = await this.razorpay.getRefunds(paymentId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Refunds fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/payments/webhook', async (request, reply) => {
      try {
        const signature = request.headers['x-razorpay-signature'];
        const body = JSON.stringify(request.body);
        
        if (!this.razorpay.verifyWebhookSignature(body, signature)) {
          return reply.code(400).send({ error: 'Invalid webhook signature' });
        }

        const eventType = request.body.event;
        const eventData = request.body;
        
        const result = await this.razorpay.processWebhookEvent(eventType, eventData);
        
        // Emit event for other services
        this.eventBus.emit('payment:webhook', { eventType, eventData });
        
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Webhook processing error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/payments/reconciliation', async (request, reply) => {
      try {
        const { startDate, endDate, organizationId = 'demo-org' } = request.query;
        
        if (!startDate || !endDate) {
          return reply.code(400).send({ 
            error: 'startDate and endDate are required' 
          });
        }

        const reconciliationService = new PaymentReconciliationService(this.prisma);
        const result = await reconciliationService.generateReconciliationReport(
          organizationId, startDate, endDate
        );
        
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Reconciliation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/payments/analytics', async (request, reply) => {
      try {
        const { startDate, endDate, organizationId = 'demo-org' } = request.query;
        
        if (!startDate || !endDate) {
          return reply.code(400).send({ 
            error: 'startDate and endDate are required' 
          });
        }

        const reconciliationService = new PaymentReconciliationService(this.prisma);
        const result = await reconciliationService.getPaymentAnalytics(
          organizationId, startDate, endDate
        );
        
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Payment analytics error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // CRM APIs (Zoho)
    this.app.get('/api/crm/sync-status', async (request, reply) => {
      try {
        const result = await this.zoho.getSyncStatus();
        return reply.send(result);
      } catch (error) {
        this.app.log.error('CRM sync status error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/crm/leads', async (request, reply) => {
      try {
        const leadData = request.body;
        const result = await this.zoho.createLead(leadData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Lead creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.put('/api/crm/leads/:leadId', async (request, reply) => {
      try {
        const { leadId } = request.params;
        const leadData = request.body;
        const result = await this.zoho.updateLead(leadId, leadData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Lead update error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/crm/leads/:leadId', async (request, reply) => {
      try {
        const { leadId } = request.params;
        const result = await this.zoho.getLead(leadId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Lead fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/crm/leads/search', async (request, reply) => {
      try {
        const criteria = request.query;
        const result = await this.zoho.searchLeads(criteria);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Lead search error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/crm/contacts', async (request, reply) => {
      try {
        const contactData = request.body;
        const result = await this.zoho.createContact(contactData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Contact creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/crm/deals', async (request, reply) => {
      try {
        const dealData = request.body;
        const result = await this.zoho.createDeal(dealData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Deal creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/crm/sync/start', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', options = {} } = request.body;
        const syncService = new CRMSyncService(this.prisma);
        const result = await syncService.startLeadSyncJob(organizationId, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Sync job start error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/crm/sync/jobs/:jobId', async (request, reply) => {
      try {
        const { jobId } = request.params;
        const syncService = new CRMSyncService(this.prisma);
        const result = await syncService.getSyncJobStatus(jobId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Sync job status error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/crm/sync/jobs', async (request, reply) => {
      try {
        const { organizationId = 'demo-org' } = request.query;
        const syncService = new CRMSyncService(this.prisma);
        const result = await syncService.getAllSyncJobs(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Sync jobs list error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/crm/sync/jobs/:jobId/cancel', async (request, reply) => {
      try {
        const { jobId } = request.params;
        const syncService = new CRMSyncService(this.prisma);
        const result = await syncService.cancelSyncJob(jobId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Sync job cancel error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/crm/sync/metrics', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', startDate, endDate } = request.query;
        
        if (!startDate || !endDate) {
          return reply.code(400).send({ 
            error: 'startDate and endDate are required' 
          });
        }

        const syncService = new CRMSyncService(this.prisma);
        const result = await syncService.getSyncMetrics(organizationId, startDate, endDate);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Sync metrics error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/crm/fields/:module', async (request, reply) => {
      try {
        const { module } = request.params;
        const result = await this.zoho.getModuleFields(module);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Module fields error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Inventory Operations APIs
    this.app.post('/api/inventory/transfers', async (request, reply) => {
      try {
        const transferData = request.body;
        const result = await this.inventoryTransfer.createTransfer(transferData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Transfer creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/inventory/transfers/:transferId/approve', async (request, reply) => {
      try {
        const { transferId } = request.params;
        const { approvedBy } = request.body;
        const result = await this.inventoryTransfer.approveTransfer(transferId, approvedBy);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Transfer approval error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/inventory/transfers/:transferId/reject', async (request, reply) => {
      try {
        const { transferId } = request.params;
        const { rejectedBy, reason } = request.body;
        const result = await this.inventoryTransfer.rejectTransfer(transferId, rejectedBy, reason);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Transfer rejection error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/inventory/transfers', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', ...filters } = request.query;
        const result = await this.inventoryTransfer.getTransfers(organizationId, filters);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Transfers fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/inventory/reorder-rules', async (request, reply) => {
      try {
        const ruleData = request.body;
        const result = await this.reorderEngine.createReorderRule(ruleData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Reorder rule creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/inventory/reorder-rules/execute', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', storeId } = request.body;
        const result = await this.reorderEngine.executeReorderRules(organizationId, storeId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Reorder rules execution error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/inventory/reorder-requests', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', ...filters } = request.query;
        const result = await this.reorderEngine.getReorderRequests(organizationId, filters);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Reorder requests fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.put('/api/inventory/reorder-rules/:ruleId', async (request, reply) => {
      try {
        const { ruleId } = request.params;
        const updateData = request.body;
        const result = await this.reorderEngine.updateReorderRule(ruleId, updateData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Reorder rule update error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.delete('/api/inventory/reorder-rules/:ruleId', async (request, reply) => {
      try {
        const { ruleId } = request.params;
        const result = await this.reorderEngine.deleteReorderRule(ruleId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Reorder rule deletion error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/inventory/audit-logs', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', ...filters } = request.query;
        const result = await this.inventoryTransfer.getAuditLogs(organizationId, filters);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Audit logs fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Search APIs (Elasticsearch)
    this.app.get('/api/search/health', async (request, reply) => {
      try {
        const result = await this.elasticsearch.getHealth();
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search health check error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/search/indices', async (request, reply) => {
      try {
        const result = await this.elasticsearch.getIndices();
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search indices error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/search/indexing/initialize', async (request, reply) => {
      try {
        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.initializeIndexes();
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search indexing initialization error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/search/indexing/start', async (request, reply) => {
      try {
        const { entityType, organizationId = 'demo-org', options = {} } = request.body;
        
        if (!entityType) {
          return reply.code(400).send({ 
            error: 'entityType is required' 
          });
        }

        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.startIndexingJob(entityType, organizationId, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search indexing start error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/search/indexing/jobs/:jobId', async (request, reply) => {
      try {
        const { jobId } = request.params;
        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.getIndexingJobStatus(jobId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search indexing job status error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/search/indexing/jobs', async (request, reply) => {
      try {
        const { organizationId = 'demo-org' } = request.query;
        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.getAllIndexingJobs(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search indexing jobs list error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/search/products', async (request, reply) => {
      try {
        const { q, organizationId = 'demo-org', ...options } = request.query;
        
        if (!q) {
          return reply.code(400).send({ 
            error: 'Query parameter q is required' 
          });
        }

        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.searchProducts(q, organizationId, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Product search error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/search/users', async (request, reply) => {
      try {
        const { q, organizationId = 'demo-org', ...options } = request.query;
        
        if (!q) {
          return reply.code(400).send({ 
            error: 'Query parameter q is required' 
          });
        }

        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.searchUsers(q, organizationId, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('User search error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/search/orders', async (request, reply) => {
      try {
        const { q, organizationId = 'demo-org', ...options } = request.query;
        
        if (!q) {
          return reply.code(400).send({ 
            error: 'Query parameter q is required' 
          });
        }

        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.searchOrders(q, organizationId, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Order search error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.put('/api/search/:entityType/:id', async (request, reply) => {
      try {
        const { entityType, id } = request.params;
        const document = request.body;
        
        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.updateDocument(entityType, id, document);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search document update error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.delete('/api/search/:entityType/:id', async (request, reply) => {
      try {
        const { entityType, id } = request.params;
        
        const searchIndexing = new SearchIndexingService(this.prisma);
        const result = await searchIndexing.deleteDocument(entityType, id);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Search document deletion error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Voice APIs (Sarvam AI)
    this.app.post('/api/voice/process', async (request, reply) => {
      try {
        const { audioData, sessionId, ...options } = request.body;
        
        if (!audioData || !sessionId) {
          return reply.code(400).send({ 
            error: 'audioData and sessionId are required' 
          });
        }

        const result = await this.sarvamVoice.processVoiceCall(audioData, sessionId, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Voice processing error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/voice/sessions/:sessionId', async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const result = await this.sarvamVoice.getCallSession(sessionId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Call session fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/voice/sessions', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', ...filters } = request.query;
        const result = await this.sarvamVoice.getAllCallSessions(organizationId, filters);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Call sessions list error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/voice/analytics', async (request, reply) => {
      try {
        const { organizationId = 'demo-org', startDate, endDate } = request.query;
        
        if (!startDate || !endDate) {
          return reply.code(400).send({ 
            error: 'startDate and endDate are required' 
          });
        }

        const result = await this.sarvamVoice.getVoiceAnalytics(organizationId, startDate, endDate);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Voice analytics error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/voice/sessions/:sessionId/audio', async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const result = await this.sarvamVoice.getAudioUrl(sessionId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Audio URL generation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.delete('/api/voice/sessions/:sessionId', async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const result = await this.sarvamVoice.deleteCallSession(sessionId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Call session deletion error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Observability APIs (Per-tenant)
    this.app.post('/api/observability/tenant/:organizationId/initialize', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const result = await this.tenantObservability.initializeTenantMetrics(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant metrics initialization error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/observability/tenant/:organizationId/metrics', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const { metricType, value, labels = {} } = request.body;
        
        if (!metricType || value === undefined) {
          return reply.code(400).send({ 
            error: 'metricType and value are required' 
          });
        }

        const result = await this.tenantObservability.recordMetric(organizationId, metricType, value, labels);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Metric recording error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/observability/tenant/:organizationId/metrics', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const { timeRange = '1h' } = request.query;
        const result = await this.tenantObservability.getTenantMetrics(organizationId, timeRange);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant metrics fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/observability/tenant/:organizationId/health', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const result = await this.tenantObservability.getTenantHealth(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant health check error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/observability/tenant/:organizationId/dashboards', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const dashboardConfig = request.body;
        const result = await this.tenantObservability.createDashboard(organizationId, dashboardConfig);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Dashboard creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/observability/tenant/:organizationId/dashboards', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const result = await this.tenantObservability.getTenantDashboards(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant dashboards fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/observability/tenant/:organizationId/dashboards/:dashboardId', async (request, reply) => {
      try {
        const { dashboardId } = request.params;
        const result = await this.tenantObservability.getDashboard(dashboardId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Dashboard fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/observability/tenant/:organizationId/alerts', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const ruleConfig = request.body;
        const result = await this.tenantObservability.createAlertRule(organizationId, ruleConfig);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Alert rule creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/observability/tenant/:organizationId/alerts/evaluate', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const result = await this.tenantObservability.evaluateAlertRules(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Alert evaluation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/observability/tenant/:organizationId/audit', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const auditData = request.body;
        const result = await this.tenantObservability.createAuditTrail(organizationId, auditData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Audit trail creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/observability/tenant/:organizationId/audit', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const filters = request.query;
        const result = await this.tenantObservability.getAuditTrails(organizationId, filters);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Audit trails fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Security APIs (RBAC)
    this.app.post('/api/security/roles', async (request, reply) => {
      try {
        const roleData = request.body;
        const result = await this.rbac.createRole(roleData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Role creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/roles/:roleId/assign', async (request, reply) => {
      try {
        const { roleId } = request.params;
        const { userId, organizationId } = request.body;
        
        if (!userId || !organizationId) {
          return reply.code(400).send({ 
            error: 'userId and organizationId are required' 
          });
        }

        const result = await this.rbac.assignRoleToUser(userId, roleId, organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Role assignment error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/security/users/:userId/roles', async (request, reply) => {
      try {
        const { userId } = request.params;
        const { organizationId } = request.query;
        
        if (!organizationId) {
          return reply.code(400).send({ 
            error: 'organizationId is required' 
          });
        }

        const result = await this.rbac.getUserRoles(userId, organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('User roles fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/permissions/check', async (request, reply) => {
      try {
        const { userId, organizationId, permission, resource } = request.body;
        
        if (!userId || !organizationId || !permission) {
          return reply.code(400).send({ 
            error: 'userId, organizationId, and permission are required' 
          });
        }

        const result = await this.rbac.checkPermission(userId, organizationId, permission, resource);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Permission check error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/api-keys', async (request, reply) => {
      try {
        const apiKeyData = request.body;
        const result = await this.rbac.createAPIKey(apiKeyData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('API key creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/api-keys/validate', async (request, reply) => {
      try {
        const { key } = request.body;
        
        if (!key) {
          return reply.code(400).send({ 
            error: 'API key is required' 
          });
        }

        const result = await this.rbac.validateAPIKey(key);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('API key validation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/api-keys/:apiKeyId/rate-limit', async (request, reply) => {
      try {
        const { apiKeyId } = request.params;
        const { endpoint } = request.body;
        
        if (!endpoint) {
          return reply.code(400).send({ 
            error: 'endpoint is required' 
          });
        }

        const result = await this.rbac.checkRateLimit(apiKeyId, endpoint);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Rate limit check error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.delete('/api/security/api-keys/:apiKeyId', async (request, reply) => {
      try {
        const { apiKeyId } = request.params;
        const result = await this.rbac.revokeAPIKey(apiKeyId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('API key revocation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/security/api-keys', async (request, reply) => {
      try {
        const { organizationId } = request.query;
        
        if (!organizationId) {
          return reply.code(400).send({ 
            error: 'organizationId is required' 
          });
        }

        const result = await this.rbac.getAPIKeys(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('API keys fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/scopes', async (request, reply) => {
      try {
        const scopeData = request.body;
        const result = await this.rbac.createScope(scopeData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Scope creation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/scopes/:scopeId/assign', async (request, reply) => {
      try {
        const { scopeId } = request.params;
        const { roleId } = request.body;
        
        if (!roleId) {
          return reply.code(400).send({ 
            error: 'roleId is required' 
          });
        }

        const result = await this.rbac.assignScopeToRole(roleId, scopeId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Scope assignment error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/security/roles/:roleId/scopes', async (request, reply) => {
      try {
        const { roleId } = request.params;
        const result = await this.rbac.getRoleScopes(roleId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Role scopes fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/tokens', async (request, reply) => {
      try {
        const { userId, organizationId, permissions = [] } = request.body;
        
        if (!userId || !organizationId) {
          return reply.code(400).send({ 
            error: 'userId and organizationId are required' 
          });
        }

        const result = await this.rbac.generateJWTToken(userId, organizationId, permissions);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('JWT token generation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/security/tokens/validate', async (request, reply) => {
      try {
        const { token } = request.body;
        
        if (!token) {
          return reply.code(400).send({ 
            error: 'token is required' 
          });
        }

        const result = await this.rbac.validateJWTToken(token);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('JWT token validation error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Agricultural APIs
    this.registerAgriculturalRoutes();

    // Real-time APIs
    this.registerRealtimeRoutes();

    // Analytics and Workflow APIs
    this.registerAnalyticsAndWorkflowRoutes();

    // Multi-tenancy APIs
    this.app.get('/api/multitenancy/tiers', async (request, reply) => {
      try {
        const result = await this.multitenancy.initializeTenantTiers();
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant tiers fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/multitenancy/organizations/:organizationId/tier', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const { tierId } = request.body;
        
        if (!tierId) {
          return reply.code(400).send({ 
            error: 'tierId is required' 
          });
        }

        const result = await this.multitenancy.assignTenantTier(organizationId, tierId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant tier assignment error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/multitenancy/organizations/:organizationId/limits', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const { resourceType, currentUsage } = request.query;
        
        if (!resourceType || currentUsage === undefined) {
          return reply.code(400).send({ 
            error: 'resourceType and currentUsage are required' 
          });
        }

        const result = await this.multitenancy.checkTenantLimits(
          organizationId, 
          resourceType, 
          parseInt(currentUsage)
        );
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant limits check error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/multitenancy/organizations/:organizationId/migrate', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const { targetTier, options = {} } = request.body;
        
        if (!targetTier) {
          return reply.code(400).send({ 
            error: 'targetTier is required' 
          });
        }

        const result = await this.multitenancy.startTenantMigration(organizationId, targetTier, options);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant migration start error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/multitenancy/migrations/:jobId', async (request, reply) => {
      try {
        const { jobId } = request.params;
        const result = await this.multitenancy.getMigrationJobStatus(jobId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Migration job status error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/multitenancy/organizations/:organizationId/migrations', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const result = await this.multitenancy.getAllMigrationJobs(organizationId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Migration jobs list error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.post('/api/multitenancy/organizations/:organizationId/export', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const exportOptions = request.body;
        const result = await this.multitenancy.exportTenantData(organizationId, exportOptions);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Tenant data export error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    this.app.get('/api/multitenancy/organizations/:organizationId/slo', async (request, reply) => {
      try {
        const { organizationId } = request.params;
        const { timeRange = '24h' } = request.query;
        const result = await this.multitenancy.getSLOMetrics(organizationId, timeRange);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('SLO metrics fetch error:', error);
        return reply.code(500).send({ error: error.message });
      }
    });

    // Simple Analytics KPIs for dashboard
    this.app.get('/api/analytics/dashboard', async (request, reply) => {
      try {
        const organizationId = (request.user && request.user.organizationId) || 'demo-org';
        const safeCount = async (model) => {
          try { return await this.prisma[model].count({ where: { organizationId } }); } catch { return 0; }
        };

        const [totalUsers, totalProducts, totalOrders] = await Promise.all([
          safeCount('user'),
          safeCount('product'),
          safeCount('order')
        ]);

        const uptime = process.uptime();
        const memory = process.memoryUsage();

        // derive simple health score (mocked/derived)
        const healthScore = 100 - Math.min(40, Math.round((memory.heapUsed / memory.heapTotal) * 100));

        reply.send({
          success: true,
          data: {
            kpis: {
              totalUsers,
              totalProducts,
              totalOrders,
              systemHealth: healthScore,
              uptimeSeconds: Math.round(uptime)
            }
          }
        });
      } catch (err) {
        reply.code(500).send({ success: false, error: 'Failed to compute analytics' });
      }
    });

    // Mock authentication for demo
    this.app.addHook('preHandler', async (request, reply) => {
      // Skip auth for health and static files
      if (request.url.startsWith('/health') || 
          request.url.startsWith('/admin/') || 
          request.url.startsWith('/docs') ||
          request.url.startsWith('/api') ||
          request.url === '/') {
        // Mock user for demo
        request.user = {
          id: 'demo-user',
          email: 'admin@orchestrall.com',
          organizationId: 'demo-org',
          name: 'Demo Admin'
        };
      }
    });

    // Register Universal CRUD routes
    await this.app.register(universalCRUDRoutes, { prisma: this.prisma, broadcast });

    // Wire notifications to events (example rules)
    this.eventBus.on('crud:create', async (payload) => {
      try {
        await this.notifications.processEvent({
          name: 'crud:create',
          payload: { ...payload, message: `Created ${payload.entityName}` }
        });
      } catch (_) {}
    });

    // Minimal notification API
    this.app.post('/api/notifications/test', async (request, reply) => {
      const { type = 'email', to, subject, message, html } = request.body || {};
      try {
        const res = await this.notifications.notify({ type, to, subject, message, html });
        reply.send({ success: true, result: res });
      } catch (err) {
        reply.code(400).send({ success: false, error: err.message });
      }
    });

    // Demo login endpoint
    this.app.post('/api/auth/login', async (request, reply) => {
      const { email, password } = request.body;
      
      if (email === 'admin@orchestrall.com' && password === 'admin123') {
        const token = this.app.jwt.sign({
          id: 'demo-user',
          email: 'admin@orchestrall.com',
          organizationId: 'demo-org'
        });
        
        return {
          success: true,
          token,
          user: {
            id: 'demo-user',
            email: 'admin@orchestrall.com',
            name: 'Demo Admin',
            organizationId: 'demo-org'
          }
        };
      }
      
      reply.code(401).send({ error: 'Invalid credentials' });
    });
  }

  createMockPrisma() {
    // Mock Prisma client for demo purposes
    const mockData = {
      organizations: [
        { id: 'org1', name: 'Kankatala', slug: 'kankatala', tier: 'premium', status: 'active', createdAt: new Date() },
        { id: 'org2', name: 'Kisaansay', slug: 'kisaansay', tier: 'premium', status: 'active', createdAt: new Date() }
      ],
      users: [
        { id: 'user1', email: 'admin@kankatala.com', name: 'Kankatala Admin', status: 'active', createdAt: new Date() },
        { id: 'user2', email: 'admin@kisaansay.com', name: 'Kisaansay Admin', status: 'active', createdAt: new Date() }
      ],
      products: [
        { id: 'prod1', name: 'Sample Product', description: 'A sample product', price: 99.99, sku: 'SKU001', status: 'active', createdAt: new Date() }
      ]
    };

    return {
      organization: {
        findMany: (args) => Promise.resolve(mockData.organizations),
        findFirst: (args) => Promise.resolve(mockData.organizations[0]),
        create: (args) => Promise.resolve({ id: 'new-org', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: (args) => Promise.resolve(mockData.organizations.length)
      },
      user: {
        findMany: (args) => Promise.resolve(mockData.users),
        findFirst: (args) => Promise.resolve(mockData.users[0]),
        create: (args) => Promise.resolve({ id: 'new-user', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: (args) => Promise.resolve(mockData.users.length)
      },
      product: {
        findMany: (args) => Promise.resolve(mockData.products),
        findFirst: (args) => Promise.resolve(mockData.products[0]),
        create: (args) => Promise.resolve({ id: 'new-prod', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: (args) => Promise.resolve(mockData.products.length)
      },
      team: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-team', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      },
      order: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-order', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      },
      customer: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-customer', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      },
      story: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-story', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      },
      crop: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-crop', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      },
      store: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-store', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      },
      voiceCall: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: (args) => Promise.resolve({ id: 'new-call', ...args.data, createdAt: new Date() }),
        update: (args) => Promise.resolve({ id: args.where.id, ...args.data, updatedAt: new Date() }),
        delete: (args) => Promise.resolve({ success: true }),
        count: () => Promise.resolve(0)
      }
    };
  }

  addErrorHandling() {
    // Use the comprehensive error handler
    this.app.setErrorHandler(this.errorHandler.errorHandler());
    
    this.app.setNotFoundHandler(this.errorHandler.notFoundHandler());

  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const port = process.env.PORT || 3000;
      const host = process.env.HOST || '0.0.0.0';
      
      await this.app.listen({ port, host });
      
      console.log('🎉 Zero-Config Orchestrall Platform Started!');
      console.log(`📱 Admin Dashboard: http://localhost:${port}/admin/`);
      console.log(`📚 API Documentation: http://localhost:${port}/docs`);
      console.log(`🔍 Health Check: http://localhost:${port}/health`);
      console.log(`🔑 Demo Login: admin@orchestrall.com / admin123`);
      console.log('');
      console.log('✨ Features Ready:');
      console.log('  • Universal CRUD APIs for all entities');
      console.log('  • Professional admin dashboard');
      console.log('  • Multi-tenant support');
      console.log('  • Auto-setup database');
      console.log('  • Zero configuration required');
      console.log('');
      console.log('🚀 Ready for production use!');
      
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  }

  registerAgriculturalRoutes() {
    // Secure agricultural routes with authentication and validation
    
    // Farmer Management Routes
    this.app.post('/api/agricultural/farmers', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware),
        this.validationService.validateBody('farmerProfile').bind(this.validationService)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.farmerManagement.registerFarmer(request.validatedData);
          reply.send(this.errorHandler.successResponse(result, 'Farmer registered successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/agricultural/farmers/:id', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.farmerManagement.getFarmerProfile(request.params.id);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    // Crop Monitoring Routes
    this.app.post('/api/agricultural/crops', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware),
        this.validationService.validateBody('crop').bind(this.validationService)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.cropMonitoring.addCrop(request.validatedData);
          reply.send(this.errorHandler.successResponse(result, 'Crop added successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/agricultural/crops/:id/health', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.cropMonitoring.analyzeCropHealth(request.params.id);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    // Market Intelligence Routes
    this.app.get('/api/agricultural/market/prices/:cropType', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.marketIntelligence.getCropPrices(request.params.cropType, request.query.location);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    // Weather Integration Routes
    this.app.get('/api/agricultural/weather/current/:location', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.weatherIntegration.getCurrentWeather(request.params.location);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    // Financial Services Routes
    this.app.post('/api/agricultural/loans', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware),
        this.validationService.validateBody('loanApplication').bind(this.validationService)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.agriculturalFinance.applyForLoan(request.user.id, request.validatedData);
          reply.send(this.errorHandler.successResponse(result, 'Loan application submitted'));
        } catch (error) {
          throw error;
        }
      }
    });

    console.log('✅ Agricultural routes registered with authentication and validation');
  }

  registerRealtimeRoutes() {
    // WebSocket connection endpoint (handled by WebSocketServer)
    // SSE endpoint (handled by SSEServer)
    
    // Push Notification Routes
    this.app.post('/api/notifications/push/subscribe', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.pushService.subscribeUser(request.user.userId, request.body);
          reply.send(this.errorHandler.successResponse(result, 'Push subscription created'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/notifications/push/unsubscribe', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          await this.pushService.unsubscribeUser(request.user.userId, request.body.endpoint);
          reply.send(this.errorHandler.successResponse(null, 'Push subscription removed'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/notifications/push/vapid-key', async (request, reply) => {
      try {
        const publicKey = await this.pushService.getVapidPublicKey();
        reply.send(this.errorHandler.successResponse({ publicKey }));
      } catch (error) {
        throw error;
      }
    });

    // SMS Routes
    this.app.post('/api/notifications/sms/send', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.smsService.sendSMS(request.body.to, request.body.message, {
            userId: request.user.userId,
            type: request.body.type || 'general',
            subject: request.body.subject
          });
          reply.send(this.errorHandler.successResponse(result, 'SMS sent successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/notifications/sms/bulk', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.smsService.sendToFarmers(request.body.farmerIds, request.body.message, {
            userId: request.user.userId,
            type: request.body.type || 'general',
            subject: request.body.subject
          });
          reply.send(this.errorHandler.successResponse(result, 'Bulk SMS sent successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    // Email Routes
    this.app.post('/api/notifications/email/send', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.emailService.sendEmail(request.body.to, request.body.subject, request.body.html, {
            userId: request.user.userId,
            type: request.body.type || 'general'
          });
          reply.send(this.errorHandler.successResponse(result, 'Email sent successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/notifications/email/bulk', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.emailService.sendToFarmers(request.body.farmerIds, request.body.subject, request.body.html, {
            userId: request.user.userId,
            type: request.body.type || 'general'
          });
          reply.send(this.errorHandler.successResponse(result, 'Bulk email sent successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    // Payment Routes
    this.app.post('/api/payments/create', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.razorpay.createOrder({
            ...request.body,
            farmerId: request.user.userId,
            organizationId: request.user.organizationId
          });
          reply.send(this.errorHandler.successResponse(result, 'Payment order created'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/payments/verify', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.razorpay.verifyPayment(
            request.body.paymentId,
            request.body.razorpayPaymentId,
            request.body.razorpaySignature
          );
          reply.send(this.errorHandler.successResponse(result, 'Payment verified'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/payments/refund', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.razorpay.processRefund(request.body.paymentId, request.body.refundData);
          reply.send(this.errorHandler.successResponse(result, 'Refund processed'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/payments/history', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'farmer']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.razorpay.getPaymentHistory(request.user.userId, request.query);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    // Razorpay Webhook
    this.app.post('/api/payments/webhook', async (request, reply) => {
      try {
        await this.razorpay.handleWebhook(request.body);
        reply.send({ success: true });
      } catch (error) {
        this.app.log.error('Webhook error:', error);
        reply.code(400).send({ error: error.message });
      }
    });

    // Voice Integration Routes
    this.app.post('/api/voice/process', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { audioData, farmerId, language = 'hi' } = request.body;
          
          if (!audioData || !farmerId) {
            return reply.code(400).send({
              error: 'Missing required fields: audioData, farmerId'
            });
          }

          const result = await this.sarvamVoice.processVoiceInput(audioData, farmerId, language);
          reply.send(this.errorHandler.successResponse(result, 'Voice processed successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/voice/languages', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const languages = await this.sarvamVoice.getSupportedLanguages();
          reply.send(this.errorHandler.successResponse(languages));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/voice/commands', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const commands = Array.from(this.sarvamVoice.voiceCommands.values()).map(cmd => ({
            id: cmd.id,
            name: cmd.name,
            patterns: cmd.patterns.map(p => ({
              language: p.language,
              pattern: p.pattern
            })),
            requiredData: cmd.requiredData
          }));
          reply.send(this.errorHandler.successResponse(commands));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/voice/analytics', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId, dateFrom, dateTo } = request.query;
          
          if (!organizationId) {
            return reply.code(400).send({
              error: 'Missing required parameter: organizationId'
            });
          }

          const analytics = await this.sarvamVoice.getCallAnalytics(organizationId, {
            dateFrom,
            dateTo
          });
          reply.send(this.errorHandler.successResponse(analytics));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/voice/history/:farmerId', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { farmerId } = request.params;
          const { limit = 10, offset = 0 } = request.query;

          const calls = await this.prisma.voiceCall.findMany({
            where: { farmerId },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset),
            select: {
              id: true,
              sessionId: true,
              language: true,
              duration: true,
              status: true,
              transcription: true,
              command: true,
              response: true,
              createdAt: true,
              metadata: true
            }
          });

          const totalCount = await this.prisma.voiceCall.count({
            where: { farmerId }
          });
          
          reply.send(this.errorHandler.successResponse({
            calls,
            pagination: {
              total: totalCount,
              limit: parseInt(limit),
              offset: parseInt(offset),
              hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
            }
          }));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/voice/test', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { transcription, farmerId, language = 'hi' } = request.body;
          
          if (!transcription || !farmerId) {
            return reply.code(400).send({
              error: 'Missing required fields: transcription, farmerId'
            });
          }

          const command = await this.sarvamVoice.identifyCommand(transcription, language);
          const response = await this.sarvamVoice.executeCommand(command, farmerId, language);
          
          reply.send(this.errorHandler.successResponse({
            transcription,
            command: command.id,
            response: response.text,
            language
          }));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/voice/stats', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId } = request.query;
          
          if (!organizationId) {
            return reply.code(400).send({
              error: 'Missing required parameter: organizationId'
            });
          }

          const stats = await this.prisma.voiceCall.groupBy({
            by: ['status'],
            where: {
              farmer: {
                organizationId
              },
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            },
            _count: {
              id: true
            }
          });

          const totalCalls = await this.prisma.voiceCall.count({
            where: {
              farmer: {
                organizationId
              },
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          });

          const avgDuration = await this.prisma.voiceCall.aggregate({
            where: {
              farmer: {
                organizationId
              },
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            },
            _avg: {
              duration: true
            }
          });

          const languageStats = await this.prisma.voiceCall.groupBy({
            by: ['language'],
            where: {
              farmer: {
                organizationId
              },
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            },
            _count: {
              id: true
            }
          });
          
          reply.send(this.errorHandler.successResponse({
            totalCalls,
            averageDuration: Math.round(avgDuration._avg.duration || 0),
            statusDistribution: stats.map(s => ({
              status: s.status,
              count: s._count.id
            })),
            languageDistribution: languageStats.map(l => ({
              language: l.language,
              count: l._count.id
            }))
          }));
        } catch (error) {
          throw error;
        }
      }
    });

    // Observability Routes
    this.app.get('/metrics', async (request, reply) => {
      try {
        const metrics = await this.observability.getPrometheusMetrics();
        reply.type('text/plain').send(metrics);
      } catch (error) {
        console.error('Failed to get Prometheus metrics:', error);
        reply.status(500).send('Failed to get metrics');
      }
    });

    this.app.get('/api/observability/health', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId } = request.query;
          const health = await this.observability.getSystemHealth(organizationId);
          reply.send(this.errorHandler.successResponse(health));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/observability/metrics', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId } = request.query;
          const metrics = await this.observability.getKeyMetrics(organizationId);
          reply.send(this.errorHandler.successResponse(metrics));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/observability/performance', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId, timeRange = '24h' } = request.query;
          const performance = await this.observability.getPerformanceMetrics(organizationId, timeRange);
          reply.send(this.errorHandler.successResponse(performance));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/observability/business', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId, timeRange = '30d' } = request.query;
          const businessMetrics = await this.observability.getBusinessMetrics(organizationId, timeRange);
          reply.send(this.errorHandler.successResponse(businessMetrics));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/observability/alerts', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { organizationId, status = 'active', limit = 50 } = request.query;
          
          const alerts = await this.prisma.alert.findMany({
            where: {
              status,
              ...(organizationId && { 
                metadata: {
                  path: ['organizationId'],
                  equals: organizationId
                }
              })
            },
            orderBy: { triggeredAt: 'desc' },
            take: parseInt(limit)
          });
          
          reply.send(this.errorHandler.successResponse(alerts));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/observability/alerts/:alertId/acknowledge', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { alertId } = request.params;
          const { acknowledgedBy } = request.body;
          
          const alert = await this.prisma.alert.update({
            where: { id: alertId },
            data: {
              status: 'acknowledged',
              acknowledgedAt: new Date(),
              acknowledgedBy
            }
          });
          
          reply.send(this.errorHandler.successResponse(alert, 'Alert acknowledged successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/observability/alerts/:alertId/resolve', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { alertId } = request.params;
          
          const alert = await this.prisma.alert.update({
            where: { id: alertId },
            data: {
              status: 'resolved',
              resolvedAt: new Date()
            }
          });
          
          reply.send(this.errorHandler.successResponse(alert, 'Alert resolved successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/observability/grafana/dashboard', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const dashboardConfig = this.observability.getGrafanaDashboardConfig();
          reply.send(this.errorHandler.successResponse(dashboardConfig));
        } catch (error) {
          throw error;
        }
      }
    });

    // Multi-tenancy Routes
    this.app.post('/api/tenants', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { name, slug, tier = 'starter', customConfig = {} } = request.body;

          if (!name || !slug) {
            return reply.code(400).send({
              error: 'Missing required fields: name, slug'
            });
          }

          const result = await this.multitenancy.createTenant({
            name,
            slug,
            tier,
            customConfig
          });

          reply.send(this.errorHandler.successResponse(result.data, 'Tenant created successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/tenants', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const tenants = this.multitenancy.getAllTenants();
          reply.send(this.errorHandler.successResponse(tenants));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/tenants/:tenantId', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { tenantId } = request.params;
          const config = this.multitenancy.getTenantConfig(tenantId);

          if (!config) {
            return reply.code(404).send({
              error: 'Tenant not found'
            });
          }

          reply.send(this.errorHandler.successResponse(config));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/tenants/:tenantId/usage', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { tenantId } = request.params;
          const result = await this.multitenancy.getTenantUsage(tenantId);
          reply.send(this.errorHandler.successResponse(result.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/tenants/:tenantId/analytics', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { tenantId } = request.params;
          const { timeRange = '30d' } = request.query;
          const result = await this.multitenancy.getTenantAnalytics(tenantId, timeRange);
          reply.send(this.errorHandler.successResponse(result.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/tenants/:tenantId/migrate', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { tenantId } = request.params;
          const { targetIsolationMode } = request.body;

          if (!targetIsolationMode) {
            return reply.code(400).send({
              error: 'Missing required field: targetIsolationMode'
            });
          }

          const result = await this.multitenancy.migrateTenantData(tenantId, targetIsolationMode);
          reply.send(this.errorHandler.successResponse(result, 'Tenant migration initiated'));
        } catch (error) {
          throw error;
        }
      }
    });

    // Backup & Recovery Routes
    this.app.post('/api/backup/full', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const options = request.body || {};
          const result = await this.backupRecovery.createFullBackup(options);
          reply.send(this.errorHandler.successResponse(result.data, 'Full backup created successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/backup/incremental', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const options = request.body || {};
          const result = await this.backupRecovery.createIncrementalBackup(options);
          reply.send(this.errorHandler.successResponse(result.data, 'Incremental backup created successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/backup/tenant/:tenantId', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { tenantId } = request.params;
          const options = request.body || {};
          const result = await this.backupRecovery.createTenantBackup(tenantId, options);
          reply.send(this.errorHandler.successResponse(result.data, `Tenant backup created successfully for ${tenantId}`));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/backup', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { type, status, limit = 50, offset = 0 } = request.query;
          const result = await this.backupRecovery.getBackupList({
            type,
            status,
            limit: parseInt(limit),
            offset: parseInt(offset)
          });
          reply.send(this.errorHandler.successResponse(result.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/restore/:backupId', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { backupId } = request.params;
          const options = request.body || {};
          const result = await this.backupRecovery.restoreFromBackup(backupId, options);
          reply.send(this.errorHandler.successResponse(result.data, 'Restore initiated successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/backup/health', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const recentBackup = await this.prisma.backupRecord.findFirst({
            where: {
              status: 'completed',
              type: 'full'
            },
            orderBy: { endTime: 'desc' }
          });

          const health = {
            status: 'healthy',
            lastFullBackup: recentBackup ? {
              id: recentBackup.id,
              endTime: recentBackup.endTime,
              size: recentBackup.size,
              ageHours: recentBackup.endTime ? 
                Math.floor((Date.now() - recentBackup.endTime.getTime()) / (1000 * 60 * 60)) : null
            } : null,
            warnings: []
          };

          if (!recentBackup) {
            health.warnings.push('No full backup found');
            health.status = 'warning';
          } else if (recentBackup.endTime) {
            const ageHours = Math.floor((Date.now() - recentBackup.endTime.getTime()) / (1000 * 60 * 60));
            if (ageHours > 48) {
              health.warnings.push(`Last full backup is ${ageHours} hours old`);
              health.status = 'warning';
            }
          }

          reply.send(this.errorHandler.successResponse(health));
        } catch (error) {
          throw error;
        }
      }
    });

    // Performance Optimization Routes
    this.app.get('/api/performance/metrics', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const metrics = await this.performanceOptimization.getPerformanceMetrics();
          reply.send(this.errorHandler.successResponse(metrics));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/performance/cache/warm', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          await this.performanceOptimization.warmCache();
          reply.send(this.errorHandler.successResponse(null, 'Cache warming completed'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/performance/cache/clear', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { pattern } = request.body;
          await this.performanceOptimization.clear(pattern);
          reply.send(this.errorHandler.successResponse(null, 'Cache cleared successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/performance/queries/slow', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const analysis = await this.performanceOptimization.analyzeSlowQueries();
          reply.send(this.errorHandler.successResponse(analysis));
        } catch (error) {
          throw error;
        }
      }
    });

    // Internationalization Routes
    this.app.get('/api/i18n/languages', {
      handler: async (request, reply) => {
        try {
          const languages = this.internationalization.getSupportedLanguages().map(lang => ({
            code: lang,
            name: this.internationalization.getLanguageName(lang)
          }));
          reply.send(this.errorHandler.successResponse(languages));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/i18n/translations/:language', {
      handler: async (request, reply) => {
        try {
          const { language } = request.params;
          const translations = this.internationalization.translations.get(language);
          reply.send(this.errorHandler.successResponse(translations));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/i18n/voice-commands/:language', {
      handler: async (request, reply) => {
        try {
          const { language } = request.params;
          const commands = this.internationalization.getLocalizedVoiceCommands(language);
          reply.send(this.errorHandler.successResponse(commands));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/i18n/user-language', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'user']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { language } = request.body;
          const userId = request.user.id;
          
          await this.internationalization.setUserLanguagePreference(userId, language);
          reply.send(this.errorHandler.successResponse(null, 'Language preference updated'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/i18n/user-language', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'user']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const userId = request.user.id;
          const language = await this.internationalization.getUserLanguagePreference(userId);
          reply.send(this.errorHandler.successResponse({ language }));
        } catch (error) {
          throw error;
        }
      }
    });

    // Client Onboarding Routes
    this.app.get('/api/onboarding/templates', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const templates = await this.clientOnboarding.getOnboardingTemplates();
          reply.send(this.errorHandler.successResponse(templates.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/onboarding/start', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { clientId, templateId, options } = request.body;
          const result = await this.clientOnboarding.startOnboarding(clientId, templateId, options);
          reply.send(this.errorHandler.successResponse(result.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/onboarding/status/:clientId', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'user']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { clientId } = request.params;
          const status = await this.clientOnboarding.getOnboardingStatus(clientId);
          reply.send(this.errorHandler.successResponse(status.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/onboarding/step/:sessionId/:stepNumber', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { sessionId, stepNumber } = request.params;
          const result = await this.clientOnboarding.executeOnboardingStep(sessionId, parseInt(stepNumber));
          reply.send(this.errorHandler.successResponse(result.data));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/onboarding/history/:clientId', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const { clientId } = request.params;
          const history = await this.clientOnboarding.getClientOnboardingHistory(clientId);
          reply.send(this.errorHandler.successResponse(history.data));
        } catch (error) {
          throw error;
        }
      }
    });

    console.log('✅ Real-time routes registered with authentication and validation');
  }

  registerAnalyticsAndWorkflowRoutes() {
    // Analytics Routes
    this.app.get('/api/analytics/farmers', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.analytics.getFarmerAnalytics(request.user.organizationId, request.query);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/analytics/crops', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.analytics.getCropAnalytics(request.user.organizationId, request.query);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/analytics/market', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.analytics.getMarketAnalytics(request.user.organizationId, request.query);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/analytics/financial', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.analytics.getFinancialAnalytics(request.user.organizationId, request.query);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/analytics/dashboard', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.analytics.getDashboardKPIs(request.user.organizationId);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/analytics/reports/generate', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager', 'analyst']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.analytics.generateCustomReport(request.user.organizationId, request.body);
          reply.send(this.errorHandler.successResponse(result, 'Custom report generated successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    // Workflow Routes
    this.app.get('/api/workflows/templates', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.workflowOrchestration.getWorkflowTemplates();
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/workflows/create', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.workflowOrchestration.createWorkflow(
            request.body.templateId,
            {
              ...request.body.context,
              organizationId: request.user.organizationId,
              userId: request.user.userId
            },
            request.body.options
          );
          reply.send(this.errorHandler.successResponse(result, 'Workflow created successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/workflows/:workflowId/execute', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.workflowOrchestration.executeWorkflow(request.params.workflowId);
          reply.send(this.errorHandler.successResponse(result, 'Workflow executed successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/workflows/:workflowId/status', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.workflowOrchestration.getWorkflowStatus(request.params.workflowId);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.get('/api/workflows/active', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.workflowOrchestration.getActiveWorkflows(request.user.organizationId);
          reply.send(this.errorHandler.successResponse(result));
        } catch (error) {
          throw error;
        }
      }
    });

    this.app.post('/api/workflows/trigger', {
      preHandler: [
        this.authMiddleware.verifyToken.bind(this.authMiddleware),
        this.authMiddleware.requireRole(['admin', 'manager']).bind(this.authMiddleware)
      ],
      handler: async (request, reply) => {
        try {
          const result = await this.workflowOrchestration.triggerWorkflow(
            request.body.templateId,
            {
              ...request.body.context,
              organizationId: request.user.organizationId,
              userId: request.user.userId
            }
          );
          reply.send(this.errorHandler.successResponse(result, 'Workflow triggered successfully'));
        } catch (error) {
          throw error;
        }
      }
    });

    console.log('✅ Analytics and workflow routes registered with authentication and validation');
  }

    // Farmer Management APIs
    this.app.post('/api/agricultural/farmers/register', async (request, reply) => {
      try {
        const farmerData = request.body;
        const result = await this.farmerManagement.registerFarmer(farmerData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Farmer registration error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/farmers/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const result = await this.farmerManagement.getFarmerProfile(farmerId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Farmer profile error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.put('/api/agricultural/farmers/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const updateData = request.body;
        const result = await this.farmerManagement.updateFarmerProfile(farmerId, updateData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Farmer profile update error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.post('/api/agricultural/farmers/verify/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const verificationData = request.body;
        const result = await this.farmerManagement.verifyFarmer(farmerId, verificationData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Farmer verification error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/farmers', async (request, reply) => {
      try {
        const searchCriteria = request.query;
        const result = await this.farmerManagement.searchFarmers(searchCriteria);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Farmer search error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/farmers/statistics', async (request, reply) => {
      try {
        const result = await this.farmerManagement.getFarmerStatistics();
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Farmer statistics error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    // Market Intelligence APIs
    this.app.get('/api/agricultural/market/prices', async (request, reply) => {
      try {
        const { cropType, location } = request.query;
        const result = await this.marketIntelligence.getCurrentPrices(cropType, location);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Market prices error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/market/trends/:cropType', async (request, reply) => {
      try {
        const { cropType } = request.params;
        const { period } = request.query;
        const result = await this.marketIntelligence.analyzePriceTrends(cropType, period);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Price trends error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.post('/api/agricultural/market/selling-recommendation', async (request, reply) => {
      try {
        const { farmerId, cropType, quantity, location } = request.body;
        const result = await this.marketIntelligence.getOptimalSellingRecommendation(farmerId, cropType, quantity, location);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Selling recommendation error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/market/alerts/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const { alertTypes } = request.query;
        const types = alertTypes ? alertTypes.split(',') : ['price_drop', 'price_spike', 'weather_warning'];
        const result = await this.marketIntelligence.getMarketAlerts(farmerId, types);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Market alerts error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/market/supply-demand/:cropType', async (request, reply) => {
      try {
        const { cropType } = request.params;
        const { region } = request.query;
        const result = await this.marketIntelligence.getSupplyDemandAnalysis(cropType, region);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Supply-demand analysis error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    // Agricultural Financial Services APIs
    this.app.post('/api/agricultural/finance/credit-score/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const result = await this.agriculturalFinance.calculateCreditScore(farmerId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Credit score calculation error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.post('/api/agricultural/finance/loan-application', async (request, reply) => {
      try {
        const loanData = request.body;
        const result = await this.agriculturalFinance.processLoanApplication(loanData.farmerId, loanData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Loan application error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.post('/api/agricultural/finance/insurance-claim', async (request, reply) => {
      try {
        const claimData = request.body;
        const result = await this.agriculturalFinance.processInsuranceClaim(claimData.farmerId, claimData);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Insurance claim error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/finance/dashboard/:farmerId', async (request, reply) => {
      try {
        const { farmerId } = request.params;
        const result = await this.agriculturalFinance.getFinancialDashboard(farmerId);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Financial dashboard error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    // Weather Integration APIs
    this.app.get('/api/agricultural/weather/current', async (request, reply) => {
      try {
        const { location, lat, lon } = request.query;
        const coordinates = lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : null;
        const result = await this.weatherIntegration.getCurrentWeather(location, coordinates);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Current weather error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/weather/forecast', async (request, reply) => {
      try {
        const { location, days, lat, lon } = request.query;
        const coordinates = lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : null;
        const result = await this.weatherIntegration.getWeatherForecast(location, parseInt(days) || 7, coordinates);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Weather forecast error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/weather/historical', async (request, reply) => {
      try {
        const { location, startDate, endDate, lat, lon } = request.query;
        const coordinates = lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : null;
        const result = await this.weatherIntegration.getHistoricalWeather(location, startDate, endDate, coordinates);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Historical weather error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.post('/api/agricultural/weather/alerts', async (request, reply) => {
      try {
        const { location, cropType, lat, lon } = request.body;
        const coordinates = lat && lon ? { lat: parseFloat(lat), lon: parseFloat(lon) } : null;
        const result = await this.weatherIntegration.generateWeatherAlerts(location, cropType, coordinates);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Weather alerts error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/weather/alerts/:location', async (request, reply) => {
      try {
        const { location } = request.params;
        const { activeOnly } = request.query;
        const result = await this.weatherIntegration.getWeatherAlerts(location, activeOnly !== 'false');
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Weather alerts fetch error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });

    this.app.get('/api/agricultural/weather/analytics/:location', async (request, reply) => {
      try {
        const { location } = request.params;
        const { period } = request.query;
        const result = await this.weatherIntegration.getWeatherAnalytics(location, period);
        return reply.send(result);
      } catch (error) {
        this.app.log.error('Weather analytics error:', error);
        return reply.code(500).send({ success: false, error: error.message });
      }
    });
  }

  async stop() {
    try {
      if (this.app) {
        await this.app.close();
      }
      if (this.databaseSetup) {
        await this.databaseSetup.cleanup();
      }
      console.log('✅ Server stopped gracefully');
    } catch (error) {
      console.error('❌ Error stopping server:', error.message);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new ZeroConfigServer();
  
  server.start().catch(error => {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = ZeroConfigServer;
