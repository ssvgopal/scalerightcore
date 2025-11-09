# External API Documentation

## 🎯 Overview

The Orchestrall Platform provides comprehensive external APIs that enable seamless integration with client applications and AI systems. This documentation covers both REST APIs and MCP (Model Context Protocol) interfaces.

## 🔗 Authentication

All external APIs require API key authentication:

```bash
curl -H "X-API-Key: your-api-key" \
     https://api.orchestrall.com/v2/agents/execute
```

## 🚀 Quick Start

### Node.js/TypeScript

```typescript
import { OrchestrallSDK } from '@orchestrall/client-sdk';

const sdk = new OrchestrallSDK({
  baseURL: 'https://api.orchestrall.com',
  apiKey: 'your-api-key',
});

// Execute CRM agent
const result = await sdk.crm('Find customer information for john@example.com');
console.log(result.response);
```

### Python

```python
from orchestrall_sdk import create_sdk, OrchestrallConfig

config = OrchestrallConfig(
    base_url="https://api.orchestrall.com",
    api_key="your-api-key"
)
sdk = create_sdk(config)

# Execute analytics agent
result = sdk.analytics("Analyze sales trends")
print(result.response)
```

## 📋 API Reference

### Agent APIs

#### Execute Agent

**POST** `/v2/agents/execute`

Execute any available AI agent with custom input and context.

```typescript
const response = await sdk.executeAgent({
  agentType: 'crm',
  input: 'Find customer details for email: john@example.com',
  context: {
    organizationId: 'org_123',
    userId: 'user_456',
  },
  options: {
    model: 'gpt-4',
    temperature: 0.3,
  },
});
```

**Response:**
```typescript
{
  response: "Found customer: John Doe (john@example.com)...",
  metadata: {
    agent: "CRM",
    executionTime: 150,
    confidence: 0.9,
  },
  actions: [
    {
      type: "update_customer_contact",
      payload: { customerId: "cust_123" },
    },
  ],
}
```

#### Get Available Agents

**GET** `/v2/agents`

Returns list of available agent types and their capabilities.

```typescript
const agents = await sdk.getAvailableAgents();
console.log(agents);
// [
//   {
//     id: 'crm',
//     name: 'CRM Specialist',
//     capabilities: ['customer_lookup', 'lead_scoring'],
//     category: 'business',
//   },
//   // ...
// ]
```

### Workflow APIs

#### Execute Workflow

**POST** `/v2/workflows/execute`

Execute predefined workflows for common business processes.

```typescript
const result = await sdk.executeWorkflow({
  workflowType: 'customer-onboarding',
  input: {
    customerData: {
      email: 'new@example.com',
      name: 'New Customer',
      organization: 'Example Corp',
    },
  },
});
```

**Response:**
```typescript
{
  executionId: "exec_123",
  status: "completed",
  result: {
    userId: "user_456",
    organizationId: "org_789",
    welcomeSent: true,
  },
  metadata: {
    workflowType: "customer-onboarding",
    executionTime: 480,
  },
}
```

#### Get Available Workflows

**GET** `/v2/workflows`

Returns available workflow templates and their input schemas.

### Plugin APIs

#### Get Available Plugins

**GET** `/v2/plugins`

Returns available plugin integrations for the platform.

```typescript
const plugins = await sdk.getAvailablePlugins();
console.log(plugins);
// [
//   {
//     id: 'crm-salesforce',
//     name: 'Salesforce CRM',
//     capabilities: ['contacts', 'leads', 'opportunities'],
//     configSchema: { /* ... */ },
//   },
//   // ...
// ]
```

### Analytics APIs

#### Get Platform Analytics

**GET** `/v2/analytics/platform`

Retrieve platform usage and performance metrics.

```typescript
const analytics = await sdk.getPlatformAnalytics({
  timeframe: '30d',
  metrics: ['agents', 'workflows', 'users'],
});

console.log(analytics);
// {
//   metrics: { agents: 45, workflows: 123, users: 234 },
//   trends: [
//     { metric: 'agents', change: 12.5, trend: 'up' },
//   ],
//   summary: 'Platform usage increased by 8.2%',
// }
```

### MCP (Model Context Protocol) APIs

#### Execute MCP Tool

**POST** `/v2/mcp/execute`

Execute tools through the Model Context Protocol.

```typescript
const mcpClient = createOrchestrallMCPClient(sdk);

// Execute CRM tool via MCP
const result = await mcpClient.crm('Find customer by email', {
  email: 'customer@example.com',
});
```

#### Get MCP Capabilities

**GET** `/v2/mcp/discovery`

Discover available MCP tools and their schemas.

```typescript
const capabilities = await sdk.getMCPCapabilities();
console.log(capabilities.tools);
// Lists all available MCP tools with their parameters
```

## 🤖 MCP Integration Guide

### For AI Models

MCP enables AI models to call Orchestrall capabilities as tools:

```typescript
// Example MCP tool definitions for AI models
const mcpTools = [
  {
    name: "orchestrall_crm_lookup",
    description: "Look up customer information in CRM systems",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer search query (email, name, etc.)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "orchestrall_analytics",
    description: "Perform data analysis and generate insights",
    inputSchema: {
      type: "object",
      properties: {
        analysis_type: {
          type: "string",
          enum: ["trends", "anomalies", "predictions"],
        },
        data: { type: "object" },
      },
      required: ["analysis_type"],
    },
  },
];
```

### MCP Server Integration

The platform provides MCP servers for different capability domains:

- **Agent MCP Server**: AI agent execution
- **Workflow MCP Server**: Business process automation
- **Plugin MCP Server**: Third-party integrations

## 🔧 Error Handling

All APIs follow consistent error response formats:

```typescript
try {
  const result = await sdk.executeAgent(request);
} catch (error) {
  console.error('API Error:', error.message);
  // Error format:
  // {
  //   success: false,
  //   error: {
  //     code: 'VALIDATION_ERROR',
  //     message: 'Invalid input parameters',
  //     details: { /* ... */ },
  //   },
  // }
}
```

## 📊 Rate Limiting

External APIs are rate-limited to ensure fair usage:

- **Default**: 100 requests per minute per API key
- **Bursting**: Up to 200 requests per minute for short periods
- **Headers**: Include rate limit information in responses

```typescript
// Response headers include rate limit info:
'x-ratelimit-limit': '100',
'x-ratelimit-remaining': '95',
'x-ratelimit-reset': '1640995200',
```

## 🔒 Security

- **API Key Authentication**: Required for all requests
- **HTTPS Only**: All communications encrypted
- **Input Validation**: Comprehensive request validation
- **CORS**: Configurable cross-origin support
- **Audit Logging**: All API usage logged for compliance

## 🚀 Best Practices

### Efficient Usage

```typescript
// Batch multiple operations
const [agents, workflows, plugins] = await Promise.all([
  sdk.getAvailableAgents(),
  sdk.getAvailableWorkflows(),
  sdk.getAvailablePlugins(),
]);

// Use appropriate agent types for tasks
const crmResult = await sdk.crm('Customer lookup');
const analyticsResult = await sdk.analytics('Data analysis');
```

### Error Handling

```typescript
// Implement retry logic with exponential backoff
async function robustAPIcall(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sdk.executeAgent(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

### Real-time Updates

```typescript
// Connect to WebSocket for real-time updates
const ws = sdk.connectWebSocket({
  onAgentUpdate: (data) => {
    console.log('Agent execution update:', data);
  },
  onWorkflowUpdate: (data) => {
    console.log('Workflow status update:', data);
  },
});
```

## 📈 Monitoring & Analytics

### Platform Health

```typescript
const health = await sdk.getHealth();
console.log(`Platform status: ${health.status}`);
console.log(`Service status:`, health.services);
```

### Usage Analytics

```typescript
const analytics = await sdk.getPlatformAnalytics({
  timeframe: '30d',
  metrics: ['agents', 'workflows', 'executions'],
});
console.log('Monthly usage:', analytics.metrics);
```

## 🛠️ SDK Installation

### npm (Node.js/TypeScript)

```bash
npm install @orchestrall/client-sdk
```

### pip (Python)

```bash
pip install orchestrall-sdk
```

## 🎯 Use Cases

### Customer Support Integration

```typescript
// Integrate with helpdesk system
app.post('/api/support/query', async (req, res) => {
  const { query, customerEmail } = req.body;

  const result = await sdk.crm(
    `Customer support query: ${query}`,
    { metadata: { customerEmail } }
  );

  res.json({
    response: result.response,
    suggestedActions: result.actions,
  });
});
```

### Business Intelligence Dashboard

```python
# Generate insights for dashboard
def get_business_insights():
    # Get current metrics
    analytics = sdk.get_platform_analytics(timeframe='30d')

    # Analyze trends
    insights = sdk.analytics("Analyze business trends and opportunities")

    return {
        'metrics': analytics['metrics'],
        'insights': insights.response,
        'recommendations': insights.actions,
    }
```

### Document Processing Pipeline

```typescript
// Process uploaded documents
async function processDocument(file: File) {
  const content = await extractTextFromFile(file);

  const result = await sdk.document(
    `Analyze document: ${content}`,
    file.type
  );

  return {
    analysis: result.response,
    extractedData: result.actions,
  };
}
```

## 📞 Support

For API support and questions:
- **Email**: api-support@orchestrall.com
- **Documentation**: https://docs.orchestrall.com/api
- **Status Page**: https://status.orchestrall.com

## 🔄 Version History

- **v2.0.0**: Complete API redesign with MCP support
- **v1.5.0**: Added workflow APIs
- **v1.0.0**: Initial agent APIs release

---

**Built for seamless AI integration and business automation** 🚀
