// src/autonomous/autonomous-platform-manager.js - Autonomous Platform Manager
const EventEmitter = require('events');
const logger = require('../utils/logger');
const database = require('../database');
const AutonomousAgentOrchestrator = require('./agent-orchestrator');
const SelfLearningEngine = require('./learning-engine');
const SelfHealingSystem = require('./self-healing-system');

class AutonomousPlatformManager extends EventEmitter {
  constructor() {
    super();
    this.prisma = null;
    this.agentOrchestrator = null;
    this.learningEngine = null;
    this.selfHealingSystem = null;
    this.autonomousMode = false;
    this.decisionEngine = new Map();
    this.autonomousPolicies = new Map();
    this.initializeAutonomousPolicies();
  }

  async initialize() {
    try {
      this.prisma = database.client;
      
      // Initialize autonomous systems
      this.agentOrchestrator = new AutonomousAgentOrchestrator();
      this.learningEngine = new SelfLearningEngine();
      this.selfHealingSystem = new SelfHealingSystem();

      // Initialize subsystems
      await this.agentOrchestrator.initialize();
      await this.learningEngine.initialize();
      await this.selfHealingSystem.initialize();

      // Start autonomous operations
      await this.startAutonomousOperations();

      logger.info('Autonomous Platform Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Autonomous Platform Manager', error);
      throw error;
    }
  }

  // Initialize autonomous policies
  initializeAutonomousPolicies() {
    // Resource management policies
    this.autonomousPolicies.set('resource-management', {
      name: 'Resource Management Policy',
      description: 'Automatically manage system resources based on demand',
      rules: [
        { condition: 'cpu-usage > 80%', action: 'scale-up', priority: 'high' },
        { condition: 'memory-usage > 85%', action: 'optimize-memory', priority: 'high' },
        { condition: 'disk-usage > 90%', action: 'cleanup-storage', priority: 'critical' },
        { condition: 'network-latency > 100ms', action: 'optimize-network', priority: 'medium' }
      ],
      enabled: true,
      lastUpdate: Date.now()
    });

    // Performance optimization policies
    this.autonomousPolicies.set('performance-optimization', {
      name: 'Performance Optimization Policy',
      description: 'Continuously optimize system performance',
      rules: [
        { condition: 'response-time > 2s', action: 'enable-caching', priority: 'high' },
        { condition: 'error-rate > 5%', action: 'improve-error-handling', priority: 'high' },
        { condition: 'throughput < 100 req/s', action: 'optimize-algorithms', priority: 'medium' },
        { condition: 'queue-depth > 1000', action: 'scale-processing', priority: 'high' }
      ],
      enabled: true,
      lastUpdate: Date.now()
    });

    // Security policies
    this.autonomousPolicies.set('security', {
      name: 'Security Policy',
      description: 'Automatically respond to security threats',
      rules: [
        { condition: 'failed-login-attempts > 10', action: 'block-ip', priority: 'critical' },
        { condition: 'suspicious-activity-detected', action: 'enable-monitoring', priority: 'high' },
        { condition: 'unusual-traffic-pattern', action: 'rate-limit', priority: 'medium' },
        { condition: 'vulnerability-detected', action: 'apply-patch', priority: 'critical' }
      ],
      enabled: true,
      lastUpdate: Date.now()
    });

    // Cost optimization policies
    this.autonomousPolicies.set('cost-optimization', {
      name: 'Cost Optimization Policy',
      description: 'Optimize costs while maintaining performance',
      rules: [
        { condition: 'low-usage-period', action: 'scale-down', priority: 'low' },
        { condition: 'unused-resources > 50%', action: 'release-resources', priority: 'medium' },
        { condition: 'high-cost-operation', action: 'optimize-operation', priority: 'high' },
        { condition: 'redundant-services', action: 'consolidate-services', priority: 'medium' }
      ],
      enabled: true,
      lastUpdate: Date.now()
    });

    // Compliance policies
    this.autonomousPolicies.set('compliance', {
      name: 'Compliance Policy',
      description: 'Ensure compliance with regulations and standards',
      rules: [
        { condition: 'data-retention-violation', action: 'archive-data', priority: 'high' },
        { condition: 'audit-log-missing', action: 'enable-audit-logging', priority: 'critical' },
        { condition: 'encryption-disabled', action: 'enable-encryption', priority: 'critical' },
        { condition: 'access-control-violation', action: 'enforce-access-control', priority: 'high' }
      ],
      enabled: true,
      lastUpdate: Date.now()
    });
  }

  // Start autonomous operations
  async startAutonomousOperations() {
    try {
      // Start autonomous decision making
      setInterval(() => {
        this.performAutonomousDecisions();
      }, 60000); // Every minute

      // Start policy evaluation
      setInterval(() => {
        this.evaluatePolicies();
      }, 300000); // Every 5 minutes

      // Start autonomous optimization
      setInterval(() => {
        this.performAutonomousOptimization();
      }, 900000); // Every 15 minutes

      // Start autonomous monitoring
      setInterval(() => {
        this.performAutonomousMonitoring();
      }, 30000); // Every 30 seconds

      // Enable autonomous mode
      this.autonomousMode = true;
      logger.info('Autonomous operations started');
    } catch (error) {
      logger.error('Failed to start autonomous operations', error);
    }
  }

  // Perform autonomous decisions
  async performAutonomousDecisions() {
    try {
      if (!this.autonomousMode) return;

      // Collect system state
      const systemState = await this.collectSystemState();
      
      // Make autonomous decisions
      const decisions = await this.makeAutonomousDecisions(systemState);
      
      // Execute decisions
      for (const decision of decisions) {
        await this.executeAutonomousDecision(decision);
      }

    } catch (error) {
      logger.error('Autonomous decision making error', error);
    }
  }

  // Collect system state
  async collectSystemState() {
    try {
      const state = {
        timestamp: Date.now(),
        resources: await this.getResourceState(),
        performance: await this.getPerformanceState(),
        security: await this.getSecurityState(),
        costs: await this.getCostState(),
        compliance: await this.getComplianceState(),
        health: this.selfHealingSystem.getSystemHealthStatus(),
        predictions: await this.getPredictionsState()
      };

      return state;
    } catch (error) {
      logger.error('Failed to collect system state', error);
      return {};
    }
  }

  // Get resource state
  async getResourceState() {
    try {
      const memUsage = process.memoryUsage();
      return {
        cpu: Math.random() * 100, // Simulate CPU usage
        memory: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        disk: Math.random() * 100, // Simulate disk usage
        network: Math.random() * 100 // Simulate network usage
      };
    } catch (error) {
      return { cpu: 0, memory: 0, disk: 0, network: 0 };
    }
  }

  // Get performance state
  async getPerformanceState() {
    try {
      return {
        responseTime: Math.random() * 2000, // Simulate response time
        throughput: Math.random() * 1000, // Simulate throughput
        errorRate: Math.random() * 10, // Simulate error rate
        queueDepth: Math.random() * 1000 // Simulate queue depth
      };
    } catch (error) {
      return { responseTime: 0, throughput: 0, errorRate: 0, queueDepth: 0 };
    }
  }

  // Get security state
  async getSecurityState() {
    try {
      return {
        failedLogins: Math.floor(Math.random() * 20), // Simulate failed logins
        suspiciousActivity: Math.random() > 0.8, // Simulate suspicious activity
        trafficPattern: Math.random() > 0.7 ? 'unusual' : 'normal', // Simulate traffic pattern
        vulnerabilities: Math.floor(Math.random() * 5) // Simulate vulnerabilities
      };
    } catch (error) {
      return { failedLogins: 0, suspiciousActivity: false, trafficPattern: 'normal', vulnerabilities: 0 };
    }
  }

  // Get cost state
  async getCostState() {
    try {
      return {
        currentCost: Math.random() * 1000, // Simulate current cost
        projectedCost: Math.random() * 1200, // Simulate projected cost
        unusedResources: Math.random() * 50, // Simulate unused resources
        redundantServices: Math.floor(Math.random() * 3) // Simulate redundant services
      };
    } catch (error) {
      return { currentCost: 0, projectedCost: 0, unusedResources: 0, redundantServices: 0 };
    }
  }

  // Get compliance state
  async getComplianceState() {
    try {
      return {
        dataRetentionCompliance: Math.random() > 0.1, // Simulate compliance
        auditLoggingEnabled: Math.random() > 0.2,
        encryptionEnabled: Math.random() > 0.1,
        accessControlEnforced: Math.random() > 0.15
      };
    } catch (error) {
      return { dataRetentionCompliance: true, auditLoggingEnabled: true, encryptionEnabled: true, accessControlEnforced: true };
    }
  }

  // Get predictions state
  async getPredictionsState() {
    try {
      const predictions = [];
      
      // Get predictions from learning engine
      for (const [modelId, model] of this.learningEngine.learningModels) {
        const modelPredictions = this.learningEngine.getPredictions(modelId);
        predictions.push(...modelPredictions);
      }

      return predictions;
    } catch (error) {
      return [];
    }
  }

  // Make autonomous decisions
  async makeAutonomousDecisions(systemState) {
    const decisions = [];

    try {
      // Evaluate each policy
      for (const [policyId, policy] of this.autonomousPolicies) {
        if (!policy.enabled) continue;

        const policyDecisions = await this.evaluatePolicy(policyId, policy, systemState);
        decisions.push(...policyDecisions);
      }

      // Prioritize decisions
      const prioritizedDecisions = this.prioritizeDecisions(decisions);

      return prioritizedDecisions;
    } catch (error) {
      logger.error('Failed to make autonomous decisions', error);
      return [];
    }
  }

  // Evaluate policy
  async evaluatePolicy(policyId, policy, systemState) {
    const decisions = [];

    try {
      for (const rule of policy.rules) {
        const conditionMet = this.evaluateCondition(rule.condition, systemState);
        
        if (conditionMet) {
          decisions.push({
            policyId,
            policyName: policy.name,
            rule,
            action: rule.action,
            priority: rule.priority,
            condition: rule.condition,
            timestamp: Date.now(),
            systemState: this.extractRelevantState(rule.condition, systemState)
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to evaluate policy ${policyId}`, error);
    }

    return decisions;
  }

  // Evaluate condition
  evaluateCondition(condition, systemState) {
    try {
      // Simple condition evaluation - in production, this would be more sophisticated
      const conditions = {
        'cpu-usage > 80%': systemState.resources.cpu > 80,
        'memory-usage > 85%': systemState.resources.memory > 85,
        'disk-usage > 90%': systemState.resources.disk > 90,
        'network-latency > 100ms': systemState.resources.network > 100,
        'response-time > 2s': systemState.performance.responseTime > 2000,
        'error-rate > 5%': systemState.performance.errorRate > 5,
        'throughput < 100 req/s': systemState.performance.throughput < 100,
        'queue-depth > 1000': systemState.performance.queueDepth > 1000,
        'failed-login-attempts > 10': systemState.security.failedLogins > 10,
        'suspicious-activity-detected': systemState.security.suspiciousActivity,
        'unusual-traffic-pattern': systemState.security.trafficPattern === 'unusual',
        'vulnerability-detected': systemState.security.vulnerabilities > 0,
        'low-usage-period': systemState.performance.throughput < 50,
        'unused-resources > 50%': systemState.costs.unusedResources > 50,
        'redundant-services': systemState.costs.redundantServices > 0,
        'data-retention-violation': !systemState.compliance.dataRetentionCompliance,
        'audit-log-missing': !systemState.compliance.auditLoggingEnabled,
        'encryption-disabled': !systemState.compliance.encryptionEnabled,
        'access-control-violation': !systemState.compliance.accessControlEnforced
      };

      return conditions[condition] || false;
    } catch (error) {
      logger.error(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  // Extract relevant state
  extractRelevantState(condition, systemState) {
    // Extract relevant parts of system state based on condition
    const relevantState = {};
    
    if (condition.includes('cpu')) relevantState.cpu = systemState.resources.cpu;
    if (condition.includes('memory')) relevantState.memory = systemState.resources.memory;
    if (condition.includes('disk')) relevantState.disk = systemState.resources.disk;
    if (condition.includes('network')) relevantState.network = systemState.resources.network;
    if (condition.includes('response-time')) relevantState.responseTime = systemState.performance.responseTime;
    if (condition.includes('error-rate')) relevantState.errorRate = systemState.performance.errorRate;
    if (condition.includes('throughput')) relevantState.throughput = systemState.performance.throughput;
    if (condition.includes('queue-depth')) relevantState.queueDepth = systemState.performance.queueDepth;
    if (condition.includes('failed-login')) relevantState.failedLogins = systemState.security.failedLogins;
    if (condition.includes('suspicious')) relevantState.suspiciousActivity = systemState.security.suspiciousActivity;
    if (condition.includes('traffic')) relevantState.trafficPattern = systemState.security.trafficPattern;
    if (condition.includes('vulnerability')) relevantState.vulnerabilities = systemState.security.vulnerabilities;

    return relevantState;
  }

  // Prioritize decisions
  prioritizeDecisions(decisions) {
    const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    
    return decisions.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 0;
      const priorityB = priorityOrder[b.priority] || 0;
      return priorityB - priorityA;
    });
  }

  // Execute autonomous decision
  async executeAutonomousDecision(decision) {
    try {
      logger.info(`Executing autonomous decision: ${decision.action}`, {
        policy: decision.policyName,
        priority: decision.priority,
        condition: decision.condition
      });

      // Execute action based on decision
      const success = await this.executeAction(decision.action, decision.systemState);
      
      if (success) {
        // Record successful execution
        await this.recordDecisionExecution(decision, 'success');
        
        // Emit decision executed event
        this.emit('decision-executed', decision);
      } else {
        // Record failed execution
        await this.recordDecisionExecution(decision, 'failed');
        
        // Emit decision failed event
        this.emit('decision-failed', decision);
      }

    } catch (error) {
      logger.error(`Failed to execute autonomous decision: ${decision.action}`, error);
      await this.recordDecisionExecution(decision, 'error');
    }
  }

  // Execute action
  async executeAction(action, systemState) {
    try {
      switch (action) {
        case 'scale-up':
          return await this.scaleUp(systemState);
        case 'scale-down':
          return await this.scaleDown(systemState);
        case 'optimize-memory':
          return await this.optimizeMemory(systemState);
        case 'cleanup-storage':
          return await this.cleanupStorage(systemState);
        case 'optimize-network':
          return await this.optimizeNetwork(systemState);
        case 'enable-caching':
          return await this.enableCaching(systemState);
        case 'improve-error-handling':
          return await this.improveErrorHandling(systemState);
        case 'optimize-algorithms':
          return await this.optimizeAlgorithms(systemState);
        case 'scale-processing':
          return await this.scaleProcessing(systemState);
        case 'block-ip':
          return await this.blockIP(systemState);
        case 'enable-monitoring':
          return await this.enableMonitoring(systemState);
        case 'rate-limit':
          return await this.rateLimit(systemState);
        case 'apply-patch':
          return await this.applyPatch(systemState);
        case 'release-resources':
          return await this.releaseResources(systemState);
        case 'optimize-operation':
          return await this.optimizeOperation(systemState);
        case 'consolidate-services':
          return await this.consolidateServices(systemState);
        case 'archive-data':
          return await this.archiveData(systemState);
        case 'enable-audit-logging':
          return await this.enableAuditLogging(systemState);
        case 'enable-encryption':
          return await this.enableEncryption(systemState);
        case 'enforce-access-control':
          return await this.enforceAccessControl(systemState);
        default:
          logger.warn(`Unknown action: ${action}`);
          return false;
      }
    } catch (error) {
      logger.error(`Failed to execute action: ${action}`, error);
      return false;
    }
  }

  // Action implementations
  async scaleUp(systemState) {
    logger.info('Scaling up system resources');
    // Implement scaling up logic
    return Math.random() > 0.1; // 90% success rate
  }

  async scaleDown(systemState) {
    logger.info('Scaling down system resources');
    // Implement scaling down logic
    return Math.random() > 0.2; // 80% success rate
  }

  async optimizeMemory(systemState) {
    logger.info('Optimizing memory usage');
    // Implement memory optimization
    return Math.random() > 0.15; // 85% success rate
  }

  async cleanupStorage(systemState) {
    logger.info('Cleaning up storage');
    // Implement storage cleanup
    return Math.random() > 0.1; // 90% success rate
  }

  async optimizeNetwork(systemState) {
    logger.info('Optimizing network performance');
    // Implement network optimization
    return Math.random() > 0.2; // 80% success rate
  }

  async enableCaching(systemState) {
    logger.info('Enabling caching');
    // Implement caching
    return Math.random() > 0.1; // 90% success rate
  }

  async improveErrorHandling(systemState) {
    logger.info('Improving error handling');
    // Implement error handling improvements
    return Math.random() > 0.15; // 85% success rate
  }

  async optimizeAlgorithms(systemState) {
    logger.info('Optimizing algorithms');
    // Implement algorithm optimization
    return Math.random() > 0.2; // 80% success rate
  }

  async scaleProcessing(systemState) {
    logger.info('Scaling processing capacity');
    // Implement processing scaling
    return Math.random() > 0.1; // 90% success rate
  }

  async blockIP(systemState) {
    logger.info('Blocking suspicious IP addresses');
    // Implement IP blocking
    return Math.random() > 0.05; // 95% success rate
  }

  async enableMonitoring(systemState) {
    logger.info('Enabling enhanced monitoring');
    // Implement enhanced monitoring
    return Math.random() > 0.1; // 90% success rate
  }

  async rateLimit(systemState) {
    logger.info('Applying rate limiting');
    // Implement rate limiting
    return Math.random() > 0.1; // 90% success rate
  }

  async applyPatch(systemState) {
    logger.info('Applying security patches');
    // Implement patch application
    return Math.random() > 0.2; // 80% success rate
  }

  async releaseResources(systemState) {
    logger.info('Releasing unused resources');
    // Implement resource release
    return Math.random() > 0.15; // 85% success rate
  }

  async optimizeOperation(systemState) {
    logger.info('Optimizing high-cost operations');
    // Implement operation optimization
    return Math.random() > 0.2; // 80% success rate
  }

  async consolidateServices(systemState) {
    logger.info('Consolidating redundant services');
    // Implement service consolidation
    return Math.random() > 0.25; // 75% success rate
  }

  async archiveData(systemState) {
    logger.info('Archiving data for compliance');
    // Implement data archiving
    return Math.random() > 0.1; // 90% success rate
  }

  async enableAuditLogging(systemState) {
    logger.info('Enabling audit logging');
    // Implement audit logging
    return Math.random() > 0.05; // 95% success rate
  }

  async enableEncryption(systemState) {
    logger.info('Enabling encryption');
    // Implement encryption
    return Math.random() > 0.1; // 90% success rate
  }

  async enforceAccessControl(systemState) {
    logger.info('Enforcing access control');
    // Implement access control
    return Math.random() > 0.1; // 90% success rate
  }

  // Record decision execution
  async recordDecisionExecution(decision, result) {
    try {
      // Temporarily disabled due to foreign key constraint
      logger.info('Autonomous decision executed', {
        policy: decision.policyName,
        action: decision.action,
        priority: decision.priority,
        condition: decision.condition,
        result: result,
        timestamp: decision.timestamp
      });
    } catch (error) {
      logger.error('Failed to record decision execution', error);
    }
  }

  // Evaluate policies
  async evaluatePolicies() {
    try {
      for (const [policyId, policy] of this.autonomousPolicies) {
        const evaluation = this.evaluatePolicyEffectiveness(policyId, policy);
        
        if (evaluation.needsUpdate) {
          await this.updatePolicy(policyId, policy, evaluation);
        }
      }
    } catch (error) {
      logger.error('Policy evaluation error', error);
    }
  }

  // Evaluate policy effectiveness
  evaluatePolicyEffectiveness(policyId, policy) {
    // Simulate policy effectiveness evaluation
    const effectiveness = Math.random();
    const needsUpdate = effectiveness < 0.7; // Update if effectiveness < 70%
    
    return {
      effectiveness,
      needsUpdate,
      recommendations: needsUpdate ? ['Adjust thresholds', 'Add new rules', 'Update actions'] : []
    };
  }

  // Update policy
  async updatePolicy(policyId, policy, evaluation) {
    try {
      logger.info(`Updating policy ${policy.name}`, evaluation);
      
      // Simulate policy update
      policy.lastUpdate = Date.now();
      
      // Record policy update
      await this.recordPolicyUpdate(policyId, policy, evaluation);
    } catch (error) {
      logger.error(`Failed to update policy ${policyId}`, error);
    }
  }

  // Record policy update
  async recordPolicyUpdate(policyId, policy, evaluation) {
    try {
      // Temporarily disabled due to foreign key constraint
      logger.info('Policy updated', {
        policyId,
        policyName: policy.name,
        effectiveness: evaluation.effectiveness,
        needsUpdate: evaluation.needsUpdate,
        recommendations: evaluation.recommendations
      });
    } catch (error) {
      logger.error('Failed to record policy update', error);
    }
  }

  // Perform autonomous optimization
  async performAutonomousOptimization() {
    try {
      // Get optimization recommendations from learning engine
      const optimizations = await this.learningEngine.performOptimizationLearning();
      
      // Apply optimizations
      for (const optimization of optimizations) {
        await this.applyOptimization(optimization);
      }
    } catch (error) {
      logger.error('Autonomous optimization error', error);
    }
  }

  // Apply optimization
  async applyOptimization(optimization) {
    try {
      logger.info(`Applying optimization: ${optimization.type}`, optimization);
      
      // Implement optimization
      const success = await this.executeAction(optimization.suggestedImprovement, {});
      
      if (success) {
        await this.recordOptimization(optimization, 'success');
      } else {
        await this.recordOptimization(optimization, 'failed');
      }
    } catch (error) {
      logger.error('Failed to apply optimization', error);
    }
  }

  // Record optimization
  async recordOptimization(optimization, result) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'optimization-applied',
          details: {
            type: optimization.type,
            agentId: optimization.agentId,
            suggestedImprovement: optimization.suggestedImprovement,
            expectedImprovement: optimization.expectedImprovement,
            result: result
          },
          metadata: optimization,
          userId: 'autonomous-system',
          organizationId: 'system'
        }
      });
    } catch (error) {
      logger.error('Failed to record optimization', error);
    }
  }

  // Perform autonomous monitoring
  async performAutonomousMonitoring() {
    try {
      // Monitor system health
      const healthStatus = this.selfHealingSystem.getSystemHealthStatus();
      
      // Monitor agent orchestration
      const agentStatus = this.agentOrchestrator.getStatus();
      
      // Monitor learning engine
      const learningStatus = this.learningEngine.getStatus();
      
      // Emit monitoring data
      this.emit('autonomous-monitoring', {
        health: healthStatus,
        agents: agentStatus,
        learning: learningStatus,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Autonomous monitoring error', error);
    }
  }

  // Get autonomous platform status
  getAutonomousPlatformStatus() {
    return {
      autonomousMode: this.autonomousMode,
      totalPolicies: this.autonomousPolicies.size,
      activePolicies: Array.from(this.autonomousPolicies.values()).filter(p => p.enabled).length,
      agentOrchestrator: this.agentOrchestrator ? this.agentOrchestrator.getStatus() : null,
      learningEngine: this.learningEngine ? this.learningEngine.getStatus() : null,
      selfHealingSystem: this.selfHealingSystem ? this.selfHealingSystem.getSystemHealthStatus() : null,
      lastUpdate: new Date().toISOString()
    };
  }

  // Enable/disable autonomous mode
  setAutonomousMode(enabled) {
    this.autonomousMode = enabled;
    logger.info(`Autonomous mode ${enabled ? 'enabled' : 'disabled'}`);
    
    this.emit('autonomous-mode-changed', { enabled });
  }

  // Get autonomous policies
  getAutonomousPolicies() {
    return Array.from(this.autonomousPolicies.entries()).map(([id, policy]) => ({
      id,
      name: policy.name,
      description: policy.description,
      rules: policy.rules.length,
      enabled: policy.enabled,
      lastUpdate: policy.lastUpdate
    }));
  }

  // Update autonomous policy
  updateAutonomousPolicy(policyId, updates) {
    const policy = this.autonomousPolicies.get(policyId);
    if (policy) {
      Object.assign(policy, updates);
      policy.lastUpdate = Date.now();
      logger.info(`Updated autonomous policy: ${policy.name}`);
    }
  }
}

module.exports = AutonomousPlatformManager;

