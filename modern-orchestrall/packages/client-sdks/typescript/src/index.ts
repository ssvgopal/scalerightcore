import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';

export interface OrchestrallConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface AgentRequest {
  agentType: 'crm' | 'analytics' | 'document' | 'general';
  input: string;
  context?: {
    organizationId?: string;
    userId?: string;
    conversationId?: string;
    metadata?: Record<string, any>;
  };
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    framework?: 'openai' | 'crewai' | 'autogen' | 'langgraph';
  };
}

export interface AgentResponse {
  response: string;
  metadata: {
    agent: string;
    executionTime: number;
    tokensUsed?: number;
    confidence: number;
  };
  actions?: Array<{
    type: string;
    payload: any;
  }>;
}

export interface WorkflowRequest {
  workflowType: 'customer-onboarding' | 'document-processing' | 'data-analysis';
  input: Record<string, any>;
  options?: {
    async?: boolean;
    timeout?: number;
  };
}

export interface WorkflowResponse {
  executionId: string;
  status: string;
  result?: any;
  metadata: {
    workflowType: string;
    executionTime?: number;
    steps?: string[];
  };
}

export interface PlatformHealth {
  status: string;
  version: string;
  uptime: number;
  services: Record<string, {
    status: string;
    responseTime?: number;
  }>;
}

export interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Main Orchestrall Platform SDK
 */
export class OrchestrallSDK {
  private client: AxiosInstance;
  private config: OrchestrallConfig;
  private ws?: WebSocket;

  constructor(config: OrchestrallConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
    });

    // Add response interceptor for retries
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;

        if (!config || !config.retry) {
          config.retry = 0;
        }

        if (config.retry < (this.config.retries || 3)) {
          config.retry += 1;
          await new Promise(resolve => setTimeout(resolve, 1000 * config.retry));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  // ===== AGENT APIs =====

  /**
   * Execute an AI agent
   */
  async executeAgent(request: AgentRequest): Promise<AgentResponse> {
    try {
      const response: AxiosResponse = await this.client.post('/v2/agents/execute', request);
      return response.data.data;
    } catch (error) {
      throw new Error(`Agent execution failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get available agents
   */
  async getAvailableAgents(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    category: string;
  }>> {
    try {
      const response: AxiosResponse = await this.client.get('/v2/agents');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get agents: ${error.response?.data?.message || error.message}`);
    }
  }

  // ===== WORKFLOW APIs =====

  /**
   * Execute a workflow
   */
  async executeWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
    try {
      const response: AxiosResponse = await this.client.post('/v2/workflows/execute', request);
      return response.data.data;
    } catch (error) {
      throw new Error(`Workflow execution failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get available workflows
   */
  async getAvailableWorkflows(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    inputSchema: Record<string, any>;
  }>> {
    try {
      const response: AxiosResponse = await this.client.get('/v2/workflows');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get workflows: ${error.response?.data?.message || error.message}`);
    }
  }

  // ===== PLUGIN APIs =====

  /**
   * Get available plugins
   */
  async getAvailablePlugins(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    capabilities: string[];
    configSchema: Record<string, any>;
  }>> {
    try {
      const response: AxiosResponse = await this.client.get('/v2/plugins');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get plugins: ${error.response?.data?.message || error.message}`);
    }
  }

  // ===== ANALYTICS APIs =====

  /**
   * Get platform analytics
   */
  async getPlatformAnalytics(params?: {
    timeframe?: '24h' | '7d' | '30d' | '90d';
    metrics?: string[];
  }): Promise<{
    metrics: Record<string, number>;
    trends: Array<{
      metric: string;
      change: number;
      trend: 'up' | 'down' | 'stable';
    }>;
    summary: string;
  }> {
    try {
      const response: AxiosResponse = await this.client.get('/v2/analytics/platform', { params });
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get analytics: ${error.response?.data?.message || error.message}`);
    }
  }

  // ===== HEALTH APIs =====

  /**
   * Get platform health status
   */
  async getHealth(): Promise<PlatformHealth> {
    try {
      const response: AxiosResponse = await this.client.get('/v2/health');
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ===== MCP APIs =====

  /**
   * Execute MCP tool call
   */
  async executeMCP(request: MCPRequest): Promise<MCPResponse> {
    try {
      const response: AxiosResponse = await this.client.post('/v2/mcp/execute', request);
      return response.data;
    } catch (error) {
      throw new Error(`MCP execution failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get MCP server capabilities
   */
  async getMCPCapabilities(): Promise<{
    tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, any>;
    }>;
    serverInfo: {
      name: string;
      version: string;
    };
  }> {
    try {
      const response: AxiosResponse = await this.client.get('/v2/mcp/discovery');
      return response.data.result;
    } catch (error) {
      throw new Error(`MCP discovery failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ===== WEBSOCKET APIs =====

  /**
   * Connect to real-time updates
   */
  connectWebSocket(eventHandlers?: {
    onAgentUpdate?: (data: any) => void;
    onWorkflowUpdate?: (data: any) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
  }): WebSocket {
    const wsUrl = this.config.baseURL.replace(/^http/, 'ws') + '/v2/events';

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    this.ws.onopen = () => {
      console.log('Connected to Orchestrall WebSocket');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());

        switch (data.type) {
          case 'agent_update':
            eventHandlers?.onAgentUpdate?.(data);
            break;
          case 'workflow_update':
            eventHandlers?.onWorkflowUpdate?.(data);
            break;
          default:
            console.log('Unknown WebSocket event:', data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      eventHandlers?.onError?.(new Error('WebSocket connection error'));
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      eventHandlers?.onClose?.();
    };

    return this.ws;
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Quick CRM agent execution
   */
  async crm(input: string, context?: AgentRequest['context']): Promise<AgentResponse> {
    return this.executeAgent({
      agentType: 'crm',
      input,
      context,
    });
  }

  /**
   * Quick Analytics agent execution
   */
  async analytics(input: string, data?: any): Promise<AgentResponse> {
    return this.executeAgent({
      agentType: 'analytics',
      input,
      context: data ? { metadata: { data } } : undefined,
    });
  }

  /**
   * Quick Document Processing agent execution
   */
  async document(input: string, documentType?: string): Promise<AgentResponse> {
    return this.executeAgent({
      agentType: 'document',
      input,
      context: documentType ? { metadata: { documentType } } : undefined,
    });
  }

  /**
   * Quick customer onboarding workflow
   */
  async onboardCustomer(customerData: {
    email: string;
    name: string;
    organization: string;
    plan?: string;
  }): Promise<WorkflowResponse> {
    return this.executeWorkflow({
      workflowType: 'customer-onboarding',
      input: { customerData },
    });
  }

  /**
   * Quick document processing workflow
   */
  async processDocument(document: {
    content: string;
    type: string;
    metadata?: Record<string, any>;
  }): Promise<WorkflowResponse> {
    return this.executeWorkflow({
      workflowType: 'document-processing',
      input: { document },
    });
  }

  /**
   * Quick data analysis workflow
   */
  async analyzeData(data: any, analysisType: string): Promise<WorkflowResponse> {
    return this.executeWorkflow({
      workflowType: 'data-analysis',
      input: { data, analysisType },
    });
  }
}

/**
 * MCP Client for Model Context Protocol integration
 */
export class OrchestrallMCPClient {
  private sdk: OrchestrallSDK;

  constructor(sdk: OrchestrallSDK) {
    this.sdk = sdk;
  }

  /**
   * Execute MCP tool call
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params,
      },
    };

    const response = await this.sdk.executeMCP(request);

    if (response.error) {
      throw new Error(`MCP error: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Get available MCP tools
   */
  async getAvailableTools(): Promise<any> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'tools/list',
    };

    const response = await this.sdk.executeMCP(request);

    if (response.error) {
      throw new Error(`MCP error: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * CRM operations via MCP
   */
  async crm(input: string, context?: any): Promise<any> {
    return this.executeTool('execute_crm_agent', { input, context });
  }

  /**
   * Analytics operations via MCP
   */
  async analytics(input: string, data?: any): Promise<any> {
    return this.executeTool('execute_analytics_agent', { input, data });
  }

  /**
   * Document processing via MCP
   */
  async document(input: string, documentType?: string): Promise<any> {
    return this.executeTool('execute_document_agent', { input, documentType });
  }

  /**
   * Workflow execution via MCP
   */
  async workflow(workflowType: string, input: any): Promise<any> {
    return this.executeTool(`execute_${workflowType.replace('-', '_')}`, input);
  }
}

/**
 * Factory function to create SDK instance
 */
export function createOrchestrallSDK(config: OrchestrallConfig): OrchestrallSDK {
  return new OrchestrallSDK(config);
}

/**
 * Factory function to create MCP client
 */
export function createOrchestrallMCPClient(sdk: OrchestrallSDK): OrchestrallMCPClient {
  return new OrchestrallMCPClient(sdk);
}

// Export types for external use
export * from './types';

// Default export
export default OrchestrallSDK;
