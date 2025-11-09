"""
Orchestrall Platform Python SDK

Official Python client library for the Orchestrall Platform APIs.
Provides both REST and MCP interfaces for seamless integration.
"""

from typing import Dict, Any, Optional, List, Union
import json
import time
from dataclasses import dataclass
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import websocket


@dataclass
class OrchestrallConfig:
    """Configuration for Orchestrall SDK"""
    base_url: str
    api_key: str
    timeout: int = 30
    retries: int = 3


@dataclass
class AgentRequest:
    """Request structure for agent execution"""
    agent_type: str  # 'crm', 'analytics', 'document', 'general'
    input: str
    context: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None


@dataclass
class AgentResponse:
    """Response structure from agent execution"""
    response: str
    metadata: Dict[str, Any]
    actions: Optional[List[Dict[str, Any]]] = None


@dataclass
class WorkflowRequest:
    """Request structure for workflow execution"""
    workflow_type: str  # 'customer-onboarding', 'document-processing', 'data-analysis'
    input: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None


@dataclass
class WorkflowResponse:
    """Response structure from workflow execution"""
    execution_id: str
    status: str
    result: Optional[Any] = None
    metadata: Dict[str, Any] = None


@dataclass
class MCPRequest:
    """MCP (Model Context Protocol) request structure"""
    jsonrpc: str = "2.0"
    id: Union[str, int] = None
    method: str = ""
    params: Optional[Dict[str, Any]] = None


@dataclass
class MCPResponse:
    """MCP response structure"""
    jsonrpc: str = "2.0"
    id: Union[str, int] = None
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None


class OrchestrallSDK:
    """
    Main Orchestrall Platform SDK for Python clients.

    Provides both REST API and MCP interfaces for interacting with
    the Orchestrall platform capabilities.
    """

    def __init__(self, config: OrchestrallConfig):
        """Initialize the Orchestrall SDK"""
        self.config = config
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Create configured requests session with retries"""
        session = requests.Session()
        retry_strategy = Retry(
            total=self.config.retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': self.config.api_key,
        })

        return session

    # ===== AGENT APIs =====

    def execute_agent(self, request: AgentRequest) -> AgentResponse:
        """Execute an AI agent"""
        url = f"{self.config.base_url}/v2/agents/execute"
        data = {
            'agentType': request.agent_type,
            'input': request.input,
            'context': request.context or {},
            'options': request.options or {},
        }

        response = self.session.post(url, json=data, timeout=self.config.timeout)
        response.raise_for_status()

        result = response.json()
        if not result.get('success'):
            raise Exception(f"Agent execution failed: {result}")

        data = result['data']
        return AgentResponse(
            response=data['response'],
            metadata=data['metadata'],
            actions=data.get('actions')
        )

    def get_available_agents(self) -> List[Dict[str, Any]]:
        """Get list of available agents"""
        url = f"{self.config.base_url}/v2/agents"
        response = self.session.get(url, timeout=self.config.timeout)
        response.raise_for_status()

        result = response.json()
        return result['data']

    # ===== WORKFLOW APIs =====

    def execute_workflow(self, request: WorkflowRequest) -> WorkflowResponse:
        """Execute a workflow"""
        url = f"{self.config.base_url}/v2/workflows/execute"
        data = {
            'workflowType': request.workflow_type,
            'input': request.input,
            'options': request.options or {},
        }

        response = self.session.post(url, json=data, timeout=self.config.timeout)
        response.raise_for_status()

        result = response.json()
        if not result.get('success'):
            raise Exception(f"Workflow execution failed: {result}")

        data = result['data']
        return WorkflowResponse(
            execution_id=data['executionId'],
            status=data['status'],
            result=data.get('result'),
            metadata=data.get('metadata', {})
        )

    def get_available_workflows(self) -> List[Dict[str, Any]]:
        """Get list of available workflows"""
        url = f"{self.config.base_url}/v2/workflows"
        response = self.session.get(url, timeout=self.config.timeout)
        response.raise_for_status()

        result = response.json()
        return result['data']

    # ===== PLUGIN APIs =====

    def get_available_plugins(self) -> List[Dict[str, Any]]:
        """Get list of available plugins"""
        url = f"{self.config.base_url}/v2/plugins"
        response = self.session.get(url, timeout=self.config.timeout)
        response.raise_for_status()

        result = response.json()
        return result['data']

    # ===== ANALYTICS APIs =====

    def get_platform_analytics(self, timeframe: str = '7d',
                              metrics: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get platform analytics"""
        url = f"{self.config.base_url}/v2/analytics/platform"
        params = {'timeframe': timeframe}
        if metrics:
            params['metrics'] = ','.join(metrics)

        response = self.session.get(url, params=params, timeout=self.config.timeout)
        response.raise_for_status()

        result = response.json()
        return result['data']

    # ===== HEALTH APIs =====

    def get_health(self) -> Dict[str, Any]:
        """Get platform health status"""
        url = f"{self.config.base_url}/v2/health"
        response = self.session.get(url, timeout=self.config.timeout)
        response.raise_for_status()
        return response.json()

    # ===== MCP APIs =====

    def execute_mcp(self, request: MCPRequest) -> MCPResponse:
        """Execute MCP request"""
        url = f"{self.config.base_url}/v2/mcp/execute"

        # Convert to dict for JSON serialization
        data = {
            'jsonrpc': request.jsonrpc,
            'id': request.id,
            'method': request.method,
            'params': request.params,
        }

        response = self.session.post(url, json=data, timeout=self.config.timeout)
        response.raise_for_status()
        return MCPResponse(**response.json())

    def get_mcp_capabilities(self) -> Dict[str, Any]:
        """Get MCP server capabilities"""
        url = f"{self.config.base_url}/v2/mcp/discovery"
        response = self.session.get(url, timeout=self.config.timeout)
        response.raise_for_status()
        return response.json()['result']

    # ===== WEBSOCKET APIs =====

    def connect_websocket(self, event_handlers: Optional[Dict[str, Any]] = None) -> websocket.WebSocket:
        """Connect to real-time WebSocket updates"""
        ws_url = self.config.base_url.replace('http', 'ws') + '/v2/events'

        def on_message(ws, message):
            try:
                data = json.loads(message)
                event_type = data.get('type')

                if event_handlers and event_type in event_handlers:
                    event_handlers[event_type](data)
            except json.JSONDecodeError:
                print(f"Failed to parse WebSocket message: {message}")

        def on_error(ws, error):
            print(f"WebSocket error: {error}")
            if event_handlers and 'on_error' in event_handlers:
                event_handlers['on_error'](error)

        def on_close(ws):
            print("WebSocket connection closed")
            if event_handlers and 'on_close' in event_handlers:
                event_handlers['on_close']()

        def on_open(ws):
            print("Connected to Orchestrall WebSocket")

        ws = websocket.WebSocketApp(
            ws_url,
            header={'X-API-Key': self.config.api_key},
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )

        return ws

    # ===== CONVENIENCE METHODS =====

    def crm(self, input_text: str, context: Optional[Dict[str, Any]] = None) -> AgentResponse:
        """Quick CRM agent execution"""
        return self.execute_agent(AgentRequest(
            agent_type='crm',
            input=input_text,
            context=context
        ))

    def analytics(self, input_text: str, data: Optional[Any] = None) -> AgentResponse:
        """Quick Analytics agent execution"""
        return self.execute_agent(AgentRequest(
            agent_type='analytics',
            input=input_text,
            context={'metadata': {'data': data}} if data else None
        ))

    def document(self, input_text: str, document_type: Optional[str] = None) -> AgentResponse:
        """Quick Document Processing agent execution"""
        return self.execute_agent(AgentRequest(
            agent_type='document',
            input=input_text,
            context={'metadata': {'documentType': document_type}} if document_type else None
        ))

    def onboard_customer(self, customer_data: Dict[str, str]) -> WorkflowResponse:
        """Quick customer onboarding workflow"""
        return self.execute_workflow(WorkflowRequest(
            workflow_type='customer-onboarding',
            input={'customerData': customer_data}
        ))

    def process_document(self, document: Dict[str, Any]) -> WorkflowResponse:
        """Quick document processing workflow"""
        return self.execute_workflow(WorkflowRequest(
            workflow_type='document-processing',
            input={'document': document}
        ))

    def analyze_data(self, data: Any, analysis_type: str) -> WorkflowResponse:
        """Quick data analysis workflow"""
        return self.execute_workflow(WorkflowRequest(
            workflow_type='data-analysis',
            input={'data': data, 'analysisType': analysis_type}
        ))


class OrchestrallMCPClient:
    """
    MCP (Model Context Protocol) client for Orchestrall integration.

    Provides a simplified interface for AI models to interact with
    Orchestrall capabilities through the MCP protocol.
    """

    def __init__(self, sdk: OrchestrallSDK):
        """Initialize MCP client with SDK instance"""
        self.sdk = sdk

    def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Execute MCP tool"""
        request = MCPRequest(
            id=str(int(time.time() * 1000)),
            method='tools/call',
            params={
                'name': tool_name,
                'arguments': params,
            }
        )

        response = self.sdk.execute_mcp(request)

        if response.error:
            raise Exception(f"MCP tool execution failed: {response.error['message']}")

        return response.result

    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get list of available MCP tools"""
        request = MCPRequest(
            id=str(int(time.time() * 1000)),
            method='tools/list'
        )

        response = self.sdk.execute_mcp(request)

        if response.error:
            raise Exception(f"MCP discovery failed: {response.error['message']}")

        return response.result['tools']

    # ===== MCP CONVENIENCE METHODS =====

    def crm(self, input_text: str, context: Optional[Dict[str, Any]] = None) -> Any:
        """CRM operations via MCP"""
        return self.execute_tool('execute_crm_agent', {
            'input': input_text,
            'context': context or {}
        })

    def analytics(self, input_text: str, data: Optional[Any] = None) -> Any:
        """Analytics operations via MCP"""
        return self.execute_tool('execute_analytics_agent', {
            'input': input_text,
            'data': data
        })

    def document(self, input_text: str, document_type: Optional[str] = None) -> Any:
        """Document processing via MCP"""
        return self.execute_tool('execute_document_agent', {
            'input': input_text,
            'documentType': document_type
        })

    def workflow(self, workflow_type: str, input_data: Dict[str, Any]) -> Any:
        """Workflow execution via MCP"""
        return self.execute_tool(f'execute_{workflow_type.replace("-", "_")}', input_data)


# ===== FACTORY FUNCTIONS =====

def create_sdk(config: OrchestrallConfig) -> OrchestrallSDK:
    """Create Orchestrall SDK instance"""
    return OrchestrallSDK(config)


def create_mcp_client(sdk: OrchestrallSDK) -> OrchestrallMCPClient:
    """Create MCP client from SDK instance"""
    return OrchestrallMCPClient(sdk)


# ===== USAGE EXAMPLES =====

"""
# Basic SDK Usage
from orchestrall import create_sdk, OrchestrallConfig

config = OrchestrallConfig(
    base_url="https://api.orchestrall.com",
    api_key="your-api-key"
)
sdk = create_sdk(config)

# Execute CRM agent
crm_result = sdk.crm("Find customer information for john.doe@example.com")
print(crm_result.response)

# Execute workflow
workflow_result = sdk.onboard_customer({
    "email": "new.customer@example.com",
    "name": "New Customer",
    "organization": "Example Corp"
})
print(f"Workflow status: {workflow_result.status}")

# Get platform analytics
analytics = sdk.get_platform_analytics(timeframe='30d')
print(f"Active users: {analytics['metrics']['users']}")

# MCP Usage
mcp_client = create_mcp_client(sdk)
tools = mcp_client.get_available_tools()
print(f"Available tools: {[tool['name'] for tool in tools]}")

# Execute via MCP
mcp_result = mcp_client.analytics("Analyze sales data trends")
print(mcp_result)
"""
