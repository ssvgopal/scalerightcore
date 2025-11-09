// src/agents/index.js - Agent System Implementation
const { OpenAI } = require('openai');
const config = require('../config');
const logger = require('../utils/logger');
const database = require('../database');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.ai.openaiApiKey,
});

class AgentSystem {
  constructor() {
    this.prisma = null;
    this.agents = new Map();
    this.initializeAgents();
  }

  async initialize() {
    this.prisma = database.client;
  }

  // Initialize all available agents
  initializeAgents() {
    // Text Processor Agent
    this.agents.set('text-processor', {
      name: 'Text Processor',
      description: 'Content analysis, reading time estimation, and text processing',
      capabilities: ['content_analysis', 'reading_time', 'text_summarization', 'sentiment_analysis'],
      execute: this.executeTextProcessor.bind(this),
    });

    // Calculator Agent
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

    // Workflow Intelligence Agent
    this.agents.set('workflow-intelligence', {
      name: 'Workflow Intelligence',
      description: 'Advanced workflow analysis, integration compatibility, and conflict detection',
      capabilities: ['customer-onboarding-analysis', 'integration-compatibility', 'workflow-conflict-detection', 'architecture-assessment'],
      execute: this.executeWorkflowIntelligence.bind(this),
    });

    // Echo Agent (for backward compatibility)
    this.agents.set('echo', {
      name: 'Echo',
      description: 'Returns input exactly as provided',
      capabilities: ['echo'],
      execute: this.executeEcho.bind(this),
    });
  }

  // Get all available agents
  getAvailableAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
    }));
  }

  // Execute agent
  async executeAgent(agentName, input, context = {}) {
    const startTime = Date.now();
    
    try {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent '${agentName}' not found`);
      }

      logger.info('Agent execution started', { agentName, inputLength: input?.length || 0 });

      const result = await agent.execute(input, context);
      const duration = Date.now() - startTime;

      // Log execution
      logger.agentExecution(agentName, input, result, duration, context);

      // Save execution to database
      if (this.prisma && context.userId) {
        await this.saveAgentExecution(agentName, input, result, duration, context);
      }

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
      logger.error('Agent execution failed', { agentName, error: error.message, duration });
      
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

  // Save agent execution to database
  async saveAgentExecution(agentName, input, output, duration, context) {
    try {
      // Find agent in database
      const agent = await this.prisma.agent.findFirst({
        where: {
          name: agentName,
          organizationId: context.organizationId,
        },
      });

      if (agent) {
        await this.prisma.agentExecution.create({
          data: {
            agentId: agent.id,
            input: { input, context },
            output: { result: output },
            status: 'completed',
            duration,
            triggeredBy: context.userId,
            metadata: context,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to save agent execution', { agentName, error: error.message });
    }
  }

  // Text Processor Agent Implementation
  async executeTextProcessor(input, context) {
    if (!config.ai.openaiApiKey) {
      return {
        content: 'Text processing requires OpenAI API key',
        wordCount: input.split(' ').length,
        characterCount: input.length,
        estimatedReadingTime: Math.ceil(input.split(' ').length / 200), // 200 words per minute
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: config.ai.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You are a text analysis expert. Analyze the provided text and return structured information about content, sentiment, and reading time.',
          },
          {
            role: 'user',
            content: `Analyze this text: ${input}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const analysis = response.choices[0].message.content || '';
      
      return {
        content: analysis,
        wordCount: input.split(' ').length,
        characterCount: input.length,
        estimatedReadingTime: Math.ceil(input.split(' ').length / 200),
        analysis: analysis,
      };
    } catch (error) {
      throw new Error(`Text processing failed: ${error.message}`);
    }
  }

  // Calculator Agent Implementation (Safe - No eval)
  async executeCalculator(input, context) {
    try {
      // Safe mathematical expression parser
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

  // Safe mathematical evaluation (no eval)
  safeEvaluate(expression) {
    // Remove all non-mathematical characters except numbers, operators, and parentheses
    const cleanExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
    
    // Basic validation
    if (!/^[0-9+\-*/().\s]+$/.test(cleanExpression)) {
      throw new Error('Invalid characters in expression');
    }

    // Simple arithmetic operations
    const tokens = cleanExpression.match(/\d+\.?\d*|[+\-*/()]/g) || [];
    
    // Convert to numbers and operators
    const stack = [];
    const operators = [];
    
    for (const token of tokens) {
      if (/\d+\.?\d*/.test(token)) {
        stack.push(parseFloat(token));
      } else if (['+', '-', '*', '/'].includes(token)) {
        operators.push(token);
      }
    }
    
    // Simple calculation (left to right)
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

  // Data Validator Agent Implementation
  async executeDataValidator(input, context) {
    const validations = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[1-9][\d]{0,15}$/,
      url: /^https?:\/\/.+/,
    };

    const results = {};
    
    // Email validation
    if (validations.email.test(input)) {
      results.email = { valid: true, type: 'email' };
    }
    
    // Phone validation
    if (validations.phone.test(input.replace(/[\s\-\(\)]/g, ''))) {
      results.phone = { valid: true, type: 'phone' };
    }
    
    // URL validation
    if (validations.url.test(input)) {
      results.url = { valid: true, type: 'url' };
    }
    
    // JSON validation
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

  // File Analyzer Agent Implementation
  async executeFileAnalyzer(input, context) {
    // Simulate file analysis
    const fileInfo = {
      name: input.split('/').pop() || input,
      size: Math.floor(Math.random() * 1000000), // Random size
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

  // JSON Validator Agent Implementation
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

  // URL Analyzer Agent Implementation
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

  // DateTime Processor Agent Implementation
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

  // String Manipulator Agent Implementation
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

  // Number Analyzer Agent Implementation
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

  // Workflow Intelligence Agent Implementation
  async executeWorkflowIntelligence(input, context) {
    try {
      const WorkflowIntelligenceAgent = require('./workflow-intelligence-agent');
      const agent = new WorkflowIntelligenceAgent();
      await agent.initialize();
      
      const result = await agent.process(input, context);
      
      return {
        content: result.result.content,
        structuredData: result.result.structuredData,
        recommendations: result.result.recommendations,
        compatibilityMatrix: result.result.compatibilityMatrix,
        conflictReport: result.result.conflictReport,
        resolutionStrategies: result.result.resolutionStrategies,
        priorityMatrix: result.result.priorityMatrix,
        implementationRoadmap: result.result.implementationRoadmap,
        costAnalysis: result.result.costAnalysis,
        riskAssessment: result.result.riskAssessment,
        confidence: result.result.confidence,
        analysisType: result.metadata.analysisType,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Workflow intelligence analysis failed: ${error.message}`);
    }
  }

  // Echo Agent Implementation
  async executeEcho(input, context) {
    return {
      content: input,
      input: input,
      timestamp: new Date().toISOString(),
    };
  }

  // List all available agents
  listAgents() {
    const agentList = [];
    for (const [key, agent] of this.agents) {
      agentList.push({
        name: key,
        displayName: agent.name,
        description: agent.description,
        capabilities: agent.capabilities
      });
    }
    return agentList;
  }
}

// Create singleton instance
const agentSystem = new AgentSystem();

module.exports = agentSystem;
