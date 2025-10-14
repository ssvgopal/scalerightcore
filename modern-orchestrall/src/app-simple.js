// src/app-simple.js - Simplified Orchestrall Platform (No Database Required)
const fastify = require('fastify');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuration
const config = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-12345',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};

// Create Fastify instance
const app = fastify({
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
});

// Register plugins
async function registerPlugins() {
  // CORS
  await app.register(require('@fastify/cors'), {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  // JWT
  await app.register(require('@fastify/jwt'), {
    secret: config.jwtSecret,
    sign: {
      expiresIn: config.jwtExpiresIn,
    },
  });

  // Swagger documentation
  await app.register(require('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'Orchestrall Platform API',
        description: 'Complete AI Agent Orchestration System',
        version: '2.0.0',
      },
      host: `${config.host}:${config.port}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'agents', description: 'AI Agent execution' },
        { name: 'health', description: 'Health checks' },
      ],
    },
  });

  await app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
  });
}

// In-memory storage for demo
const users = new Map();
const organizations = new Map();
const agentExecutions = [];

// Initialize demo data
function initializeDemoData() {
  // Create demo organization
  const orgId = 'org_demo';
  organizations.set(orgId, {
    id: orgId,
    name: 'Demo Organization',
    slug: 'demo-org',
    tier: 'enterprise',
    status: 'active',
    createdAt: new Date(),
  });

  // Create demo user
  const userId = 'user_demo';
  const hashedPassword = bcrypt.hashSync('admin123', 12);
  users.set(userId, {
    id: userId,
    email: 'admin@orchestrall.com',
    name: 'Admin User',
    password: hashedPassword,
    organizationId: orgId,
    status: 'active',
    roles: ['admin'],
    permissions: ['read', 'write', 'admin'],
    createdAt: new Date(),
  });

  console.log('✅ Demo data initialized');
  console.log('   Email: admin@orchestrall.com');
  console.log('   Password: admin123');
}

// Agent System
class AgentSystem {
  constructor() {
    this.agents = new Map();
    this.initializeAgents();
  }

  initializeAgents() {
    // Text Processor Agent
    this.agents.set('text-processor', {
      name: 'Text Processor',
      description: 'Content analysis, reading time estimation, and text processing',
      capabilities: ['content_analysis', 'reading_time', 'text_summarization', 'sentiment_analysis'],
      execute: this.executeTextProcessor.bind(this),
    });

    // Calculator Agent (Safe - No eval)
    this.agents.set('calculator', {
      name: 'Calculator',
      description: 'Safe mathematical operations and calculations',
      capabilities: ['arithmetic', 'algebra', 'statistics', 'geometry'],
      execute: this.executeCalculator.bind(this),
    });

    // Data Validator Agent
    this.agents.set('data-validator', {
      name: 'Data Validator',
      description: 'Multi-format validation (email, phone, URL, JSON)',
      capabilities: ['email_validation', 'phone_validation', 'url_validation', 'json_validation'],
      execute: this.executeDataValidator.bind(this),
    });

    // File Analyzer Agent
    this.agents.set('file-analyzer', {
      name: 'File Analyzer',
      description: 'File type detection, content statistics, and analysis',
      capabilities: ['file_type_detection', 'content_stats', 'metadata_extraction'],
      execute: this.executeFileAnalyzer.bind(this),
    });

    // JSON Validator Agent
    this.agents.set('json-validator', {
      name: 'JSON Validator',
      description: 'JSON parsing, formatting, and structure analysis',
      capabilities: ['json_parsing', 'json_formatting', 'schema_validation'],
      execute: this.executeJsonValidator.bind(this),
    });

    // URL Analyzer Agent
    this.agents.set('url-analyzer', {
      name: 'URL Analyzer',
      description: 'URL parsing, component extraction, and validation',
      capabilities: ['url_parsing', 'component_extraction', 'url_validation'],
      execute: this.executeUrlAnalyzer.bind(this),
    });

    // DateTime Processor Agent
    this.agents.set('datetime-processor', {
      name: 'DateTime Processor',
      description: 'Date parsing, time calculations, and timezone handling',
      capabilities: ['date_parsing', 'time_calculations', 'timezone_conversion'],
      execute: this.executeDateTimeProcessor.bind(this),
    });

    // String Manipulator Agent
    this.agents.set('string-manipulator', {
      name: 'String Manipulator',
      description: 'Text transformation, case conversion, and string operations',
      capabilities: ['text_transformation', 'case_conversion', 'string_operations'],
      execute: this.executeStringManipulator.bind(this),
    });

    // Number Analyzer Agent
    this.agents.set('number-analyzer', {
      name: 'Number Analyzer',
      description: 'Mathematical properties, prime detection, and number analysis',
      capabilities: ['mathematical_properties', 'prime_detection', 'number_analysis'],
      execute: this.executeNumberAnalyzer.bind(this),
    });

    // Echo Agent (for backward compatibility)
    this.agents.set('echo', {
      name: 'Echo',
      description: 'Returns input exactly as provided',
      capabilities: ['echo'],
      execute: this.executeEcho.bind(this),
    });
  }

  getAvailableAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
    }));
  }

  async executeAgent(agentName, input, context = {}) {
    const startTime = Date.now();
    
    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent '${agentName}' not found`);
      }

      console.log(`🤖 Executing agent: ${agentName}`);

      const result = await agent.execute(input, context);
      const duration = Date.now() - startTime;

      // Save execution
      agentExecutions.push({
        id: `exec_${Date.now()}`,
        agentName,
        input,
        result,
        duration,
        timestamp: new Date(),
        userId: context.userId,
      });

      return {
        success: true,
        result,
        metadata: {
          agentName,
          executionTime: new Date().toISOString(),
          duration,
          capabilities: agent.capabilities,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Agent execution failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          agentName,
          executionTime: new Date().toISOString(),
          duration,
        },
      };
    }
  }

  // Agent implementations
  async executeTextProcessor(input, context) {
    return {
      content: `Text analysis for: "${input}"`,
      wordCount: input.split(' ').length,
      characterCount: input.length,
      estimatedReadingTime: Math.ceil(input.split(' ').length / 200),
      analysis: 'This is a sample text analysis. In production, this would use OpenAI or other AI services.',
    };
  }

  async executeCalculator(input, context) {
    try {
      const result = this.safeEvaluate(input);
      return {
        content: `Calculation: ${input} = ${result}`,
        expression: input,
        result: result,
        isValid: true,
      };
    } catch (error) {
      return {
        content: `Invalid mathematical expression: ${input}`,
        expression: input,
        error: error.message,
        isValid: false,
      };
    }
  }

  safeEvaluate(expression) {
    const cleanExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
    if (!/^[0-9+\-*/().\s]+$/.test(cleanExpression)) {
      throw new Error('Invalid characters in expression');
    }

    const tokens = cleanExpression.match(/\d+\.?\d*|[+\-*/()]/g) || [];
    const stack = [];
    const operators = [];
    
    for (const token of tokens) {
      if (/\d+\.?\d*/.test(token)) {
        stack.push(parseFloat(token));
      } else if (['+', '-', '*', '/'].includes(token)) {
        operators.push(token);
      }
    }
    
    let result = stack[0];
    for (let i = 0; i < operators.length; i++) {
      const operator = operators[i];
      const nextNumber = stack[i + 1];
      
      switch (operator) {
        case '+':
          result += nextNumber;
          break;
        case '-':
          result -= nextNumber;
          break;
        case '*':
          result *= nextNumber;
          break;
        case '/':
          if (nextNumber === 0) throw new Error('Division by zero');
          result /= nextNumber;
          break;
      }
    }
    
    return result;
  }

  async executeDataValidator(input, context) {
    const validations = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[1-9][\d]{0,15}$/,
      url: /^https?:\/\/.+/,
    };

    const results = {};
    
    if (validations.email.test(input)) {
      results.email = { valid: true, type: 'email' };
    }
    
    if (validations.phone.test(input.replace(/[\s\-\(\)]/g, ''))) {
      results.phone = { valid: true, type: 'phone' };
    }
    
    if (validations.url.test(input)) {
      results.url = { valid: true, type: 'url' };
    }
    
    try {
      JSON.parse(input);
      results.json = { valid: true, type: 'json' };
    } catch {
      results.json = { valid: false, type: 'json', error: 'Invalid JSON' };
    }

    return {
      content: `Validation results for: ${input}`,
      input: input,
      validations: results,
      isValid: Object.values(results).some(v => v.valid),
    };
  }

  async executeFileAnalyzer(input, context) {
    const fileInfo = {
      name: input.split('/').pop() || input,
      size: Math.floor(Math.random() * 1000000),
      type: this.detectFileType(input),
      extension: input.split('.').pop() || 'unknown',
    };

    return {
      content: `File analysis for: ${fileInfo.name}`,
      fileInfo: fileInfo,
      metadata: {
        detectedType: fileInfo.type,
        estimatedSize: fileInfo.size,
        extension: fileInfo.extension,
      },
    };
  }

  detectFileType(filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    const typeMap = {
      'txt': 'text/plain',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
    };
    return typeMap[extension] || 'application/octet-stream';
  }

  async executeJsonValidator(input, context) {
    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      
      return {
        content: 'Valid JSON detected and formatted',
        input: input,
        parsed: parsed,
        formatted: formatted,
        isValid: true,
        size: input.length,
        depth: this.getJsonDepth(parsed),
      };
    } catch (error) {
      return {
        content: `Invalid JSON: ${error.message}`,
        input: input,
        error: error.message,
        isValid: false,
      };
    }
  }

  getJsonDepth(obj, depth = 0) {
    if (typeof obj !== 'object' || obj === null) return depth;
    return Math.max(...Object.values(obj).map(v => this.getJsonDepth(v, depth + 1)));
  }

  async executeUrlAnalyzer(input, context) {
    try {
      const url = new URL(input);
      
      return {
        content: `URL analysis for: ${input}`,
        url: input,
        components: {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 'default',
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
        },
        isValid: true,
        domain: url.hostname,
      };
    } catch (error) {
      return {
        content: `Invalid URL: ${input}`,
        url: input,
        error: error.message,
        isValid: false,
      };
    }
  }

  async executeDateTimeProcessor(input, context) {
    const now = new Date();
    const parsed = new Date(input);
    
    if (isNaN(parsed.getTime())) {
      return {
        content: `Invalid date/time: ${input}`,
        input: input,
        isValid: false,
        error: 'Could not parse date/time',
      };
    }

    const diff = parsed.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return {
      content: `Date/time analysis for: ${input}`,
      input: input,
      parsed: parsed.toISOString(),
      isValid: true,
      relativeTime: {
        days: days,
        hours: hours,
        isPast: diff < 0,
        isFuture: diff > 0,
      },
      timezone: parsed.getTimezoneOffset(),
    };
  }

  async executeStringManipulator(input, context) {
    const operations = {
      uppercase: input.toUpperCase(),
      lowercase: input.toLowerCase(),
      capitalize: input.charAt(0).toUpperCase() + input.slice(1).toLowerCase(),
      reverse: input.split('').reverse().join(''),
      length: input.length,
      words: input.split(' ').length,
      characters: input.split('').length,
    };

    return {
      content: `String manipulation results for: ${input}`,
      input: input,
      operations: operations,
      summary: {
        originalLength: input.length,
        wordCount: operations.words,
        characterCount: operations.characters,
      },
    };
  }

  async executeNumberAnalyzer(input, context) {
    const number = parseFloat(input);
    
    if (isNaN(number)) {
      return {
        content: `Invalid number: ${input}`,
        input: input,
        isValid: false,
        error: 'Not a valid number',
      };
    }

    const isPrime = this.isPrime(number);
    const isEven = number % 2 === 0;
    const isInteger = Number.isInteger(number);

    return {
      content: `Number analysis for: ${input}`,
      input: input,
      number: number,
      isValid: true,
      properties: {
        isPrime: isPrime,
        isEven: isEven,
        isOdd: !isEven,
        isInteger: isInteger,
        isDecimal: !isInteger,
        absoluteValue: Math.abs(number),
        square: number * number,
        squareRoot: Math.sqrt(number),
      },
    };
  }

  isPrime(num) {
    if (num < 2) return false;
    if (num === 2) return true;
    if (num % 2 === 0) return false;
    
    for (let i = 3; i <= Math.sqrt(num); i += 2) {
      if (num % i === 0) return false;
    }
    return true;
  }

  async executeEcho(input, context) {
    return {
      content: input,
      input: input,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create agent system instance
const agentSystem = new AgentSystem();

// Authentication middleware
async function authenticateToken(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
        },
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = users.get(decoded.id);

    if (!user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      });
    }

    request.user = {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles,
      permissions: user.permissions,
    };

    return;
  } catch (error) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
}

// Routes
app.get('/health', {
  schema: {
    description: 'Health check endpoint',
    tags: ['health'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          uptime: { type: 'number' },
          version: { type: 'string' },
          agents: { type: 'number' },
          executions: { type: 'number' },
        },
      },
    },
  },
}, async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    agents: agentSystem.getAvailableAgents().length,
    executions: agentExecutions.length,
  };
});

// Authentication routes
app.post('/auth/login', {
  schema: {
    description: 'User login',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
      },
    },
  },
}, async (request, reply) => {
  const { email, password } = request.body;

  // Find user
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
    });
  }

  // Verify password
  const isValidPassword = bcrypt.compareSync(password, user.password);
  if (!isValidPassword) {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
    });
  }

  // Generate tokens
  const accessToken = jwt.sign({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    roles: user.roles,
    permissions: user.permissions,
  }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return {
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        roles: user.roles,
        permissions: user.permissions,
      },
    },
  };
});

app.get('/auth/me', {
  schema: {
    description: 'Get current user',
    tags: ['auth'],
    security: [{ bearerAuth: [] }],
  },
  preHandler: [authenticateToken],
}, async (request, reply) => {
  const user = users.get(request.user.id);
  return {
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      roles: user.roles,
      permissions: user.permissions,
    },
  };
});

// Agent routes
app.get('/api/agents', {
  schema: {
    description: 'List available agents',
    tags: ['agents'],
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          agents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                capabilities: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          count: { type: 'number' },
        },
      },
    },
  },
}, async (request, reply) => {
  const agents = agentSystem.getAvailableAgents();
  return {
    success: true,
    agents,
    count: agents.length,
  };
});

app.post('/api/agents/:agentName/execute', {
  schema: {
    description: 'Execute an agent',
    tags: ['agents'],
    params: {
      type: 'object',
      properties: {
        agentName: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      required: ['input'],
      properties: {
        input: { type: 'string' },
        context: { type: 'object' },
      },
    },
  },
}, async (request, reply) => {
  const { agentName } = request.params;
  const { input, context = {} } = request.body;
  
  // Add user context if authenticated
  if (request.user) {
    context.userId = request.user.id;
    context.organizationId = request.user.organizationId;
  }
  
  return agentSystem.executeAgent(agentName, input, context);
});

// Legacy endpoints for backward compatibility
app.get('/test', async (request, reply) => {
  return { message: 'Orchestrall Platform is working', version: '2.0.0' };
});

app.get('/api/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
  };
});

// Start server
async function start() {
  try {
    // Initialize demo data
    initializeDemoData();
    
    // Register plugins
    await registerPlugins();
    
    // Start server
    await app.listen({
      port: config.port,
      host: config.host,
    });
    
    console.log('🚀 Orchestrall Platform started successfully!');
    console.log(`✅ Server running on http://localhost:${config.port}`);
    console.log('📋 Available endpoints:');
    console.log('   GET  /health - Health check');
    console.log('   GET  /docs - API documentation');
    console.log('   POST /auth/login - User login');
    console.log('   GET  /auth/me - Get current user');
    console.log('   GET  /api/agents - List agents');
    console.log('   POST /api/agents/:name/execute - Execute agent');
    console.log('');
    console.log('🔐 Demo credentials:');
    console.log('   Email: admin@orchestrall.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('🤖 Available agents:');
    agentSystem.getAvailableAgents().forEach(agent => {
      console.log(`   - ${agent.name}: ${agent.description}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await app.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await app.close();
  process.exit(0);
});

// Start the server
start();
