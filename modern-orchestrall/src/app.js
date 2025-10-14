// src/app.js - COMPREHENSIVE IMPLEMENTATION
const fastify = require('fastify')({ logger: false });
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

// Simple JSON database (will be replaced with real database)
const DB_FILE = path.join(__dirname, 'data.json');
let db = { users: [], agents: [], executions: [] };

// Utility functions
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 5000); // Increased limit for file content
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Database functions
async function loadDatabase() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    db = JSON.parse(data);
  } catch (error) {
    // Initialize empty database
    db = { users: [], agents: [], executions: [] };
  }
}

async function saveDatabase() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

// Safe calculator with better implementation
function safeCalculate(expression) {
  // Remove potentially dangerous characters
  const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, '');

  if (sanitized.length > 200) {
    throw new Error('Expression too long');
  }

  // Simple evaluation for basic arithmetic
  try {
    // Basic validation - only allow simple arithmetic
    if (!/^[0-9+\-*/.()\s]+$/.test(sanitized)) {
      throw new Error('Invalid characters in expression');
    }

    // Use Function constructor with strict mode (safer than eval)
    const result = new Function('"use strict"; return (' + sanitized + ')')();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid result');
    }

    return result;
  } catch (error) {
    throw new Error('Invalid mathematical expression: ' + error.message);
  }
}

// Agent registry
const agentRegistry = {
  // Text processing agent
  'text-processor': {
    name: 'text-processor',
    description: 'Processes and analyzes text input',
    version: '1.0.0',
    async execute({ input }) {
      const wordCount = input.split(/\s+/).filter(word => word.length > 0).length;
      const charCount = input.length;
      const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      const paragraphs = input.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

      return {
        output: {
          originalText: input,
          analysis: {
            wordCount,
            characterCount: charCount,
            sentenceCount: sentences,
            paragraphCount: paragraphs,
            averageWordsPerSentence: sentences > 0 ? Math.round(wordCount / sentences) : 0,
            averageSentencesPerParagraph: paragraphs > 0 ? Math.round(sentences / paragraphs) : 0,
            estimatedReadingTimeMinutes: Math.ceil(wordCount / 200)
          }
        }
      };
    }
  },

  // Calculator agent (secure implementation)
  'calculator': {
    name: 'calculator',
    description: 'Safe mathematical calculations',
    version: '1.0.0',
    async execute({ input }) {
      const result = safeCalculate(input);

      return {
        output: {
          expression: input,
          result: result,
          type: 'number',
          formatted: result.toLocaleString()
        }
      };
    }
  },

  // Data validator agent
  'data-validator': {
    name: 'data-validator',
    description: 'Validates data formats and structures',
    version: '1.0.0',
    async execute({ input }) {
      const validations = {};

      // Email validation
      validations.isValidEmail = validateEmail(input);

      // Phone number validation
      validations.isValidPhone = /^\+?[\d\s\-\(\)]{10,}$/.test(input);

      // URL validation
      try {
        new URL(input);
        validations.isValidUrl = true;
      } catch {
        validations.isValidUrl = false;
      }

      // Number validation
      const numValue = parseFloat(input);
      validations.isValidNumber = !isNaN(numValue) && isFinite(numValue);

      // Date validation
      const dateValue = new Date(input);
      validations.isValidDate = !isNaN(dateValue.getTime());

      // JSON validation
      try {
        JSON.parse(input);
        validations.isValidJson = true;
      } catch {
        validations.isValidJson = false;
      }

      return {
        output: {
          input: input,
          validations: validations,
          overallValid: Object.values(validations).some(v => v),
          confidence: Object.values(validations).filter(v => v === true).length / Object.keys(validations).length
        }
      };
    }
  },

  // File analyzer agent
  'file-analyzer': {
    name: 'file-analyzer',
    description: 'Analyzes file content and structure',
    version: '1.0.0',
    async execute({ input }) {
      const lines = input.split('\n');
      const words = input.split(/\s+/).filter(w => w.length > 0);
      const estimatedReadingTime = Math.ceil(words.length / 200);

      // Detect file type based on content
      let fileType = 'text';
      if (input.includes('<?xml') || input.includes('<html') || input.includes('<body')) {
        fileType = 'markup';
      } else if (input.includes('function') || input.includes('const') || input.includes('var ')) {
        fileType = 'code';
      } else if (input.includes('{') && input.includes('}')) {
        try {
          JSON.parse(input);
          fileType = 'json';
        } catch {
          fileType = 'text';
        }
      }

      return {
        output: {
          content: input,
          analysis: {
            totalLines: lines.length,
            totalWords: words.length,
            totalCharacters: input.length,
            estimatedReadingTimeMinutes: estimatedReadingTime,
            fileType: fileType,
            language: 'english', // Simplified
            statistics: {
              averageWordsPerLine: lines.length > 0 ? Math.round(words.length / lines.length) : 0,
              averageCharactersPerLine: lines.length > 0 ? Math.round(input.length / lines.length) : 0,
              blankLines: lines.filter(line => line.trim() === '').length
            }
          }
        }
      };
    }
  },

  // JSON validator and formatter
  'json-validator': {
    name: 'json-validator',
    description: 'Validates and formats JSON data',
    version: '1.0.0',
    async execute({ input }) {
      try {
        const parsed = JSON.parse(input);
        const formatted = JSON.stringify(parsed, null, 2);

        return {
          output: {
            valid: true,
            original: input,
            formatted: formatted,
            parsed: parsed,
            metadata: {
              keysCount: Object.keys(parsed).length,
              depth: calculateJsonDepth(parsed),
              size: JSON.stringify(parsed).length
            }
          }
        };
      } catch (error) {
        return {
          output: {
            valid: false,
            original: input,
            error: error.message,
            suggestions: [
              'Check for missing quotes around strings',
              'Ensure brackets and braces are properly closed',
              'Verify comma placement between elements',
              'Check for trailing commas'
            ]
          }
        };
      }
    }
  },

  // URL analyzer
  'url-analyzer': {
    name: 'url-analyzer',
    description: 'Analyzes URLs and extracts information',
    version: '1.0.0',
    async execute({ input }) {
      try {
        const url = new URL(input);

        return {
          output: {
            originalUrl: input,
            analysis: {
              protocol: url.protocol,
              hostname: url.hostname,
              port: url.port || (url.protocol === 'https:' ? 443 : 80),
              pathname: url.pathname,
              search: url.search,
              hash: url.hash,
              isSecure: url.protocol === 'https:',
              domain: url.hostname,
              subdomain: url.hostname.split('.')[0],
              topLevelDomain: url.hostname.split('.').pop(),
              searchParams: Object.fromEntries(url.searchParams.entries())
            }
          }
        };
      } catch (error) {
        return {
          output: {
            originalUrl: input,
            valid: false,
            error: 'Invalid URL format',
            suggestions: [
              'Include http:// or https:// protocol',
              'Ensure proper domain format (example.com)',
              'Check for typos in the URL',
              'Verify port numbers are valid'
            ]
          }
        };
      }
    }
  },

  // Date/time processor
  'datetime-processor': {
    name: 'datetime-processor',
    description: 'Processes dates and times',
    version: '1.0.0',
    async execute({ input }) {
      const now = new Date();
      let inputDate;

      try {
        inputDate = new Date(input);
      } catch (error) {
        return {
          output: {
            valid: false,
            input: input,
            error: 'Invalid date format',
            suggestions: [
              'Use ISO format: 2024-01-15T10:30:00Z',
              'Use common formats: MM/DD/YYYY or DD/MM/YYYY',
              'Include time if needed: HH:MM:SS'
            ]
          }
        };
      }

      if (isNaN(inputDate.getTime())) {
        return {
          output: {
            valid: false,
            input: input,
            error: 'Invalid date format'
          }
        };
      }

      const diffMs = inputDate.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.round(diffMs / (1000 * 60));

      return {
        output: {
          input: input,
          parsedDate: inputDate.toISOString(),
          analysis: {
            isPast: diffMs < 0,
            isFuture: diffMs > 0,
            isToday: diffDays === 0,
            isThisYear: inputDate.getFullYear() === now.getFullYear(),
            daysDifference: diffDays,
            hoursDifference: diffHours,
            minutesDifference: diffMinutes,
            timeUntil: diffMs > 0 ? formatTimeDifference(diffMs) : null,
            timeAgo: diffMs < 0 ? formatTimeDifference(Math.abs(diffMs)) : null
          }
        }
      };
    }
  },

  // String manipulator
  'string-manipulator': {
    name: 'string-manipulator',
    description: 'Manipulates and transforms strings',
    version: '1.0.0',
    async execute({ input }) {
      return {
        output: {
          original: input,
          transformations: {
            uppercase: input.toUpperCase(),
            lowercase: input.toLowerCase(),
            reversed: input.split('').reverse().join(''),
            trimmed: input.trim(),
            length: input.length,
            wordCount: input.split(/\s+/).filter(w => w.length > 0).length,
            firstWord: input.split(/\s+/).filter(w => w.length > 0)[0] || '',
            lastWord: input.split(/\s+/).filter(w => w.length > 0).pop() || ''
          }
        }
      };
    }
  },

  // Number analyzer
  'number-analyzer': {
    name: 'number-analyzer',
    description: 'Analyzes numbers and their properties',
    version: '1.0.0',
    async execute({ input }) {
      const num = parseFloat(input);

      if (isNaN(num)) {
        return {
          output: {
            valid: false,
            input: input,
            error: 'Not a valid number'
          }
        };
      }

      const properties = {
        isInteger: Number.isInteger(num),
        isPositive: num > 0,
        isNegative: num < 0,
        isZero: num === 0,
        isEven: num % 2 === 0,
        isOdd: num % 2 !== 0,
        isPrime: isPrime(num),
        digits: num.toString().length,
        absoluteValue: Math.abs(num)
      };

      return {
        output: {
          input: input,
          number: num,
          properties: properties,
          analysis: {
            parity: properties.isEven ? 'even' : 'odd',
            sign: properties.isPositive ? 'positive' : properties.isNegative ? 'negative' : 'zero',
            magnitude: getMagnitude(num),
            formatted: num.toLocaleString(),
            scientific: num.toExponential()
          }
        }
      };
    }
  }
};

// Helper functions
function calculateJsonDepth(obj, depth = 0) {
  if (obj === null || typeof obj !== 'object') {
    return depth;
  }

  let maxDepth = depth;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const itemDepth = calculateJsonDepth(obj[key], depth + 1);
      maxDepth = Math.max(maxDepth, itemDepth);
    }
  }

  return maxDepth;
}

function formatTimeDifference(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}

function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;

  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }

  return true;
}

function getMagnitude(num) {
  const abs = Math.abs(num);
  if (abs === 0) return 'zero';
  if (abs < 0.01) return 'very small';
  if (abs < 1) return 'small';
  if (abs < 1000) return 'medium';
  if (abs < 1000000) return 'large';
  return 'very large';
}

// Routes

// Health check with detailed info
fastify.get('/api/health', (request, reply) => {
  reply.send({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.3-comprehensive',
    agents: Object.keys(agentRegistry).length,
    users: db.users.length,
    executions: db.executions.length
  });
});

// User registration
fastify.post('/api/auth/register', async (request, reply) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      reply.code(400).send({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    if (!validateEmail(email)) {
      reply.code(400).send({
        success: false,
        error: 'Invalid email format'
      });
      return;
    }

    if (!validatePassword(password)) {
      reply.code(400).send({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
      return;
    }

    // Check if user exists
    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
      reply.code(409).send({
        success: false,
        error: 'User already exists'
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = {
      id: generateId(),
      email,
      passwordHash,
      createdAt: new Date(),
      lastLogin: null
    };

    db.users.push(user);
    await saveDatabase();

    reply.code(201).send({
      success: true,
      message: 'User created successfully',
      userId: user.id
    });

  } catch (error) {
    console.error('Registration error:', error);
    reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// User login
fastify.post('/api/auth/login', async (request, reply) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      reply.code(400).send({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    const user = db.users.find(u => u.email === email);
    if (!user) {
      reply.code(401).send({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      reply.code(401).send({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await saveDatabase();

    // Generate token
    const token = 'token-' + user.id + '-' + Date.now();

    reply.send({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    reply.code(500).send({
      success: false,
      error: 'Internal server error'
    });
  }
});

// List agents
fastify.get('/api/agents', (request, reply) => {
  const agents = Object.values(agentRegistry).map(agent => ({
    name: agent.name,
    description: agent.description,
    version: agent.version
  }));

  reply.send({
    success: true,
    agents: agents,
    count: agents.length
  });
});

// Execute agent
fastify.post('/api/agents/:agentName/execute', async (request, reply) => {
  try {
    const { agentName } = request.params;
    const { input, context } = request.body;

    // Find agent
    const agent = agentRegistry[agentName];
    if (!agent) {
      reply.code(404).send({
        success: false,
        error: `Agent '${agentName}' not found`,
        availableAgents: Object.keys(agentRegistry)
      });
      return;
    }

    // Validate input
    if (input === undefined || input === null) {
      reply.code(400).send({
        success: false,
        error: 'Input is required'
      });
      return;
    }

    // Sanitize input
    const sanitizedInput = sanitizeInput(String(input));

    // Execute agent
    const startTime = Date.now();
    const result = await agent.execute({
      input: sanitizedInput,
      context: context || {},
      timestamp: new Date().toISOString()
    });
    const executionTime = Date.now() - startTime;

    // Log execution
    const execution = {
      id: generateId(),
      agentName,
      input: sanitizedInput,
      output: result.output,
      executionTime,
      timestamp: new Date(),
      success: true
    };

    db.executions.push(execution);
    await saveDatabase();

    reply.send({
      success: true,
      result: result.output,
      metadata: {
        agentName,
        executionTime: new Date().toISOString(),
        executionDuration: executionTime,
        inputLength: sanitizedInput.length,
        outputSize: JSON.stringify(result.output).length
      }
    });

  } catch (error) {
    console.error('Agent execution error:', error);

    // Log failed execution
    const execution = {
      id: generateId(),
      agentName: request.params.agentName,
      input: request.body.input,
      error: error.message,
      timestamp: new Date(),
      success: false
    };

    db.executions.push(execution);
    await saveDatabase();

    reply.code(500).send({
      success: false,
      error: 'Agent execution failed: ' + error.message
    });
  }
});

// Get execution history
fastify.get('/api/executions', async (request, reply) => {
  const { limit = 50, offset = 0 } = request.query;

  const executions = db.executions
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    .map(exec => ({
      id: exec.id,
      agentName: exec.agentName,
      executionTime: exec.executionTime,
      timestamp: exec.timestamp,
      success: exec.success,
      inputLength: exec.input ? String(exec.input).length : 0
    }));

  reply.send({
    success: true,
    executions,
    total: db.executions.length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});

// API documentation endpoint
fastify.get('/api/docs', (request, reply) => {
  const docs = {
    title: 'Orchestrall Platform API',
    version: '1.0.3',
    description: 'AI agent platform for data processing and analysis',
    endpoints: {
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'Get server health and statistics'
      },
      register: {
        method: 'POST',
        path: '/api/auth/register',
        description: 'Register a new user account',
        body: { email: 'string', password: 'string' }
      },
      login: {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Authenticate user and get token',
        body: { email: 'string', password: 'string' }
      },
      agents: {
        method: 'GET',
        path: '/api/agents',
        description: 'List all available agents'
      },
      execute: {
        method: 'POST',
        path: '/api/agents/{agentName}/execute',
        description: 'Execute a specific agent',
        params: { agentName: 'string' },
        body: { input: 'string', context: 'object' }
      },
      executions: {
        method: 'GET',
        path: '/api/executions',
        description: 'Get execution history',
        query: { limit: 'number', offset: 'number' }
      }
    },
    agents: Object.values(agentRegistry).map(agent => ({
      name: agent.name,
      description: agent.description,
      version: agent.version,
      capabilities: getAgentCapabilities(agent.name)
    }))
  };

  reply.send(docs);
});

function getAgentCapabilities(agentName) {
  const capabilities = {
    'text-processor': ['word count', 'character count', 'sentence analysis', 'reading time estimation'],
    'calculator': ['basic arithmetic', 'expression evaluation', 'number formatting'],
    'data-validator': ['email validation', 'phone validation', 'URL validation', 'JSON validation', 'number validation', 'date validation'],
    'file-analyzer': ['content analysis', 'file type detection', 'reading time estimation', 'statistics'],
    'json-validator': ['JSON parsing', 'formatting', 'structure analysis', 'error detection'],
    'url-analyzer': ['URL parsing', 'component extraction', 'validation', 'parameter analysis'],
    'datetime-processor': ['date parsing', 'time calculations', 'relative time', 'validation'],
    'string-manipulator': ['case conversion', 'reversal', 'trimming', 'word extraction'],
    'number-analyzer': ['property analysis', 'classification', 'formatting', 'mathematical properties']
  };

  return capabilities[agentName] || [];
}

// Start server
async function startServer() {
  try {
    // Load database
    await loadDatabase();
    console.log(`📊 Loaded database: ${db.users.length} users, ${db.executions.length} executions`);

    // Start server
    await fastify.listen({ port: config.server.port, host: config.server.host });

    console.log(`🚀 Orchestrall Platform running on http://${config.server.host}:${config.server.port}`);
    console.log(`📋 API Endpoints:`);
    console.log(`   GET  /api/health - Server health and stats`);
    console.log(`   POST /api/auth/register - Secure user registration`);
    console.log(`   POST /api/auth/login - User authentication`);
    console.log(`   GET  /api/agents - List available agents`);
    console.log(`   POST /api/agents/:name/execute - Execute agent`);
    console.log(`   GET  /api/executions - Execution history`);
    console.log(`   GET  /api/docs - API documentation`);
    console.log(`🔒 Security: bcrypt password hashing, input validation, error handling`);
    console.log(`🤖 Agents: ${Object.keys(agentRegistry).length} functional agents available`);
    console.log(`💾 Database: JSON file storage (persistent)`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await saveDatabase();
  fastify.close();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await saveDatabase();
  fastify.close();
});

// Start the server
startServer();
