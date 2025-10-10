# Orchestrall Platform API Reference

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [REST APIs](#rest-apis)
  - [Agent APIs](#agent-apis)
  - [Workflow APIs](#workflow-apis)
  - [Plugin APIs](#plugin-apis)
  - [Analytics APIs](#analytics-apis)
  - [Health APIs](#health-apis)
- [MCP Servers](#mcp-servers)
  - [Agent MCP Server](#agent-mcp-server)
  - [Workflow MCP Server](#workflow-mcp-server)
  - [Plugin MCP Server](#plugin-mcp-server)
- [WebSocket Events](#websocket-events)
- [Client SDKs](#client-sdks)
  - [TypeScript/JavaScript](#typescriptjavascript-sdk)
  - [Python](#python-sdk)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## 🎯 Overview

The Orchestrall Platform provides comprehensive APIs for AI-powered business automation. The platform exposes capabilities through:

- **REST APIs** - HTTP endpoints for web applications
- **MCP Servers** - Model Context Protocol for AI model integration
- **WebSocket Events** - Real-time updates and streaming
- **Client SDKs** - Easy integration libraries for popular languages

## 🔐 Authentication

All APIs require API key authentication via the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" \
     https://api.orchestrall.com/v2/agents/execute
```

**Rate Limits:**
- Default: 100 requests per minute per API key
- Headers include rate limit information in responses

## 🚀 REST APIs

### Agent APIs

#### Execute Agent

**POST** `/v2/agents/execute`

Execute any available AI agent with custom input and context.

**Request Body:**
```json
{
  "agentType": "crm" | "analytics" | "document" | "general",
  "input": "Your query or task description",
  "context": {
    "organizationId": "string",
    "userId": "string",
    "conversationId": "string",
    "metadata": {}
  },
  "options": {
    "model": "string",
    "temperature": "number",
    "maxTokens": "number",
    "framework": "openai" | "crewai" | "autogen" | "langgraph"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Agent response content",
    "metadata": {
      "agent": "CRM",
      "executionTime": 150,
      "confidence": 0.9,
      "tokensUsed": 245
    },
    "actions": [
      {
        "type": "update_customer_record",
        "payload": { "customerId": "123" }
      }
    ]
  }
}
```

#### Get Available Agents

**GET** `/v2/agents`

Returns list of available agent types and their capabilities.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "crm",
      "name": "CRM Specialist",
      "description": "Customer relationship management and sales insights",
      "capabilities": ["customer_lookup", "lead_scoring", "sales_insights"],
      "category": "business"
    }
  ]
}
```

### Workflow APIs

#### Execute Workflow

**POST** `/v2/workflows/execute`

Execute predefined workflows for common business processes.

**Request Body:**
```json
{
  "workflowType": "customer-onboarding" | "document-processing" | "data-analysis",
  "input": {
    "customerData": {
      "email": "user@example.com",
      "name": "John Doe",
      "organization": "Example Corp"
    }
  },
  "options": {
    "async": false,
    "timeout": 30000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_123",
    "status": "completed",
    "result": {
      "userId": "user_456",
      "organizationId": "org_789",
      "welcomeSent": true
    },
    "metadata": {
      "workflowType": "customer-onboarding",
      "executionTime": 480,
      "steps": ["validate_input", "create_user", "setup_organization"]
    }
  }
}
```

#### Get Available Workflows

**GET** `/v2/workflows`

Returns available workflow templates and their input schemas.

### Plugin APIs

#### Get Available Plugins

**GET** `/v2/plugins`

Returns available plugin integrations for the platform.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "crm-salesforce",
      "name": "Salesforce CRM",
      "description": "Complete Salesforce CRM integration",
      "category": "crm",
      "capabilities": ["contacts", "leads", "opportunities"],
      "configSchema": {
        "instanceUrl": { "type": "string", "required": true },
        "apiKey": { "type": "string", "required": true, "secret": true }
      }
    }
  ]
}
```

### Analytics APIs

#### Get Platform Analytics

**GET** `/v2/analytics/platform`

Retrieve platform usage and performance metrics.

**Query Parameters:**
- `timeframe`: `24h` | `7d` | `30d` | `90d` (default: `7d`)
- `metrics`: Array of metric names to include

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "agents": 45,
      "workflows": 123,
      "users": 234,
      "executions": 5678
    },
    "trends": [
      {
        "metric": "agents",
        "change": 12.5,
        "trend": "up"
      }
    ],
    "summary": "Platform usage increased by 8.2% compared to last week"
  }
}
```

### Health APIs

#### Get Platform Health

**GET** `/v2/health`

Get platform health status and service availability.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 3600,
  "services": {
    "api-gateway": { "status": "up", "responseTime": 12 },
    "auth-service": { "status": "up", "responseTime": 8 },
    "plugin-service": { "status": "up", "responseTime": 15 }
  }
}
```

## 🤖 MCP Servers

### Agent MCP Server (`orchestrall-agents`)

**Server Name:** `orchestrall-agents`  
**Version:** `2.0.0`

#### Available Tools:

**`execute_crm_agent`**
- **Description:** Execute CRM agent for customer management tasks
- **Parameters:**
  ```json
  {
    "input": "string (required)",
    "context": {
      "organizationId": "string",
      "userId": "string",
      "customerId": "string"
    }
  }
  ```

**`execute_analytics_agent`**
- **Description:** Execute Analytics agent for data analysis tasks
- **Parameters:**
  ```json
  {
    "input": "string (required)",
    "data": "object"
  }
  ```

**`execute_document_agent`**
- **Description:** Execute Document Processing agent for document analysis
- **Parameters:**
  ```json
  {
    "input": "string (required)",
    "documentType": "string"
  }
  ```

### Workflow MCP Server (`orchestrall-workflows`)

**Server Name:** `orchestrall-workflows`
**Version:** `2.0.0`

#### Available Tools:

**`execute_customer_onboarding`**
- **Description:** Execute customer onboarding workflow
- **Parameters:**
  ```json
  {
    "customerData": {
      "email": "string (required)",
      "name": "string (required)",
      "organization": "string (required)",
      "plan": "string"
    }
  }
  ```

**`execute_document_processing`**
- **Description:** Execute document processing workflow
- **Parameters:**
  ```json
  {
    "document": {
      "content": "string (required)",
      "type": "string (required)",
      "metadata": "object"
    }
  }
  ```

**`execute_data_analysis`**
- **Description:** Execute data analysis workflow
- **Parameters:**
  ```json
  {
    "data": "object (required)",
    "analysisType": "trends" | "anomalies" | "predictions" | "summary" (required)
  }
  ```

### Plugin MCP Server (`orchestrall-plugins`)

**Server Name:** `orchestrall-plugins`
**Version:** `2.0.0`

#### Available Tools:

**`list_available_plugins`**
- **Description:** List all available plugins for integration
- **Parameters:** `{}` (no parameters required)

**`get_plugin_info`**
- **Description:** Get detailed information about a specific plugin
- **Parameters:**
  ```json
  {
    "pluginId": "string (required)"
  }
  ```

**`configure_plugin`**
- **Description:** Configure a plugin with specific settings
- **Parameters:**
  ```json
  {
    "pluginId": "string (required)",
    "config": "object (required)"
  }
  ```

## 🔄 WebSocket Events

Connect to real-time updates at: `wss://api.orchestrall.com/v2/events`

**Authentication:** Include `X-API-Key` header in WebSocket connection.

### Event Types:

#### Agent Updates
```json
{
  "type": "agent_update",
  "data": {
    "agentId": "agent_123",
    "status": "completed",
    "executionId": "exec_456",
    "result": { /* agent result */ }
  }
}
```

#### Workflow Updates
```json
{
  "type": "workflow_update",
  "data": {
    "workflowId": "workflow_123",
    "executionId": "exec_456",
    "status": "running",
    "currentStep": "validate_input",
    "progress": 0.3
  }
}
```

## 📦 Client SDKs

### TypeScript/JavaScript SDK

#### Installation
```bash
npm install @orchestrall/client-sdk
```

#### Usage
```typescript
import { OrchestrallSDK, createOrchestrallMCPClient } from '@orchestrall/client-sdk';

const sdk = new OrchestrallSDK({
  baseURL: 'https://api.orchestrall.com',
  apiKey: 'your-api-key',
});

// Execute agent
const result = await sdk.crm('Find customer details for john@example.com');
console.log(result.response);

// Execute workflow
const workflow = await sdk.onboardCustomer({
  email: 'new@example.com',
  name: 'New Customer',
  organization: 'Example Corp'
});

// MCP integration
const mcpClient = createOrchestrallMCPClient(sdk);
const mcpResult = await mcpClient.analytics('Analyze sales trends');

// Real-time updates
const ws = sdk.connectWebSocket({
  onAgentUpdate: (data) => console.log('Agent update:', data),
  onWorkflowUpdate: (data) => console.log('Workflow update:', data),
});
```

### Python SDK

#### Installation
```bash
pip install orchestrall-sdk
```

#### Usage
```python
from orchestrall_sdk import create_sdk, OrchestrallConfig

config = OrchestrallConfig(
    base_url="https://api.orchestrall.com",
    api_key="your-api-key"
)
sdk = create_sdk(config)

# Execute agent
result = sdk.crm("Find customer information")
print(result.response)

# Execute workflow
workflow_result = sdk.onboard_customer({
    "email": "new@example.com",
    "name": "New Customer",
    "organization": "Example Corp"
})

# Get analytics
analytics = sdk.get_platform_analytics(timeframe='30d')
print(f"Active users: {analytics['metrics']['users']}")
```

## 🚨 Error Handling

### HTTP Status Codes

- **200** - Success
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (invalid API key)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found
- **429** - Too Many Requests (rate limit exceeded)
- **500** - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_ERROR` - Invalid API key or credentials
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RATE_LIMIT_ERROR` - Too many requests
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable
- `AGENT_ERROR` - Agent execution failed
- `WORKFLOW_ERROR` - Workflow execution failed

## ⚡ Rate Limiting

**Default Limits:**
- 100 requests per minute per API key
- Burst allowance up to 200 requests per minute

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

**Rate Limit Exceeded Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many requests",
    "details": {
      "retryAfter": 60
    }
  }
}
```

## 💡 Examples

### Basic Agent Execution

```typescript
// Execute CRM agent
const crmResult = await sdk.executeAgent({
  agentType: 'crm',
  input: 'Find customer information for john.doe@example.com',
  context: {
    organizationId: 'org_123',
    userId: 'user_456',
  },
});

console.log(crmResult.response);
```

### Workflow Execution

```typescript
// Execute customer onboarding
const result = await sdk.executeWorkflow({
  workflowType: 'customer-onboarding',
  input: {
    customerData: {
      email: 'new.user@example.com',
      name: 'New User',
      organization: 'Example Corp',
      plan: 'enterprise',
    },
  },
});

if (result.status === 'completed') {
  console.log('Customer onboarded successfully:', result.result);
}
```

### MCP Integration

```python
# Use MCP for AI model integration
mcp_client = create_mcp_client(sdk)

# Execute via MCP
result = mcp_client.crm('Analyze customer data', {
    'customerId': '123',
    'includeHistory': True
})

print(result['response'])
```

### Real-time Monitoring

```typescript
// Connect to WebSocket for real-time updates
const ws = sdk.connectWebSocket({
  onAgentUpdate: (data) => {
    console.log(`Agent ${data.agentId} completed:`, data.result);
  },
  onWorkflowUpdate: (data) => {
    console.log(`Workflow ${data.workflowId} status: ${data.status}`);
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  },
});

// Cleanup
ws.disconnectWebSocket();
```

### Error Handling

```typescript
try {
  const result = await sdk.executeAgent(request);
  console.log('Success:', result.response);
} catch (error) {
  if (error.message.includes('RATE_LIMIT_ERROR')) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000));
    return await sdk.executeAgent(request);
  } else if (error.message.includes('VALIDATION_ERROR')) {
    // Fix request parameters
    console.log('Validation errors:', error.details);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## 📞 Support

For API support and questions:
- **Email:** api-support@orchestrall.com
- **Documentation:** https://docs.orchestrall.com/api
- **Status Page:** https://status.orchestrall.com
- **Community:** https://community.orchestrall.com

## 🔄 Version History

- **v2.0.0** - Complete API redesign with MCP support
- **v1.5.0** - Added workflow APIs and WebSocket support
- **v1.0.0** - Initial agent APIs release

---

**Built for seamless AI integration and business automation** 🚀
