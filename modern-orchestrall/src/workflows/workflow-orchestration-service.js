const { PrismaClient } = require('@prisma/client');
const EventEmitter = require('events');

class WorkflowOrchestrationService extends EventEmitter {
  constructor(prisma) {
    super();
    this.prisma = prisma;
    this.activeWorkflows = new Map();
    this.workflowTemplates = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Initialize default workflow templates
    await this.initializeWorkflowTemplates();
    
    // Start workflow monitoring
    this.startWorkflowMonitoring();
    
    this.isInitialized = true;
    console.log('✅ Workflow Orchestration Service initialized');
  }

  async initializeWorkflowTemplates() {
    const templates = [
      {
        id: 'farmer_onboarding',
        name: 'Farmer Onboarding',
        description: 'Automated farmer registration and verification process',
        steps: [
          {
            id: 'validate_farmer_data',
            name: 'Validate Farmer Data',
            type: 'validation',
            config: {
              requiredFields: ['name', 'farmLocation', 'region', 'phone'],
              validationRules: {
                phone: 'phone_format',
                email: 'email_format'
              }
            }
          },
          {
            id: 'create_farmer_profile',
            name: 'Create Farmer Profile',
            type: 'database',
            config: {
              model: 'FarmerProfile',
              operation: 'create'
            }
          },
          {
            id: 'send_welcome_notification',
            name: 'Send Welcome Notification',
            type: 'notification',
            config: {
              channels: ['email', 'sms'],
              template: 'farmer_welcome'
            }
          },
          {
            id: 'schedule_kyc_verification',
            name: 'Schedule KYC Verification',
            type: 'task',
            config: {
              delay: '24h',
              task: 'kyc_verification'
            }
          }
        ],
        triggers: [
          {
            type: 'api',
            endpoint: '/api/agricultural/farmers',
            method: 'POST'
          }
        ]
      },
      {
        id: 'crop_monitoring',
        name: 'Crop Monitoring',
        description: 'Automated crop health monitoring and alerts',
        steps: [
          {
            id: 'check_crop_health',
            name: 'Check Crop Health',
            type: 'data_analysis',
            config: {
              dataSource: 'crop_health_records',
              analysisType: 'health_score'
            }
          },
          {
            id: 'evaluate_health_threshold',
            name: 'Evaluate Health Threshold',
            type: 'condition',
            config: {
              condition: 'health_score < 70',
              trueAction: 'send_alert',
              falseAction: 'continue_monitoring'
            }
          },
          {
            id: 'send_health_alert',
            name: 'Send Health Alert',
            type: 'notification',
            config: {
              channels: ['push', 'sms'],
              template: 'crop_health_alert',
              priority: 'high'
            }
          },
          {
            id: 'schedule_follow_up',
            name: 'Schedule Follow Up',
            type: 'task',
            config: {
              delay: '48h',
              task: 'health_follow_up'
            }
          }
        ],
        triggers: [
          {
            type: 'schedule',
            cron: '0 */6 * * *' // Every 6 hours
          },
          {
            type: 'event',
            event: 'crop_health_updated'
          }
        ]
      },
      {
        id: 'market_price_alert',
        name: 'Market Price Alert',
        description: 'Monitor market prices and send alerts',
        steps: [
          {
            id: 'fetch_market_prices',
            name: 'Fetch Market Prices',
            type: 'external_api',
            config: {
              api: 'market_intelligence',
              endpoint: 'getCropPrices'
            }
          },
          {
            id: 'analyze_price_change',
            name: 'Analyze Price Change',
            type: 'data_analysis',
            config: {
              analysisType: 'price_change_percentage',
              threshold: 10
            }
          },
          {
            id: 'create_market_alert',
            name: 'Create Market Alert',
            type: 'database',
            config: {
              model: 'MarketAlert',
              operation: 'create'
            }
          },
          {
            id: 'notify_farmers',
            name: 'Notify Farmers',
            type: 'notification',
            config: {
              channels: ['push', 'sms'],
              template: 'market_price_alert',
              target: 'affected_farmers'
            }
          }
        ],
        triggers: [
          {
            type: 'schedule',
            cron: '0 */2 * * *' // Every 2 hours
          }
        ]
      },
      {
        id: 'loan_approval',
        name: 'Loan Approval',
        description: 'Automated loan application processing',
        steps: [
          {
            id: 'validate_loan_application',
            name: 'Validate Loan Application',
            type: 'validation',
            config: {
              requiredFields: ['amount', 'purpose', 'tenure'],
              businessRules: {
                maxAmount: 100000,
                minTenure: 6,
                maxTenure: 60
              }
            }
          },
          {
            id: 'check_credit_score',
            name: 'Check Credit Score',
            type: 'data_analysis',
            config: {
              dataSource: 'credit_scores',
              analysisType: 'credit_assessment'
            }
          },
          {
            id: 'make_approval_decision',
            name: 'Make Approval Decision',
            type: 'decision',
            config: {
              conditions: [
                {
                  condition: 'credit_score >= 700',
                  action: 'approve',
                  autoApprove: true
                },
                {
                  condition: 'credit_score >= 600',
                  action: 'manual_review',
                  autoApprove: false
                },
                {
                  condition: 'credit_score < 600',
                  action: 'reject',
                  autoApprove: true
                }
              ]
            }
          },
          {
            id: 'notify_loan_decision',
            name: 'Notify Loan Decision',
            type: 'notification',
            config: {
              channels: ['email', 'sms'],
              template: 'loan_decision'
            }
          }
        ],
        triggers: [
          {
            type: 'api',
            endpoint: '/api/agricultural/loans',
            method: 'POST'
          }
        ]
      },
      {
        id: 'insurance_claim_processing',
        name: 'Insurance Claim Processing',
        description: 'Automated insurance claim processing',
        steps: [
          {
            id: 'validate_claim_data',
            name: 'Validate Claim Data',
            type: 'validation',
            config: {
              requiredFields: ['damageType', 'damagePercentage', 'damageArea'],
              businessRules: {
                minDamagePercentage: 10,
                maxDamagePercentage: 100
              }
            }
          },
          {
            id: 'assess_damage',
            name: 'Assess Damage',
            type: 'data_analysis',
            config: {
              analysisType: 'damage_assessment',
              useAI: true
            }
          },
          {
            id: 'calculate_claim_amount',
            name: 'Calculate Claim Amount',
            type: 'calculation',
            config: {
              formula: 'damage_percentage * sum_insured / 100',
              maxClaimAmount: 'sum_insured'
            }
          },
          {
            id: 'process_claim',
            name: 'Process Claim',
            type: 'decision',
            config: {
              conditions: [
                {
                  condition: 'claim_amount <= 50000',
                  action: 'auto_approve',
                  autoApprove: true
                },
                {
                  condition: 'claim_amount > 50000',
                  action: 'manual_review',
                  autoApprove: false
                }
              ]
            }
          },
          {
            id: 'notify_claim_status',
            name: 'Notify Claim Status',
            type: 'notification',
            config: {
              channels: ['email', 'sms'],
              template: 'claim_status_update'
            }
          }
        ],
        triggers: [
          {
            type: 'api',
            endpoint: '/api/agricultural/insurance/claims',
            method: 'POST'
          }
        ]
      }
    ];

    for (const template of templates) {
      this.workflowTemplates.set(template.id, template);
    }

    console.log(`✅ Initialized ${templates.length} workflow templates`);
  }

  async createWorkflow(templateId, context, options = {}) {
    try {
      const template = this.workflowTemplates.get(templateId);
      if (!template) {
        throw new Error(`Workflow template '${templateId}' not found`);
      }

      const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const workflow = {
        id: workflowId,
        templateId,
        name: template.name,
        description: template.description,
        status: 'pending',
        context: {
          ...context,
          organizationId: context.organizationId,
          userId: context.userId
        },
        steps: template.steps.map(step => ({
          ...step,
          status: 'pending',
          startedAt: null,
          completedAt: null,
          result: null,
          error: null
        })),
        currentStepIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        options
      };

      this.activeWorkflows.set(workflowId, workflow);

      // Emit workflow created event
      this.emit('workflow:created', { workflowId, templateId, context });

      console.log(`🔄 Created workflow: ${workflowId} (${template.name})`);
      return workflow;
    } catch (error) {
      console.error('Failed to create workflow:', error);
      throw error;
    }
  }

  async executeWorkflow(workflowId) {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found`);
      }

      workflow.status = 'running';
      workflow.updatedAt = new Date();

      console.log(`🚀 Executing workflow: ${workflowId}`);

      // Execute steps sequentially
      for (let i = workflow.currentStepIndex; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        try {
          console.log(`📋 Executing step ${i + 1}/${workflow.steps.length}: ${step.name}`);
          
          step.status = 'running';
          step.startedAt = new Date();
          workflow.currentStepIndex = i;

          const result = await this.executeStep(step, workflow.context);
          
          step.status = 'completed';
          step.completedAt = new Date();
          step.result = result;

          // Emit step completed event
          this.emit('workflow:step:completed', { workflowId, stepIndex: i, step, result });

        } catch (error) {
          console.error(`❌ Step ${i + 1} failed: ${error.message}`);
          
          step.status = 'failed';
          step.completedAt = new Date();
          step.error = error.message;

          workflow.status = 'failed';
          workflow.updatedAt = new Date();

          // Emit step failed event
          this.emit('workflow:step:failed', { workflowId, stepIndex: i, step, error });

          throw error;
        }
      }

      // All steps completed successfully
      workflow.status = 'completed';
      workflow.updatedAt = new Date();

      // Emit workflow completed event
      this.emit('workflow:completed', { workflowId, workflow });

      console.log(`✅ Workflow completed: ${workflowId}`);
      return workflow;

    } catch (error) {
      console.error(`❌ Workflow execution failed: ${workflowId}`, error);
      
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.status = 'failed';
        workflow.updatedAt = new Date();
      }

      throw error;
    }
  }

  async executeStep(step, context) {
    switch (step.type) {
      case 'validation':
        return await this.executeValidationStep(step, context);
      case 'database':
        return await this.executeDatabaseStep(step, context);
      case 'notification':
        return await this.executeNotificationStep(step, context);
      case 'external_api':
        return await this.executeExternalApiStep(step, context);
      case 'data_analysis':
        return await this.executeDataAnalysisStep(step, context);
      case 'condition':
        return await this.executeConditionStep(step, context);
      case 'decision':
        return await this.executeDecisionStep(step, context);
      case 'calculation':
        return await this.executeCalculationStep(step, context);
      case 'task':
        return await this.executeTaskStep(step, context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  async executeValidationStep(step, context) {
    const { config } = step;
    const { requiredFields, validationRules } = config;

    // Check required fields
    for (const field of requiredFields) {
      if (!context[field]) {
        throw new Error(`Required field '${field}' is missing`);
      }
    }

    // Apply validation rules
    if (validationRules) {
      for (const [field, rule] of Object.entries(validationRules)) {
        const value = context[field];
        if (value && !this.validateField(value, rule)) {
          throw new Error(`Field '${field}' failed validation rule '${rule}'`);
        }
      }
    }

    return { validated: true, fields: requiredFields };
  }

  async executeDatabaseStep(step, context) {
    const { config } = step;
    const { model, operation, data } = config;

    switch (operation) {
      case 'create':
        const createData = data || context;
        const created = await this.prisma[model.toLowerCase()].create({
          data: createData
        });
        return { created, id: created.id };
      
      case 'update':
        const updateData = data || context;
        const updated = await this.prisma[model.toLowerCase()].update({
          where: { id: context.id },
          data: updateData
        });
        return { updated, id: updated.id };
      
      case 'find':
        const found = await this.prisma[model.toLowerCase()].findUnique({
          where: { id: context.id }
        });
        return { found };
      
      default:
        throw new Error(`Unknown database operation: ${operation}`);
    }
  }

  async executeNotificationStep(step, context) {
    const { config } = step;
    const { channels, template, priority = 'normal' } = config;

    // This would integrate with the notification services
    const notificationResult = {
      channels,
      template,
      priority,
      sent: true,
      timestamp: new Date().toISOString()
    };

    // Emit notification event for real-time services to handle
    this.emit('notification:send', {
      channels,
      template,
      context,
      priority
    });

    return notificationResult;
  }

  async executeExternalApiStep(step, context) {
    const { config } = step;
    const { api, endpoint, method = 'GET', data } = config;

    // This would integrate with external APIs
    const apiResult = {
      api,
      endpoint,
      method,
      data: data || context,
      response: { success: true },
      timestamp: new Date().toISOString()
    };

    return apiResult;
  }

  async executeDataAnalysisStep(step, context) {
    const { config } = step;
    const { dataSource, analysisType, useAI = false } = config;

    // This would integrate with analytics services
    const analysisResult = {
      dataSource,
      analysisType,
      useAI,
      result: { score: 85, confidence: 0.9 },
      timestamp: new Date().toISOString()
    };

    return analysisResult;
  }

  async executeConditionStep(step, context) {
    const { config } = step;
    const { condition, trueAction, falseAction } = config;

    // Simple condition evaluation (in real implementation, use a proper expression evaluator)
    const conditionResult = this.evaluateCondition(condition, context);
    
    return {
      condition,
      result: conditionResult,
      action: conditionResult ? trueAction : falseAction,
      timestamp: new Date().toISOString()
    };
  }

  async executeDecisionStep(step, context) {
    const { config } = step;
    const { conditions } = config;

    for (const condition of conditions) {
      const result = this.evaluateCondition(condition.condition, context);
      if (result) {
        return {
          condition: condition.condition,
          action: condition.action,
          autoApprove: condition.autoApprove,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      action: 'no_match',
      autoApprove: false,
      timestamp: new Date().toISOString()
    };
  }

  async executeCalculationStep(step, context) {
    const { config } = step;
    const { formula, maxValue } = config;

    // Simple calculation (in real implementation, use a proper formula evaluator)
    const result = this.evaluateFormula(formula, context);
    
    const finalResult = maxValue ? Math.min(result, maxValue) : result;

    return {
      formula,
      result: finalResult,
      timestamp: new Date().toISOString()
    };
  }

  async executeTaskStep(step, context) {
    const { config } = step;
    const { delay, task } = config;

    // Schedule a task for later execution
    const taskResult = {
      task,
      delay,
      scheduledFor: new Date(Date.now() + this.parseDelay(delay)),
      timestamp: new Date().toISOString()
    };

    // Emit task scheduled event
    this.emit('task:scheduled', taskResult);

    return taskResult;
  }

  evaluateCondition(condition, context) {
    // Simple condition evaluation (in real implementation, use a proper expression evaluator)
    // This is a simplified implementation
    return true; // Placeholder
  }

  evaluateFormula(formula, context) {
    // Simple formula evaluation (in real implementation, use a proper formula evaluator)
    // This is a simplified implementation
    return 1000; // Placeholder
  }

  validateField(value, rule) {
    switch (rule) {
      case 'phone_format':
        return /^\+?[\d\s\-\(\)]+$/.test(value);
      case 'email_format':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      default:
        return true;
    }
  }

  parseDelay(delay) {
    const match = delay.match(/^(\d+)([smhd])$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  startWorkflowMonitoring() {
    // Monitor active workflows
    setInterval(() => {
      this.monitorActiveWorkflows();
    }, 30000); // Every 30 seconds

    // Clean up completed workflows
    setInterval(() => {
      this.cleanupCompletedWorkflows();
    }, 300000); // Every 5 minutes
  }

  monitorActiveWorkflows() {
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if (workflow.status === 'running') {
        const now = new Date();
        const runningTime = now - workflow.createdAt;
        
        // Check for stuck workflows (running for more than 1 hour)
        if (runningTime > 60 * 60 * 1000) {
          console.warn(`⚠️ Workflow ${workflowId} has been running for ${Math.round(runningTime / 1000 / 60)} minutes`);
        }
      }
    }
  }

  cleanupCompletedWorkflows() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if ((workflow.status === 'completed' || workflow.status === 'failed') && 
          workflow.updatedAt < cutoffTime) {
        this.activeWorkflows.delete(workflowId);
        console.log(`🧹 Cleaned up old workflow: ${workflowId}`);
      }
    }
  }

  async getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }
    return workflow;
  }

  async getActiveWorkflows(organizationId) {
    const workflows = Array.from(this.activeWorkflows.values())
      .filter(workflow => workflow.context.organizationId === organizationId);
    return workflows;
  }

  async getWorkflowTemplates() {
    return Array.from(this.workflowTemplates.values());
  }

  async triggerWorkflow(templateId, context) {
    try {
      const workflow = await this.createWorkflow(templateId, context);
      await this.executeWorkflow(workflow.id);
      return workflow;
    } catch (error) {
      console.error(`Failed to trigger workflow ${templateId}:`, error);
      throw error;
    }
  }
}

module.exports = WorkflowOrchestrationService;
