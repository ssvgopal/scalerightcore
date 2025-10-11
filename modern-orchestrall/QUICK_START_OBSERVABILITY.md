# 🚀 Quick Start: Observability Stack

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and npm 9+

## 1. Start the Observability Stack

```bash
# From the modern-orchestrall directory
npm run observability:up

# Or manually
cd deployment/observability
docker-compose up -d
```

## 2. Verify Services are Running

```bash
# Check container status
docker-compose ps

# Should show:
# NAME                    COMMAND                  SERVICE             STATUS
# orchestrall-jaeger      "/go/bin/all-in-one-…"   jaeger              Up
# orchestrall-grafana     "/run.sh"                grafana             Up
# orchestrall-loki        "/usr/bin/loki -conf…"   loki                Up
# orchestrall-prometheus  "/bin/prometheus --c…"   prometheus          Up
# orchestrall-promtail    "/usr/bin/promtail -…"   promtail            Up
```

## 3. Access the Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| **Jaeger** (Tracing) | http://localhost:16686 | - |
| **Grafana** (Dashboard) | http://localhost:3000 | admin/admin |
| **Prometheus** (Metrics) | http://localhost:9090 | - |

## 4. Start Your Application

```bash
# The application will automatically send traces and metrics
# to the observability stack when running
npm run dev
```

## 5. Generate Some Activity

```bash
# Make API calls to generate traces and logs
curl -X POST http://localhost:3000/api/v2/agents/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "agentType": "crm",
    "input": "Find customer information for john@example.com",
    "context": {
      "userId": "user_123",
      "organizationId": "org_456"
    }
  }'
```

## 6. View the Results

### Jaeger (Distributed Tracing)
1. Open http://localhost:16686
2. Select "orchestrall-platform" service
3. Click "Find Traces"
4. View the trace details and service dependencies

### Grafana (Monitoring Dashboard)
1. Open http://localhost:3000 (admin/admin)
2. Navigate to Dashboards → Browse
3. Select "Orchestrall Platform Overview"
4. View metrics, logs, and traces in one place

### Prometheus (Metrics)
1. Open http://localhost:9090
2. Query metrics like `log_events_total` or `agent_execution_duration_seconds`

## 📊 What You'll See

### Traces in Jaeger:
- **Service Dependencies**: Visual graph of service interactions
- **Request Flow**: Complete journey from API call to database
- **Performance Data**: Duration, errors, and bottlenecks
- **Context**: User ID, operation names, and metadata

### Metrics in Grafana:
- **Request Rates**: HTTP requests per second
- **Error Rates**: Failed operations over time
- **Response Times**: 95th percentile latencies
- **Custom Metrics**: Agent executions, workflow completions

### Logs in Loki (via Grafana):
- **Structured Logs**: JSON format with context
- **Correlations**: Trace IDs linking logs to traces
- **Filtering**: Search by user, operation, error type
- **Patterns**: Identify common issues and trends

## 🔧 Troubleshooting

### Common Issues

1. **Traces not appearing in Jaeger:**
   ```bash
   # Check if OpenTelemetry is initialized
   curl http://localhost:9464/metrics | grep log_events

   # Check Jaeger logs
   docker-compose logs jaeger
   ```

2. **Logs not appearing in Grafana:**
   ```bash
   # Check Loki and Promtail logs
   docker-compose logs loki promtail

   # Verify log file paths
   ls -la logs/
   ```

3. **High resource usage:**
   - Scale down log retention in Loki config
   - Adjust sampling rates in OpenTelemetry
   - Use log levels to reduce verbosity

## 🚀 Production Deployment

### Kubernetes
```bash
# Deploy observability stack
kubectl apply -f deployment/kubernetes/observability.yaml

# Check status
kubectl get pods -n observability
```

### Environment Variables
```bash
# Production configuration
OTEL_EXPORTER=otlp
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://jaeger-collector:4318/v1/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://loki:3100/loki/api/v1/push
```

## 📈 Monitoring Your Observability

The observability stack itself generates metrics you can monitor:

```promql
# Observability service health
up{job="orchestrall-services"}

# Log volume
rate(log_events_total[5m])

# Trace volume
jaeger_traces

# Resource usage
container_cpu_usage_seconds_total{container="orchestrall-jaeger"}
```

## 🎯 Next Steps

1. **Set up alerting** in Grafana for critical errors
2. **Create custom dashboards** for your specific use cases
3. **Configure log retention** policies for production
4. **Set up backup strategies** for trace and metric data
5. **Monitor the observability stack** itself for health

---

**Your observability stack is now running! Generate some traffic and watch the traces, metrics, and logs appear in real-time.** 🚀
