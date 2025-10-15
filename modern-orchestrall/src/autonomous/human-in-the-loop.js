// src/autonomous/human-in-the-loop.js - Human-in-the-Loop Management System
const EventEmitter = require('events');
const logger = require('../utils/logger');
const database = require('../database');

class HumanInTheLoopSystem extends EventEmitter {
  constructor() {
    super();
    this.prisma = null;
    this.approvalWorkflows = new Map();
    this.escalationRules = new Map();
    this.interventionPoints = new Map();
    this.humanOversight = new Map();
    this.initializeHITLFramework();
  }

  async initialize() {
    this.prisma = database.client;
    await this.loadHITLConfigurations();
    await this.startHITLMonitoring();
  }

  // Initialize HITL framework
  initializeHITLFramework() {
    // Critical Decision Points requiring human approval
    this.interventionPoints.set('financial-operations', {
      name: 'Financial Operations',
      description: 'Any operation involving financial transactions or cost implications',
      triggers: [
        'payment-processing',
        'billing-changes',
        'cost-optimization',
        'resource-scaling > $1000',
        'subscription-changes'
      ],
      approvalRequired: true,
      approvers: ['finance-manager', 'cfo'],
      timeout: 3600000, // 1 hour
      escalationLevel: 'critical',
      autoApprovalThreshold: 100, // Auto-approve if < $100
      riskLevel: 'high'
    });

    this.interventionPoints.set('security-operations', {
      name: 'Security Operations',
      description: 'Security-related changes and threat responses',
      triggers: [
        'security-patch-application',
        'access-control-changes',
        'firewall-modifications',
        'encryption-changes',
        'threat-response-actions'
      ],
      approvalRequired: true,
      approvers: ['security-admin', 'ciso'],
      timeout: 1800000, // 30 minutes
      escalationLevel: 'critical',
      autoApprovalThreshold: null, // Always require approval
      riskLevel: 'critical'
    });

    this.interventionPoints.set('data-operations', {
      name: 'Data Operations',
      description: 'Data management, migration, and processing operations',
      triggers: [
        'data-migration',
        'data-deletion',
        'backup-operations',
        'data-export',
        'privacy-compliance-changes'
      ],
      approvalRequired: true,
      approvers: ['data-admin', 'dpo'],
      timeout: 7200000, // 2 hours
      escalationLevel: 'high',
      autoApprovalThreshold: null,
      riskLevel: 'high'
    });

    this.interventionPoints.set('infrastructure-changes', {
      name: 'Infrastructure Changes',
      description: 'System architecture and infrastructure modifications',
      triggers: [
        'server-scaling',
        'database-changes',
        'network-modifications',
        'deployment-changes',
        'configuration-updates'
      ],
      approvalRequired: true,
      approvers: ['devops-engineer', 'cto'],
      timeout: 5400000, // 1.5 hours
      escalationLevel: 'high',
      autoApprovalThreshold: 500, // Auto-approve minor changes
      riskLevel: 'medium'
    });

    this.interventionPoints.set('business-process-changes', {
      name: 'Business Process Changes',
      description: 'Workflow and business process modifications',
      triggers: [
        'workflow-modifications',
        'approval-process-changes',
        'business-rule-updates',
        'integration-changes',
        'user-permission-changes'
      ],
      approvalRequired: true,
      approvers: ['business-analyst', 'process-owner'],
      timeout: 10800000, // 3 hours
      escalationLevel: 'medium',
      autoApprovalThreshold: 200,
      riskLevel: 'medium'
    });

    this.interventionPoints.set('customer-facing-changes', {
      name: 'Customer-Facing Changes',
      description: 'Changes that directly impact customer experience',
      triggers: [
        'ui-changes',
        'api-changes',
        'feature-releases',
        'pricing-changes',
        'service-level-changes'
      ],
      approvalRequired: true,
      approvers: ['product-manager', 'customer-success'],
      timeout: 14400000, // 4 hours
      escalationLevel: 'medium',
      autoApprovalThreshold: 300,
      riskLevel: 'medium'
    });

    // Escalation Rules
    this.escalationRules.set('timeout-escalation', {
      name: 'Timeout Escalation',
      description: 'Escalate when approval timeout is reached',
      conditions: ['approval-timeout'],
      actions: ['notify-manager', 'escalate-to-director', 'auto-approve-if-low-risk'],
      priority: 'high'
    });

    this.escalationRules.set('risk-escalation', {
      name: 'Risk Escalation',
      description: 'Escalate based on risk level assessment',
      conditions: ['high-risk-detected', 'critical-risk-detected'],
      actions: ['notify-executives', 'require-multiple-approvers', 'block-auto-approval'],
      priority: 'critical'
    });

    this.escalationRules.set('pattern-escalation', {
      name: 'Pattern Escalation',
      description: 'Escalate based on unusual patterns or anomalies',
      conditions: ['unusual-activity', 'anomaly-detected', 'pattern-break'],
      actions: ['notify-security', 'require-additional-approval', 'investigate-pattern'],
      priority: 'medium'
    });
  }

  // Load HITL configurations from database
  async loadHITLConfigurations() {
    try {
      // Load approval workflows
      const workflows = await this.prisma.auditLog.findMany({
        where: {
          action: 'hitl-workflow-created'
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      for (const workflow of workflows) {
        this.approvalWorkflows.set(workflow.id, {
          ...workflow.details,
          status: 'active',
          createdAt: workflow.createdAt
        });
      }

      logger.info(`Loaded ${this.approvalWorkflows.size} HITL workflows`);
    } catch (error) {
      logger.error('Failed to load HITL configurations', error);
    }
  }

  // Start HITL monitoring
  startHITLMonitoring() {
    // Monitor pending approvals
    setInterval(() => {
      this.monitorPendingApprovals();
    }, 60000); // Every minute

    // Monitor escalation triggers
    setInterval(() => {
      this.monitorEscalationTriggers();
    }, 30000); // Every 30 seconds

    // Monitor human oversight
    setInterval(() => {
      this.monitorHumanOversight();
    }, 120000); // Every 2 minutes

    logger.info('HITL monitoring started');
  }

  // Check if operation requires human approval
  async requiresHumanApproval(operation, context) {
    try {
      const interventionPoint = this.findInterventionPoint(operation, context);
      
      if (!interventionPoint) {
        return { requiresApproval: false, reason: 'No intervention point found' };
      }

      // Check auto-approval threshold
      if (interventionPoint.autoApprovalThreshold && 
          context.cost && 
          context.cost <= interventionPoint.autoApprovalThreshold) {
        return { 
          requiresApproval: false, 
          reason: 'Within auto-approval threshold',
          interventionPoint: interventionPoint.name
        };
      }

      // Check risk level
      if (context.riskLevel && context.riskLevel === 'low' && interventionPoint.riskLevel !== 'critical') {
        return { 
          requiresApproval: false, 
          reason: 'Low risk operation',
          interventionPoint: interventionPoint.name
        };
      }

      return {
        requiresApproval: true,
        interventionPoint: interventionPoint.name,
        approvers: interventionPoint.approvers,
        timeout: interventionPoint.timeout,
        escalationLevel: interventionPoint.escalationLevel,
        riskLevel: interventionPoint.riskLevel
      };
    } catch (error) {
      logger.error('Failed to check approval requirement', error);
      return { requiresApproval: true, reason: 'Error in approval check' };
    }
  }

  // Find intervention point for operation
  findInterventionPoint(operation, context) {
    for (const [pointId, point] of this.interventionPoints) {
      if (point.triggers.includes(operation) || 
          point.triggers.some(trigger => operation.includes(trigger))) {
        return point;
      }
    }
    return null;
  }

  // Create approval request
  async createApprovalRequest(operation, context, decision) {
    try {
      const approvalInfo = await this.requiresHumanApproval(operation, context);
      
      if (!approvalInfo.requiresApproval) {
        return {
          approved: true,
          reason: approvalInfo.reason,
          autoApproved: true,
          timestamp: new Date().toISOString()
        };
      }

      const approvalRequest = {
        id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        operation,
        context,
        decision,
        interventionPoint: approvalInfo.interventionPoint,
        approvers: approvalInfo.approvers,
        status: 'pending',
        createdAt: new Date().toISOString(),
        timeout: approvalInfo.timeout,
        escalationLevel: approvalInfo.escalationLevel,
        riskLevel: approvalInfo.riskLevel,
        approvals: [],
        rejections: []
      };

      // Store approval request
      await this.storeApprovalRequest(approvalRequest);

      // Notify approvers
      await this.notifyApprovers(approvalRequest);

      // Start timeout monitoring
      this.startApprovalTimeout(approvalRequest);

      logger.info(`Created approval request: ${approvalRequest.id}`, {
        operation,
        interventionPoint: approvalInfo.interventionPoint,
        approvers: approvalInfo.approvers.length
      });

      return {
        approved: false,
        approvalRequestId: approvalRequest.id,
        status: 'pending',
        approvers: approvalInfo.approvers,
        estimatedApprovalTime: approvalInfo.timeout
      };
    } catch (error) {
      logger.error('Failed to create approval request', error);
      throw error;
    }
  }

  // Store approval request
  async storeApprovalRequest(approvalRequest) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'approval-request-created',
          details: {
            approvalRequestId: approvalRequest.id,
            operation: approvalRequest.operation,
            interventionPoint: approvalRequest.interventionPoint,
            status: approvalRequest.status,
            approvers: approvalRequest.approvers,
            escalationLevel: approvalRequest.escalationLevel,
            riskLevel: approvalRequest.riskLevel
          },
          metadata: approvalRequest,
          userId: 'autonomous-system',
          organizationId: 'system'
        }
      });
    } catch (error) {
      logger.error('Failed to store approval request', error);
    }
  }

  // Notify approvers
  async notifyApprovers(approvalRequest) {
    try {
      for (const approver of approvalRequest.approvers) {
        // Simulate notification (in production, this would send actual notifications)
        logger.info(`Notifying approver: ${approver}`, {
          approvalRequestId: approvalRequest.id,
          operation: approvalRequest.operation,
          urgency: approvalRequest.escalationLevel
        });

        // Emit notification event
        this.emit('approver-notification', {
          approver,
          approvalRequest,
          notificationType: 'approval-required'
        });
      }
    } catch (error) {
      logger.error('Failed to notify approvers', error);
    }
  }

  // Start approval timeout monitoring
  startApprovalTimeout(approvalRequest) {
    setTimeout(async () => {
      await this.handleApprovalTimeout(approvalRequest);
    }, approvalRequest.timeout);
  }

  // Handle approval timeout
  async handleApprovalTimeout(approvalRequest) {
    try {
      if (approvalRequest.status === 'pending') {
        logger.warn(`Approval request timeout: ${approvalRequest.id}`);
        
        // Check if we can auto-approve based on risk level
        if (approvalRequest.riskLevel === 'low' || approvalRequest.riskLevel === 'medium') {
          await this.autoApproveOnTimeout(approvalRequest);
        } else {
          await this.escalateApprovalRequest(approvalRequest);
        }
      }
    } catch (error) {
      logger.error('Failed to handle approval timeout', error);
    }
  }

  // Auto-approve on timeout for low-risk operations
  async autoApproveOnTimeout(approvalRequest) {
    try {
      approvalRequest.status = 'auto-approved';
      approvalRequest.autoApproved = true;
      approvalRequest.approvedAt = new Date().toISOString();
      approvalRequest.approvedBy = 'system-timeout';

      await this.updateApprovalRequest(approvalRequest);

      logger.info(`Auto-approved on timeout: ${approvalRequest.id}`, {
        reason: 'Low risk operation timeout',
        riskLevel: approvalRequest.riskLevel
      });

      // Emit approval event
      this.emit('approval-completed', {
        approvalRequest,
        approved: true,
        autoApproved: true,
        reason: 'timeout-auto-approval'
      });
    } catch (error) {
      logger.error('Failed to auto-approve on timeout', error);
    }
  }

  // Escalate approval request
  async escalateApprovalRequest(approvalRequest) {
    try {
      const escalationRule = this.escalationRules.get('timeout-escalation');
      
      logger.warn(`Escalating approval request: ${approvalRequest.id}`, {
        escalationLevel: approvalRequest.escalationLevel,
        riskLevel: approvalRequest.riskLevel
      });

      // Notify escalation contacts
      await this.notifyEscalationContacts(approvalRequest, escalationRule);

      // Update approval request
      approvalRequest.status = 'escalated';
      approvalRequest.escalatedAt = new Date().toISOString();
      await this.updateApprovalRequest(approvalRequest);

      // Emit escalation event
      this.emit('approval-escalated', {
        approvalRequest,
        escalationRule,
        reason: 'timeout-escalation'
      });
    } catch (error) {
      logger.error('Failed to escalate approval request', error);
    }
  }

  // Notify escalation contacts
  async notifyEscalationContacts(approvalRequest, escalationRule) {
    try {
      const escalationContacts = this.getEscalationContacts(approvalRequest.escalationLevel);
      
      for (const contact of escalationContacts) {
        logger.info(`Notifying escalation contact: ${contact}`, {
          approvalRequestId: approvalRequest.id,
          escalationLevel: approvalRequest.escalationLevel
        });

        // Emit escalation notification event
        this.emit('escalation-notification', {
          contact,
          approvalRequest,
          escalationRule,
          notificationType: 'escalation-required'
        });
      }
    } catch (error) {
      logger.error('Failed to notify escalation contacts', error);
    }
  }

  // Get escalation contacts based on level
  getEscalationContacts(escalationLevel) {
    const contacts = {
      'critical': ['ceo', 'cto', 'ciso', 'cfo'],
      'high': ['vp-engineering', 'security-director', 'finance-director'],
      'medium': ['engineering-manager', 'security-manager', 'finance-manager'],
      'low': ['team-lead', 'security-analyst', 'finance-analyst']
    };

    return contacts[escalationLevel] || contacts['medium'];
  }

  // Process approval response
  async processApprovalResponse(approvalRequestId, approver, decision, comments) {
    try {
      const approvalRequest = await this.getApprovalRequest(approvalRequestId);
      
      if (!approvalRequest) {
        throw new Error(`Approval request ${approvalRequestId} not found`);
      }

      if (approvalRequest.status !== 'pending') {
        throw new Error(`Approval request ${approvalRequestId} is no longer pending`);
      }

      // Add approval/rejection
      if (decision === 'approve') {
        approvalRequest.approvals.push({
          approver,
          approvedAt: new Date().toISOString(),
          comments
        });
      } else {
        approvalRequest.rejections.push({
          approver,
          rejectedAt: new Date().toISOString(),
          comments
        });
      }

      // Check if approval is complete
      const isApproved = this.checkApprovalComplete(approvalRequest);
      
      if (isApproved) {
        approvalRequest.status = 'approved';
        approvalRequest.approvedAt = new Date().toISOString();
        approvalRequest.approvedBy = approver;
      } else if (approvalRequest.rejections.length > 0) {
        approvalRequest.status = 'rejected';
        approvalRequest.rejectedAt = new Date().toISOString();
        approvalRequest.rejectedBy = approver;
      }

      // Update approval request
      await this.updateApprovalRequest(approvalRequest);

      // Record approval response
      await this.recordApprovalResponse(approvalRequestId, approver, decision, comments);

      logger.info(`Processed approval response: ${approvalRequestId}`, {
        approver,
        decision,
        status: approvalRequest.status
      });

      // Emit approval response event
      this.emit('approval-response-processed', {
        approvalRequest,
        approver,
        decision,
        comments,
        isApproved
      });

      return {
        success: true,
        status: approvalRequest.status,
        isApproved,
        message: `Approval ${decision}d by ${approver}`
      };
    } catch (error) {
      logger.error('Failed to process approval response', error);
      throw error;
    }
  }

  // Check if approval is complete
  checkApprovalComplete(approvalRequest) {
    // Simple majority approval for now
    const totalApprovers = approvalRequest.approvers.length;
    const approvals = approvalRequest.approvals.length;
    const rejections = approvalRequest.rejections.length;

    // If any rejection, it's rejected
    if (rejections > 0) {
      return false;
    }

    // If majority approval, it's approved
    return approvals >= Math.ceil(totalApprovers / 2);
  }

  // Get approval request
  async getApprovalRequest(approvalRequestId) {
    try {
      const auditLog = await this.prisma.auditLog.findFirst({
        where: {
          action: 'approval-request-created',
          'details.approvalRequestId': approvalRequestId
        }
      });

      return auditLog ? auditLog.metadata : null;
    } catch (error) {
      logger.error('Failed to get approval request', error);
      return null;
    }
  }

  // Update approval request
  async updateApprovalRequest(approvalRequest) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'approval-request-updated',
          details: {
            approvalRequestId: approvalRequest.id,
            status: approvalRequest.status,
            approvals: approvalRequest.approvals.length,
            rejections: approvalRequest.rejections.length
          },
          metadata: approvalRequest,
          userId: 'autonomous-system',
          organizationId: 'system'
        }
      });
    } catch (error) {
      logger.error('Failed to update approval request', error);
    }
  }

  // Record approval response
  async recordApprovalResponse(approvalRequestId, approver, decision, comments) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'approval-response-recorded',
          details: {
            approvalRequestId,
            approver,
            decision,
            comments
          },
          metadata: { comments },
          userId: approver,
          organizationId: 'system'
        }
      });
    } catch (error) {
      logger.error('Failed to record approval response', error);
    }
  }

  // Monitor pending approvals
  async monitorPendingApprovals() {
    try {
      const pendingApprovals = await this.prisma.auditLog.findMany({
        where: {
          action: 'approval-request-created',
          'metadata.status': 'pending'
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const approval of pendingApprovals) {
        const timeSinceCreated = Date.now() - new Date(approval.createdAt).getTime();
        const timeout = approval.metadata.timeout || 3600000; // Default 1 hour

        if (timeSinceCreated > timeout) {
          await this.handleApprovalTimeout(approval.metadata);
        }
      }
    } catch (error) {
      logger.error('Failed to monitor pending approvals', error);
    }
  }

  // Monitor escalation triggers
  async monitorEscalationTriggers() {
    try {
      // Check for high-risk operations
      const highRiskOperations = await this.prisma.auditLog.findMany({
        where: {
          action: 'autonomous-decision-executed',
          'details.priority': 'critical'
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      for (const operation of highRiskOperations) {
        await this.checkEscalationTriggers(operation);
      }
    } catch (error) {
      logger.error('Failed to monitor escalation triggers', error);
    }
  }

  // Check escalation triggers
  async checkEscalationTriggers(operation) {
    try {
      const escalationRule = this.escalationRules.get('risk-escalation');
      
      if (operation.details.priority === 'critical') {
        await this.triggerEscalation(operation, escalationRule);
      }
    } catch (error) {
      logger.error('Failed to check escalation triggers', error);
    }
  }

  // Trigger escalation
  async triggerEscalation(operation, escalationRule) {
    try {
      logger.warn(`Triggering escalation for operation: ${operation.id}`, {
        priority: operation.details.priority,
        action: operation.details.action
      });

      // Notify escalation contacts
      const escalationContacts = this.getEscalationContacts('critical');
      for (const contact of escalationContacts) {
        this.emit('escalation-triggered', {
          contact,
          operation,
          escalationRule,
          notificationType: 'critical-operation'
        });
      }
    } catch (error) {
      logger.error('Failed to trigger escalation', error);
    }
  }

  // Monitor human oversight
  async monitorHumanOversight() {
    try {
      // Check for human oversight requirements
      const oversightRequirements = await this.getOversightRequirements();
      
      for (const requirement of oversightRequirements) {
        await this.checkOversightCompliance(requirement);
      }
    } catch (error) {
      logger.error('Failed to monitor human oversight', error);
    }
  }

  // Get oversight requirements
  async getOversightRequirements() {
    // Simulate oversight requirements
    return [
      {
        type: 'daily-review',
        description: 'Daily review of autonomous operations',
        frequency: 'daily',
        lastReview: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        requiredBy: 'operations-manager'
      },
      {
        type: 'weekly-audit',
        description: 'Weekly audit of autonomous decisions',
        frequency: 'weekly',
        lastReview: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        requiredBy: 'audit-manager'
      }
    ];
  }

  // Check oversight compliance
  async checkOversightCompliance(requirement) {
    try {
      const timeSinceLastReview = Date.now() - requirement.lastReview.getTime();
      const reviewInterval = this.getReviewInterval(requirement.frequency);

      if (timeSinceLastReview > reviewInterval) {
        logger.warn(`Oversight requirement overdue: ${requirement.type}`, {
          requiredBy: requirement.requiredBy,
          daysOverdue: Math.floor(timeSinceLastReview / (24 * 60 * 60 * 1000))
        });

        // Notify oversight contact
        this.emit('oversight-overdue', {
          requirement,
          daysOverdue: Math.floor(timeSinceLastReview / (24 * 60 * 60 * 1000))
        });
      }
    } catch (error) {
      logger.error('Failed to check oversight compliance', error);
    }
  }

  // Get review interval
  getReviewInterval(frequency) {
    const intervals = {
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000,
      'quarterly': 90 * 24 * 60 * 60 * 1000
    };

    return intervals[frequency] || intervals['weekly'];
  }

  // Get HITL status
  getHITLStatus() {
    return {
      totalInterventionPoints: this.interventionPoints.size,
      activeApprovalRequests: this.approvalWorkflows.size,
      escalationRules: this.escalationRules.size,
      lastUpdate: new Date().toISOString(),
      interventionPoints: Array.from(this.interventionPoints.entries()).map(([id, point]) => ({
        id,
        name: point.name,
        triggers: point.triggers.length,
        approvalRequired: point.approvalRequired,
        riskLevel: point.riskLevel
      }))
    };
  }

  // Get pending approvals
  async getPendingApprovals() {
    try {
      const pendingApprovals = await this.prisma.auditLog.findMany({
        where: {
          action: 'approval-request-created',
          'metadata.status': 'pending'
        },
        orderBy: { createdAt: 'desc' }
      });

      return pendingApprovals.map(approval => ({
        id: approval.metadata.id,
        operation: approval.metadata.operation,
        interventionPoint: approval.metadata.interventionPoint,
        approvers: approval.metadata.approvers,
        createdAt: approval.createdAt,
        timeout: approval.metadata.timeout,
        escalationLevel: approval.metadata.escalationLevel,
        riskLevel: approval.metadata.riskLevel
      }));
    } catch (error) {
      logger.error('Failed to get pending approvals', error);
      return [];
    }
  }

  // Get approval history
  async getApprovalHistory(limit = 50) {
    try {
      const approvals = await this.prisma.auditLog.findMany({
        where: {
          action: {
            in: ['approval-request-created', 'approval-response-recorded']
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return approvals.map(approval => ({
        id: approval.metadata.id,
        operation: approval.metadata.operation,
        status: approval.metadata.status,
        createdAt: approval.createdAt,
        action: approval.action
      }));
    } catch (error) {
      logger.error('Failed to get approval history', error);
      return [];
    }
  }
}

module.exports = HumanInTheLoopSystem;
