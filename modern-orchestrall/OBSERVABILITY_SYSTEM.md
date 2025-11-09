# 📊 Observability & Monitoring System

## 🎯 Overview

The Orchestrall Platform includes a comprehensive observability stack designed for production debugging, performance monitoring, and issue resolution. This system enables administrators to trace user workflows, identify defects, crashes, hangs, deadlocks, and other issues across all execution environments.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Applications                          │
├─────────────────────────────────────────────────────────────────┤
│  REST APIs  │  MCP Servers  │  WebSocket Events  │  Client SDKs  │
├─────────────────────────────────────────────────────────────────┤
│                    OpenTelemetry SDK                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Jaeger    │  │   Grafana   │  │    Loki     │  │Prometheus│ │
│  │   (Traces)  │  │ (Dashboard) │  │   (Logs)    │  │(Metrics) │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Application Services                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Start Observability Stack

```bash
# From project root
npm run observability:up

# Or manually
cd deployment/observability
docker-compose up -d
```

### 2. Access Dashboards

| Service | URL | Purpose |
|---------|-----|---------|
| **Jaeger** | http://localhost:16686 | Distributed trace visualization |
| **Grafana** | http://localhost:3000 | Monitoring dashboards (admin/admin) |
| **Prometheus** | http://localhost:9090 | Metrics collection and querying |
| **Loki** | http://localhost:3100 | Log aggregation (via Grafana) |

### 3. Generate Activity

```bash
# Make API calls to generate traces
curl -X POST http://localhost:3000/api/v2/agents/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "agentType": "crm",
    "input": "Find customer information",
    "context": { "userId": "user_123" }
  }'
```

## 🔧 Core Components

### OpenTelemetry Integration (`src/core/observability.ts`)

**Purpose:** Collects telemetry data from all application services

**Features:**
- **Distributed Tracing** - Tracks requests across service boundaries
- **Auto-instrumentation** - HTTP, gRPC, database operations
- **Metrics Collection** - Performance and business metrics
- **Structured Logging** - JSON logs with trace correlation

**Configuration:**
```typescript
import { observability } from '../core/observability';

const tracer = observability.getTracer('my-service');
const meter = observability.getMeter();
const logger = observability.getLogger();
```

### Enhanced Logger (`src/utils/enhanced-logger.ts`)

**Purpose:** Structured logging with OpenTelemetry integration

**Features:**
- **Context-aware Logging** - User ID, request ID, operation context
- **Performance Timing** - Built-in timers for operations
- **Async Tracing** - Automatic span creation for async operations
- **Custom Metrics** - Record business-specific metrics
- **Error Tracking** - Stack traces with full context

**Usage:**
```typescript
import { createLogger } from '../utils/enhanced-logger';

const logger = createLogger('my-service');

// Structured logging with context
logger.info('Operation started', {
  userId: 'user_123',
  operation: 'agent_execution',
  metadata: { agentType: 'crm' }
});

// Async operation tracing
const result = await logger.traceAsync(
  'process_request',
  async () => {
    return await myAsyncOperation();
  },
  { userId: 'user_123', operation: 'request_processing' }
);

// Performance timing
const timer = logger.startTimer('database_query');
const data = await queryDatabase();
timer(); // Logs duration
```

## 📊 Monitoring Stack

### Jaeger (Distributed Tracing)

**Configuration:** `deployment/observability/jaeger-config.yml`

**Features:**
- **Trace Visualization** - Visual representation of request flows
- **Service Dependencies** - Graph of service interactions
- **Performance Analysis** - Identify bottlenecks and slow operations
- **Error Correlation** - Link traces to error logs

**Key Metrics:**
- Trace duration and span timings
- Service dependency graphs
- Error rates by operation
- Performance percentiles

### Grafana (Monitoring Dashboard)

**Configuration:** `deployment/observability/grafana/`

**Features:**
- **Unified Dashboard** - Metrics, logs, and traces in one view
- **Custom Dashboards** - Pre-built and customizable views
- **Alerting** - Proactive monitoring and notifications
- **Log Analysis** - Query and visualize application logs

**Pre-built Dashboards:**
- **Platform Overview** - Service health, request rates, error rates
- **Agent Performance** - Agent execution times and success rates
- **Workflow Analytics** - Workflow completion and bottleneck analysis
- **System Health** - Resource usage and system metrics

### Loki (Log Aggregation)

**Configuration:** `deployment/observability/loki-config.yml`

**Features:**
- **Log Collection** - Centralized log storage and indexing
- **Structured Queries** - LogQL query language for filtering
- **Log Volume Analysis** - Monitor log patterns and volumes
- **Retention Policies** - Configurable log retention

**Query Examples:**
```logql
# Find error logs in last hour
{level="ERROR"} |= ``

# Find logs for specific user
{service="agent-service"} | userId="user_123"

# Find slow operations (> 1 second)
{service=~"agent-service|workflow-service"} | duration > 1000

# Count errors by agent type
{level="ERROR"} | json | agentType != `` | group_by([agentType])
```

### Prometheus (Metrics Collection)

**Configuration:** `deployment/observability/prometheus.yml`

**Features:**
- **Metrics Collection** - Time-series data from applications
- **Query Language** - PromQL for complex metric queries
- **Alerting Rules** - Define conditions for notifications
- **Service Discovery** - Automatic target discovery

**Key Metrics:**
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(log_events_total{level="ERROR"}[5m])

# Response time percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Custom business metrics
rate(agent_execution_duration_seconds_count[5m])
```

## 🎯 Issue Resolution Workflow

### 1. **Issue Detection**

**Automatic Monitoring:**
- **Error Rate Alerts** - Prometheus rules trigger on high error rates
- **Performance Degradation** - Monitor response time percentiles
- **Resource Constraints** - CPU, memory, disk usage alerts

**Manual Detection:**
- **Customer Reports** - Error messages or performance complaints
- **Admin Monitoring** - Regular dashboard reviews
- **Log Analysis** - Pattern recognition in log data

### 2. **Trace Analysis**

**Jaeger Investigation:**
```bash
# Find traces for specific user
# Search by userId tag in Jaeger UI

# Find slow operations
# Filter traces by duration > 5 seconds

# Identify error patterns
# Group traces by error message
```

**Key Insights:**
- **Service Dependencies** - Which services are involved
- **Performance Bottlenecks** - Slow operations in the chain
- **Error Propagation** - Where errors originate and spread
- **Resource Usage** - Database, API, or compute constraints

### 3. **Log Investigation**

**Structured Log Analysis:**
```typescript
// Logs include full context
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "ERROR",
  "message": "Database connection failed",
  "service": "agent-service",
  "traceId": "abc123def456",
  "spanId": "xyz789",
  "userId": "user_123",
  "agentId": "agent_456",
  "error": {
    "name": "ConnectionError",
    "message": "Connection timeout",
    "stack": "..."
  },
  "metadata": {
    "operation": "customer_lookup",
    "duration": 5000,
    "database": "primary"
  }
}
```

**Log Correlation:**
- **Trace ID Linking** - Connect logs to specific traces
- **User Journey Tracking** - Follow user actions across services
- **Error Chain Analysis** - Identify root causes and contributing factors

### 4. **Performance Analysis**

**Key Performance Indicators:**
- **Response Times** - API, database, and service latencies
- **Throughput** - Requests per second by service
- **Error Rates** - Percentage of failed operations
- **Resource Usage** - CPU, memory, disk, network utilization

**Bottleneck Identification:**
- **Database Queries** - Slow or inefficient queries
- **External APIs** - Third-party service performance
- **Resource Constraints** - Memory, CPU, or I/O limitations
- **Code Issues** - Inefficient algorithms or memory leaks

### 5. **Resolution & Prevention**

**Immediate Actions:**
- **Hot Fixes** - Quick patches for critical issues
- **Resource Scaling** - Increase capacity for performance issues
- **Configuration Changes** - Adjust timeouts, limits, or parameters

**Long-term Solutions:**
- **Code Improvements** - Optimize slow operations
- **Architecture Changes** - Service decomposition or caching
- **Monitoring Enhancements** - Better alerting and dashboards
- **Testing Improvements** - Load testing and chaos engineering

## 📈 Usage Examples

### Basic Service Logging

```typescript
import { createLogger } from '../utils/enhanced-logger';

class UserService {
  private logger = createLogger('user-service');

  async getUser(userId: string) {
    return await this.logger.traceAsync(
      'get_user',
      async () => {
        this.logger.info('Fetching user data', { userId });

        const user = await this.userRepository.findById(userId);

        this.logger.info('User data retrieved', {
          userId,
          found: !!user,
          duration: Date.now() - startTime
        });

        return user;
      },
      { userId, operation: 'user_lookup' }
    );
  }
}
```

### Agent Execution Monitoring

```typescript
class AgentService {
  private logger = createLogger('agent-service');

  async executeAgent(input: string, context: any) {
    const timer = this.logger.startTimer('agent_execution');

    try {
      return await this.logger.traceAsync(
        'execute_agent',
        async () => {
          // Agent execution logic
          const result = await this.processWithAI(input, context);

          this.logger.recordMetric('agent_execution_duration_seconds',
            timer() / 1000, {
              agentType: context.agentType,
              status: 'success'
            });

          return result;
        },
        {
          userId: context.userId,
          agentId: context.agentId,
          operation: 'agent_execution'
        }
      );
    } catch (error) {
      this.logger.recordMetric('agent_execution_duration_seconds',
        timer() / 1000, {
          agentType: context.agentType,
          status: 'failed'
        });

      throw error;
    }
  }
}
```

### Workflow Step Tracking

```typescript
class WorkflowService {
  private logger = createLogger('workflow-service');

  async executeWorkflow(workflowType: string, input: any) {
    const executionId = `exec_${Date.now()}`;

    return await this.logger.traceAsync(
      'execute_workflow',
      async () => {
        const steps = ['validate', 'process', 'finalize'];

        for (const step of steps) {
          await this.logger.traceAsync(
            `workflow_step_${step}`,
            async () => {
              await this.executeStep(step, input, executionId);
            },
            {
              executionId,
              workflowType,
              step,
              operation: 'workflow_execution'
            }
          );
        }

        return { executionId, status: 'completed' };
      },
      { executionId, workflowType, operation: 'workflow_execution' }
    );
  }
}
```

## 🚨 Alerting & Notifications

### Prometheus Alert Rules

**Configuration:** `deployment/observability/alert-rules.yml`

```yaml
groups:
  - name: orchestrall.alerts
    rules:
      - alert: HighErrorRate
        expr: rate(log_events_total{level="ERROR"}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} per second"

      - alert: SlowAgentExecution
        expr: histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m])) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow agent executions detected"
          description: "95th percentile execution time is {{ $value }} seconds"
```

### Grafana Alert Channels

- **Email Notifications** - admin@orchestrall.com
- **Slack Integration** - #alerts (if configured)
- **Webhook Endpoints** - Custom notification systems
- **PagerDuty** - Critical alert escalation

## 🔧 Production Deployment

### Docker Compose (Development)

```bash
# Start all services
docker-compose -f deployment/observability/docker-compose.yml up -d

# View logs
docker-compose -f deployment/observability/docker-compose.yml logs -f

# Scale services
docker-compose -f deployment/observability/docker-compose.yml up -d --scale promtail=2
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f deployment/kubernetes/observability.yaml

# Check status
kubectl get pods -n observability

# Scale if needed
kubectl scale deployment jaeger -n observability --replicas=2
```

### Environment Configuration

```bash
# Production environment variables
OTEL_EXPORTER=otlp
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://jaeger-collector:4318/v1/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://loki-gateway:3100/loki/api/v1/push
JAEGER_ENDPOINT=https://jaeger-collector:14268/api/traces
PROMETHEUS_PORT=9464
LOG_LEVEL=info
LOG_FORMAT=json
```

## 📊 Cost Analysis

### Infrastructure Costs (Monthly)

| Service | Development (Local) | Production (Small) | Production (Medium) |
|---------|-------------------|-------------------|-------------------|
| **Jaeger** | $0 (Docker) | $5 (1GB RAM) | $15 (2GB RAM) |
| **Grafana** | $0 (Docker) | $5 (1GB RAM) | $15 (2GB RAM) |
| **Loki** | $0 (Docker) | $10 (2GB RAM) | $30 (4GB RAM) |
| **Prometheus** | $0 (Docker) | $5 (1GB RAM) | $15 (2GB RAM) |
| **Total** | **$0** | **$25** | **$75** |

### Benefits vs. Commercial APM

| Feature | OpenTelemetry Stack | DataDog/New Relic |
|---------|-------------------|-------------------|
| **Distributed Tracing** | ✅ Free | ✅ $0.10/GB ingested |
| **Log Analysis** | ✅ Free | ✅ $0.10/GB ingested |
| **Metrics Collection** | ✅ Free | ✅ $0.10/GB ingested |
| **Custom Dashboards** | ✅ Free | ✅ Included |
| **Alerting** | ✅ Free | ✅ $0.50/host/month |
| **Monthly Cost (100GB)** | **$0** | **$50-100** |

**Savings:** **80-90% cost reduction** compared to commercial APM solutions

## 🎯 Best Practices

### 1. **Instrumentation Strategy**
- **Service Boundaries** - Trace all cross-service calls
- **Async Operations** - Use `traceAsync` for all async functions
- **Error Handling** - Log errors with full context and stack traces
- **Performance Critical** - Monitor key business operations

### 2. **Log Management**
- **Structured Format** - Use JSON with consistent field names
- **Context Preservation** - Include user, request, and operation IDs
- **Level Management** - Appropriate log levels for different environments
- **Retention Policies** - Balance between cost and debugging needs

### 3. **Monitoring Strategy**
- **Key Metrics** - Focus on actionable metrics (error rates, latencies)
- **Alert Thresholds** - Set realistic thresholds based on baselines
- **Dashboard Design** - Create role-specific dashboards for different users
- **Regular Reviews** - Monthly review of monitoring effectiveness

### 4. **Performance Optimization**
- **Sampling** - Use sampling for high-volume operations
- **Batch Processing** - Batch telemetry data exports
- **Resource Limits** - Set appropriate resource limits for services
- **Cost Monitoring** - Track observability costs vs. benefits

## 🚨 Troubleshooting Common Issues

### **Traces Not Appearing**
```bash
# Check OpenTelemetry initialization
curl http://localhost:9464/metrics | grep log_events

# Verify Jaeger connectivity
curl http://localhost:14268/api/traces

# Check service instrumentation
# Ensure all services call observability.getTracer()
```

### **High Log Volume**
```bash
# Adjust log levels
export LOG_LEVEL=warn

# Configure Loki retention
# Edit loki-config.yml retention settings

# Use log sampling for high-volume services
logger.debug('Low priority message', {
  metadata: { sampled: Math.random() < 0.1 }
});
```

### **Performance Impact**
```bash
# Monitor observability overhead
# Check container resource usage

# Use sampling for non-critical traces
const span = tracer.startSpan('optional_operation', {
  attributes: { sampled: true }
});

# Optimize batch sizes in OpenTelemetry config
```

## 📈 Metrics Reference

### Application Metrics
- `log_events_total` - Log events by level and service
- `log_processing_duration_ms` - Log processing time
- `agent_execution_duration_seconds` - Agent execution times
- `workflow_execution_duration_seconds` - Workflow execution times
- `http_request_duration_seconds` - HTTP request latencies
- `database_query_duration_seconds` - Database operation times

### Infrastructure Metrics
- `container_cpu_usage_seconds_total` - CPU usage by service
- `container_memory_usage_bytes` - Memory usage by service
- `prometheus_tsdb_head_series` - Time series count in Prometheus

## 🔗 Integration Examples

### Client SDK Integration
```typescript
import { OrchestrallSDK } from '@orchestrall/client-sdk';

const sdk = new OrchestrallSDK({
  baseURL: 'https://api.orchestrall.com',
  apiKey: 'your-api-key',
  observability: {
    serviceName: 'client-application',
    enableTracing: true,
    enableMetrics: true
  }
});

// All SDK calls automatically traced
const result = await sdk.crm('Find customer details');
```

### MCP Server Integration
```typescript
// MCP servers automatically instrumented
// All tool calls generate traces with context

const mcpClient = createOrchestrallMCPClient(sdk);
const result = await mcpClient.crm('Analyze customer data', {
  customerId: '123',
  includeHistory: true
});

// Trace shows: client -> MCP -> agent service -> database
```

## 🎊 Summary

The observability system provides **comprehensive monitoring and debugging capabilities** for the Orchestrall platform:

- ✅ **Complete request tracing** across all services and operations
- ✅ **Structured logging** with rich context for issue resolution
- ✅ **Real-time dashboards** for admin users and monitoring
- ✅ **Cost-effective solution** using open-source tools
- ✅ **Production-ready** deployment configurations
- ✅ **Developer-friendly** APIs and utilities

**This system enables administrators to quickly identify and resolve customer issues, performance problems, and system defects with full traceability and context.** 🚀

---

*Built with OpenTelemetry, Jaeger, Grafana, Loki, and Prometheus for maximum observability at minimum cost.*
