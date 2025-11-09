import { StateGraph, START, END, MessageGraph } from 'langgraph';
import { HumanMessage, AIMessage, SystemMessage } from 'langchain/schema';
import { Logger, ServiceError } from '@orchestrall/shared';

const logger = new Logger('langgraph-service');

interface WorkflowState {
  messages: (HumanMessage | AIMessage | SystemMessage)[];
  currentStep: string;
  data: Record<string, any>;
  errors: string[];
  metadata: {
    workflowId: string;
    executionId: string;
    startTime: number;
    organizationId: string;
    userId: string;
  };
}

interface WorkflowNode {
  name: string;
  execute: (state: WorkflowState) => Promise<Partial<WorkflowState>>;
  description?: string;
}

interface WorkflowEdge {
  from: string;
  to: string;
  condition?: (state: WorkflowState) => boolean;
}

class LangGraphWorkflowEngine {
  private workflows: Map<string, StateGraph> = new Map();

  constructor() {
    this.initializeCommonWorkflows();
  }

  private initializeCommonWorkflows(): void {
    // Customer onboarding workflow
    this.createCustomerOnboardingWorkflow();

    // Document processing workflow
    this.createDocumentProcessingWorkflow();

    // Data analysis workflow
    this.createDataAnalysisWorkflow();
  }

  private createCustomerOnboardingWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'validate_input',
        description: 'Validate customer onboarding data',
        execute: async (state) => {
          logger.info('Validating customer input', { executionId: state.metadata.executionId });

          const { customerData } = state.data;
          const errors: string[] = [];

          if (!customerData.email) errors.push('Email is required');
          if (!customerData.name) errors.push('Name is required');
          if (!customerData.organization) errors.push('Organization is required');

          return {
            currentStep: errors.length > 0 ? 'error' : 'create_user',
            errors: errors.length > 0 ? errors : [],
            data: {
              ...state.data,
              validationPassed: errors.length === 0,
            },
          };
        },
      },
      {
        name: 'create_user',
        description: 'Create user account',
        execute: async (state) => {
          logger.info('Creating user account', { executionId: state.metadata.executionId });

          // Mock user creation
          const userId = `user_${Date.now()}`;

          return {
            currentStep: 'setup_organization',
            data: {
              ...state.data,
              userId,
              userCreated: true,
            },
          };
        },
      },
      {
        name: 'setup_organization',
        description: 'Set up organization and permissions',
        execute: async (state) => {
          logger.info('Setting up organization', { executionId: state.metadata.executionId });

          const organizationId = `org_${Date.now()}`;

          return {
            currentStep: 'send_welcome',
            data: {
              ...state.data,
              organizationId,
              organizationSetup: true,
            },
          };
        },
      },
      {
        name: 'send_welcome',
        description: 'Send welcome email and setup notifications',
        execute: async (state) => {
          logger.info('Sending welcome email', { executionId: state.metadata.executionId });

          return {
            currentStep: 'complete',
            data: {
              ...state.data,
              welcomeSent: true,
              onboardingComplete: true,
            },
          };
        },
      },
      {
        name: 'error',
        description: 'Handle validation errors',
        execute: async (state) => {
          logger.error('Workflow validation error', {
            executionId: state.metadata.executionId,
            errors: state.errors,
          });

          return {
            currentStep: 'complete',
            data: {
              ...state.data,
              hasErrors: true,
            },
          };
        },
      },
    ];

    this.createWorkflow('customer-onboarding', nodes, [
      { from: START, to: 'validate_input' },
      { from: 'validate_input', to: 'create_user' },
      { from: 'validate_input', to: 'error' },
      { from: 'create_user', to: 'setup_organization' },
      { from: 'setup_organization', to: 'send_welcome' },
      { from: 'send_welcome', to: END },
      { from: 'error', to: END },
    ]);
  }

  private createDocumentProcessingWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'analyze_document',
        description: 'Analyze document type and content',
        execute: async (state) => {
          const { document } = state.data;

          // Mock document analysis
          const analysis = {
            type: 'invoice',
            confidence: 0.95,
            pages: 3,
            language: 'en',
          };

          return {
            currentStep: 'extract_data',
            data: {
              ...state.data,
              analysis,
            },
          };
        },
      },
      {
        name: 'extract_data',
        description: 'Extract structured data from document',
        execute: async (state) => {
          const { document, analysis } = state.data;

          // Mock data extraction based on document type
          const extractedData = {
            invoiceNumber: 'INV-2024-001',
            date: '2024-01-15',
            amount: 1500.00,
            vendor: 'ABC Corp',
            items: [
              { description: 'Service 1', quantity: 1, price: 1000.00 },
              { description: 'Service 2', quantity: 1, price: 500.00 },
            ],
          };

          return {
            currentStep: 'validate_data',
            data: {
              ...state.data,
              extractedData,
            },
          };
        },
      },
      {
        name: 'validate_data',
        description: 'Validate extracted data',
        execute: async (state) => {
          const { extractedData } = state.data;
          const errors: string[] = [];

          if (!extractedData.invoiceNumber) errors.push('Invoice number missing');
          if (!extractedData.amount || extractedData.amount <= 0) errors.push('Invalid amount');

          return {
            currentStep: errors.length > 0 ? 'retry_extraction' : 'format_output',
            errors: errors.length > 0 ? errors : [],
            data: {
              ...state.data,
              validationPassed: errors.length === 0,
            },
          };
        },
      },
      {
        name: 'retry_extraction',
        description: 'Retry data extraction with better parameters',
        execute: async (state) => {
          // Mock retry logic
          return {
            currentStep: 'format_output',
            data: {
              ...state.data,
              retryAttempted: true,
            },
          };
        },
      },
      {
        name: 'format_output',
        description: 'Format data for downstream systems',
        execute: async (state) => {
          const { extractedData, analysis } = state.data;

          const formattedOutput = {
            documentType: analysis.type,
            confidence: analysis.confidence,
            extractedFields: extractedData,
            processedAt: new Date().toISOString(),
            processingMetadata: {
              workflowId: state.metadata.workflowId,
              executionId: state.metadata.executionId,
            },
          };

          return {
            currentStep: 'complete',
            data: {
              ...state.data,
              formattedOutput,
            },
          };
        },
      },
    ];

    this.createWorkflow('document-processing', nodes, [
      { from: START, to: 'analyze_document' },
      { from: 'analyze_document', to: 'extract_data' },
      { from: 'extract_data', to: 'validate_data' },
      { from: 'validate_data', to: 'format_output' },
      { from: 'validate_data', to: 'retry_extraction' },
      { from: 'retry_extraction', to: 'format_output' },
      { from: 'format_output', to: END },
    ]);
  }

  private createDataAnalysisWorkflow(): void {
    const nodes: WorkflowNode[] = [
      {
        name: 'gather_data',
        description: 'Collect data from various sources',
        execute: async (state) => {
          const { sources } = state.data;

          // Mock data gathering
          const collectedData = {
            salesData: [],
            customerData: [],
            productData: [],
            collectedAt: new Date().toISOString(),
          };

          return {
            currentStep: 'preprocess_data',
            data: {
              ...state.data,
              collectedData,
            },
          };
        },
      },
      {
        name: 'preprocess_data',
        description: 'Clean and preprocess data',
        execute: async (state) => {
          const { collectedData } = state.data;

          // Mock preprocessing
          const processedData = {
            ...collectedData,
            cleaned: true,
            outliersRemoved: 5,
            duplicatesRemoved: 3,
          };

          return {
            currentStep: 'analyze_patterns',
            data: {
              ...state.data,
              processedData,
            },
          };
        },
      },
      {
        name: 'analyze_patterns',
        description: 'Analyze data for patterns and insights',
        execute: async (state) => {
          const { processedData } = state.data;

          // Mock pattern analysis
          const insights = {
            trends: ['upward', 'seasonal'],
            anomalies: [],
            predictions: [],
          };

          return {
            currentStep: 'generate_report',
            data: {
              ...state.data,
              insights,
            },
          };
        },
      },
      {
        name: 'generate_report',
        description: 'Generate comprehensive analysis report',
        execute: async (state) => {
          const { processedData, insights } = state.data;

          const report = {
            title: 'Data Analysis Report',
            summary: 'Analysis completed successfully',
            insights,
            recommendations: [
              'Increase marketing spend in Q3',
              'Optimize inventory levels',
              'Focus on high-value customers',
            ],
            generatedAt: new Date().toISOString(),
            metadata: state.metadata,
          };

          return {
            currentStep: 'complete',
            data: {
              ...state.data,
              report,
            },
          };
        },
      },
    ];

    this.createWorkflow('data-analysis', nodes, [
      { from: START, to: 'gather_data' },
      { from: 'gather_data', to: 'preprocess_data' },
      { from: 'preprocess_data', to: 'analyze_patterns' },
      { from: 'analyze_patterns', to: 'generate_report' },
      { from: 'generate_report', to: END },
    ]);
  }

  private createWorkflow(name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const workflow = new StateGraph({
      channels: {
        messages: 'list',
        currentStep: 'str',
        data: 'dict',
        errors: 'list',
        metadata: 'dict',
      },
    });

    // Add nodes
    nodes.forEach(node => {
      workflow.addNode(node.name, node.execute);
    });

    // Add edges
    edges.forEach(edge => {
      if (edge.condition) {
        workflow.addConditionalEdges(edge.from, edge.condition, {
          [edge.to]: edge.to,
        });
      } else {
        workflow.addEdge(edge.from, edge.to);
      }
    });

    this.workflows.set(name, workflow.compile());
  }

  async executeWorkflow(
    workflowName: string,
    initialState: Partial<WorkflowState>
  ): Promise<WorkflowState> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new ServiceError(`Workflow '${workflowName}' not found`);
    }

    const fullState: WorkflowState = {
      messages: initialState.messages || [],
      currentStep: initialState.currentStep || 'start',
      data: initialState.data || {},
      errors: initialState.errors || [],
      metadata: initialState.metadata || {
        workflowId: 'unknown',
        executionId: 'unknown',
        startTime: Date.now(),
        organizationId: 'unknown',
        userId: 'unknown',
      },
    };

    try {
      logger.info('Starting workflow execution', {
        workflowName,
        executionId: fullState.metadata.executionId,
      });

      const result = await workflow.invoke(fullState);

      logger.info('Workflow execution completed', {
        workflowName,
        executionId: fullState.metadata.executionId,
        duration: Date.now() - fullState.metadata.startTime,
      });

      return result;
    } catch (error) {
      logger.error('Workflow execution failed', {
        workflowName,
        executionId: fullState.metadata.executionId,
        error,
      });

      throw new ServiceError(`Workflow execution failed: ${error.message}`);
    }
  }

  getAvailableWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  async validateWorkflowDefinition(definition: any): Promise<boolean> {
    try {
      // Validate workflow structure
      if (!definition.nodes || !definition.edges) {
        return false;
      }

      // Check for required nodes
      const nodeNames = definition.nodes.map((node: any) => node.name);
      const hasStart = nodeNames.includes('start') || definition.edges.some((edge: any) => edge.from === START);
      const hasEnd = nodeNames.includes('end') || definition.edges.some((edge: any) => edge.to === END);

      return hasStart && hasEnd;
    } catch (error) {
      logger.error('Workflow validation failed', error);
      return false;
    }
  }
}

export const langGraphEngine = new LangGraphWorkflowEngine();
