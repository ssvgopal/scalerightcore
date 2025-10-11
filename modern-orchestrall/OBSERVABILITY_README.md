# Observability Stack Configuration

## 🚀 Complete Observability Setup

This directory contains the complete observability stack for tracing and monitoring the Orchestrall platform.

## 📋 Components

### 🔍 **OpenTelemetry** (Distributed Tracing)
- **Location:** `src/core/observability.ts`
- **Purpose:** Collects traces, metrics, and logs from all services
- **Integration:** Auto-instruments HTTP, gRPC, database calls
- **Export:** Sends data to Jaeger (traces) and Prometheus (metrics)

### 📊 **Jaeger** (Trace Visualization)
- **Purpose:** Visualizes distributed traces and request flows
- **Features:** Service dependency graphs, trace search, performance analysis
- **URL:** http://localhost:16686 (development)

### 📈 **Grafana** (Monitoring Dashboard)
- **Purpose:** Unified dashboard for metrics, logs, and traces
- **Features:** Custom dashboards, alerting, log aggregation
- **URL:** http://localhost:3000 (development)

### 📝 **Loki** (Log Aggregation)
- **Purpose:** Centralized log collection and querying
- **Features:** Structured log queries, log volume analysis
- **Integration:** Receives logs from Winston via OpenTelemetry

### 📊 **Prometheus** (Metrics Collection)
- **Purpose:** Collects and stores time-series metrics
- **Features:** Query language, alerting rules, service discovery
- **Metrics Port:** 9464 (default)

## 🛠️ Quick Setup (Development)

### 1. Start Observability Stack

```bash
# Start all observability services
docker-compose -f deployment/observability/docker-compose.yml up -d

# Or individually:
docker run -d --name jaeger -p 16686:16686 jaegertracing/all-in-one:latest
docker run -d --name grafana -p 3000:3000 grafana/grafana:latest
docker run -d --name loki -p 3100:3100 grafana/loki:latest
docker run -d --name prometheus -p 9090:9090 prom/prometheus:latest
```

### 2. Configure Application

The application automatically starts OpenTelemetry instrumentation when running. No additional configuration needed.

### 3. Access Dashboards

- **Jaeger UI:** http://localhost:16686
- **Grafana:** http://localhost:3000 (admin/admin)
- **Prometheus:** http://localhost:9090

## 🎯 Production Setup

### Docker Compose (Recommended)

```yaml
# deployment/observability/docker-compose.yml
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "14268:14268"
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./logs:/var/log/orchestrall
      - ./observability/promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'

volumes:
  grafana_data:
```

### Kubernetes Deployment

```yaml
# deployment/kubernetes/observability.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:latest
        ports:
        - containerPort: 16686
        - containerPort: 14268
        env:
        - name: COLLECTOR_OTLP_ENABLED
          value: "true"

---
apiVersion: v1
kind: Service
metadata:
  name: jaeger-service
  namespace: observability
spec:
  selector:
    app: jaeger
  ports:
  - name: ui
    port: 16686
    targetPort: 16686
  - name: otlp
    port: 14268
    targetPort: 14268

---
# Similar configurations for Grafana, Loki, Prometheus...
```

## 📊 Grafana Dashboards

### Pre-configured Dashboards

1. **Orchestrall Overview Dashboard**
   - Service health status
   - Request rates and latencies
   - Error rates by service
   - Active traces count

2. **Agent Performance Dashboard**
   - Agent execution times
   - Success/failure rates
   - Resource usage per agent type
   - Queue depths and processing rates

3. **Workflow Analytics Dashboard**
   - Workflow completion rates
   - Step-by-step performance
   - Bottleneck identification
   - Error patterns

4. **System Health Dashboard**
   - CPU, memory, disk usage
   - Database connection pools
   - External service dependencies
   - Alert status

### Creating Custom Dashboards

1. **Login to Grafana:** http://localhost:3000 (admin/admin)
2. **Add Data Source:** Configure Loki for logs, Prometheus for metrics
3. **Create Dashboard:** Use pre-built queries or create custom ones
4. **Set Alerts:** Configure alerting rules for critical metrics

## 🔍 Tracing Analysis

### Key Trace Patterns to Monitor

1. **Slow Requests:** Traces with duration > 5 seconds
2. **Error Traces:** Spans with error status
3. **Database Queries:** Slow or failing database operations
4. **External Calls:** Third-party service calls
5. **Agent Executions:** AI agent processing times

### Example Trace Analysis

```bash
# Find slow requests in Jaeger
# Search for traces where duration > 5000ms

# Find error patterns
# Group by error message and count occurrences

# Analyze agent performance
# Filter by operation.name = "agent.execute"
# Group by agent.type and calculate average duration
```

## 📋 Log Analysis

### Structured Logging Format

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "Agent execution completed",
  "service": "agent-service",
  "traceId": "abc123def456",
  "spanId": "xyz789",
  "userId": "user_123",
  "agentId": "agent_456",
  "duration": 150,
  "metadata": {
    "agentType": "crm",
    "success": true,
    "tokensUsed": 245
  }
}
```

### Log Query Examples (Loki)

```logql
# Find all error logs in last hour
{level="ERROR"} |= ``

# Find agent execution logs for specific user
{service="agent-service"} | userId="user_123"

# Find slow operations (> 1 second)
{service=~"agent-service|workflow-service"} | duration > 1000

# Count errors by agent type
{level="ERROR"} | json | agentType != `` | group_by([agentType])
```

## 🚨 Alerting Setup

### Prometheus Alert Rules

```yaml
# deployment/observability/alert-rules.yml
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

- **Email:** admin@orchestrall.com
- **Slack:** #alerts (if configured)
- **Webhook:** Custom notification endpoints

## 📈 Metrics Reference

### Key Metrics Collected

| Metric | Description | Labels |
|--------|-------------|--------|
| `log_events_total` | Total log events by level | `level`, `service` |
| `log_processing_duration_ms` | Log processing time | - |
| `agent_execution_duration_seconds` | Agent execution time | `agent_type`, `status` |
| `workflow_execution_duration_seconds` | Workflow execution time | `workflow_type`, `status` |
| `http_request_duration_seconds` | HTTP request duration | `method`, `endpoint`, `status_code` |
| `database_query_duration_seconds` | Database query time | `operation`, `table` |

## 🔧 Configuration

### Environment Variables

```bash
# OpenTelemetry Configuration
OTEL_EXPORTER=jaeger                    # or 'otlp' for production
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://jaeger:14268/api/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://loki:3100/loki/api/v1/push

# Jaeger Configuration
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Prometheus Configuration
PROMETHEUS_PORT=9464

# Logging Configuration
LOG_LEVEL=info                          # trace, debug, info, warn, error
LOG_FORMAT=json                         # or 'simple'
```

### Application Integration

```typescript
// In your service files
import { createLogger } from '../utils/enhanced-logger';

const logger = createLogger('my-service');

// Use in code
logger.info('Processing started', {
  userId: 'user_123',
  workflowId: 'workflow_456',
  metadata: { step: 'validation' }
});

// Trace async operations
const result = await logger.traceAsync(
  'process_workflow',
  async () => {
    // Your async operation
    return await processWorkflow(data);
  },
  {
    workflowId: 'workflow_456',
    component: 'workflow-service'
  }
);

// Performance timing
const timer = logger.startTimer('database_query');
const data = await queryDatabase();
timer(); // Logs duration
```

## 🎯 Best Practices

### 1. **Structured Logging**
- Always include relevant context (userId, requestId, etc.)
- Use consistent field names across services
- Include performance metrics (duration, counts)

### 2. **Trace Context**
- Use `traceAsync` for all async operations
- Include operation names and component identifiers
- Propagate trace context across service boundaries

### 3. **Error Tracking**
- Log errors with full context and stack traces
- Include user/session information for debugging
- Track error patterns and frequencies

### 4. **Performance Monitoring**
- Monitor key performance indicators (KPIs)
- Set up alerts for critical thresholds
- Track resource usage and bottlenecks

## 🚨 Troubleshooting

### Common Issues

1. **Missing Traces**
   - Check OpenTelemetry configuration
   - Verify service is instrumented
   - Check Jaeger endpoint connectivity

2. **High Log Volume**
   - Adjust log levels per service
   - Use sampling for high-volume operations
   - Archive old logs regularly

3. **Performance Impact**
   - Monitor observability overhead
   - Use sampling for non-critical traces
   - Tune batch sizes and export intervals

### Debug Commands

```bash
# Check if observability is running
curl http://localhost:9464/metrics | grep log_events

# View recent traces in Jaeger
# Access Jaeger UI and search for traces

# Query logs in Grafana/Loki
# Use LogQL queries to find specific patterns

# Check service health
curl http://localhost:3000/api/health
```

## 📚 Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus Documentation](https://prometheus.io/docs/)

---

**This observability stack provides comprehensive monitoring, tracing, and alerting for the Orchestrall platform with minimal operational overhead and cost.** 🚀
