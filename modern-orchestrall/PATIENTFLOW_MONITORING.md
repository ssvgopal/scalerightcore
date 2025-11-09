# PatientFlow Monitoring & Health Checks

This document describes the PatientFlow monitoring metrics and health checks that have been added to the Orchestrall platform.

## Overview

The PatientFlow subsystem now includes comprehensive monitoring and health checking capabilities that integrate with the existing Prometheus monitoring infrastructure.

## New Metrics

### Message Metrics
- **`patientflow_messages_total`** - Counter for all PatientFlow messages
  - Labels: `channel` (WHATSAPP, VOICE), `direction` (INBOUND, OUTBOUND)
  - Help: "Total number of PatientFlow messages"

### Call Metrics  
- **`patientflow_calls_total`** - Counter for all PatientFlow voice calls
  - Labels: `status` (INITIATED, RINGING, ANSWERED, COMPLETED, FAILED, MISSED)
  - Help: "Total number of PatientFlow calls"

- **`patientflow_call_duration_seconds`** - Histogram for call durations
  - Labels: `status` (same as above)
  - Buckets: [5, 15, 30, 60, 120, 300, 600, 1800] seconds
  - Help: "Duration of PatientFlow calls in seconds"

### Booking Metrics
- **`patientflow_bookings_total`** - Counter for appointment bookings
  - Labels: `source` (WHATSAPP, VOICE, MANUAL), `status` (BOOKED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW)
  - Help: "Total number of PatientFlow bookings"

## Health Checks

The `/api/health` endpoint now includes PatientFlow subsystem health checks:

### Twilio Health Check
- Checks for required environment variables:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN` 
  - `TWILIO_PHONE_NUMBER`
- Validates credential format
- Status: `healthy`, `degraded`, or `unhealthy`

### AI Provider Health Check
- Checks for OpenAI API key:
  - `OPENAI_API_KEY`
- Validates API key format
- Status: `healthy`, `degraded`, or `unhealthy`

### Google TTS Health Check
- Checks for Google Cloud credentials:
  - `GOOGLE_APPLICATION_CREDENTIALS` (file path)
  - `GOOGLE_TTS_KEY_JSON` (JSON string)
- Validates credential file existence if path provided
- Status: `healthy`, `degraded`, or `unhealthy`

## API Endpoints

### Health Check
```
GET /api/health
```

Returns overall system health including PatientFlow subsystem status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "version": "2.0.0",
  "patientflow": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "checks": {
      "twilio": {
        "status": "healthy",
        "message": "Twilio credentials properly formatted",
        "timestamp": "2024-01-01T00:00:00.000Z"
      },
      "aiProvider": {
        "status": "healthy", 
        "message": "OpenAI API key properly formatted",
        "timestamp": "2024-01-01T00:00:00.000Z"
      },
      "googleTts": {
        "status": "healthy",
        "message": "Google TTS credentials file found",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    }
  }
}
```

### Metrics Endpoint
```
GET /metrics
```

Returns Prometheus-formatted metrics including all PatientFlow metrics.

### Webhook Endpoints

#### WhatsApp Webhook
```
POST /webhooks/patientflow/whatsapp
```

Processes inbound WhatsApp messages and increments `patientflow_messages_total`.

Request body:
```json
{
  "Body": "Message content",
  "From": "whatsapp:+1234567890",
  "To": "whatsapp:+0987654321", 
  "MessageSid": "message_id"
}
```

#### Voice Webhook
```
POST /webhooks/patientflow/voice
```

Processes Twilio call events and increments `patientflow_calls_total` and `patientflow_call_duration_seconds`.

Request body:
```json
{
  "CallSid": "call_id",
  "CallStatus": "completed",
  "From": "+1234567890",
  "To": "+0987654321",
  "Duration": "120"
}
```

#### Appointment Webhook
```
POST /webhooks/patientflow/appointment
```

Processes appointment bookings and increments `patientflow_bookings_total`.

Request body:
```json
{
  "source": "WHATSAPP",
  "patientId": "patient_123",
  "doctorId": "doctor_456", 
  "startTime": "2024-01-01T10:00:00.000Z",
  "endTime": "2024-01-01T11:00:00.000Z",
  "reason": "Regular checkup"
}
```

### Testing Endpoint
```
GET /test/patientflow/simulate?type=message&count=5
```

Simulates PatientFlow interactions for testing metrics:

- `type`: `message`, `call`, `booking`, or omit for all types
- `count`: Number of interactions to simulate (1-10)

## Environment Variables

### Required for Full Functionality
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# AI Provider
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google TTS (one of these)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
# OR
GOOGLE_TTS_KEY_JSON='{"type":"service_account",...}'
```

## Testing

A test script is provided to verify the monitoring implementation:

```bash
node test-patientflow-monitoring.js
```

This script will:
1. Test the health check endpoint
2. Verify metrics are exposed
3. Simulate PatientFlow interactions
4. Test webhook endpoints
5. Show updated metrics

## Integration with Existing Monitoring

The PatientFlow metrics integrate seamlessly with the existing monitoring system:

- No regression to existing metrics
- Same Prometheus registry and format
- Consistent with existing naming conventions
- Health checks extend existing `/api/health` endpoint

## Prometheus Configuration

Add to your Prometheus scrape configuration:

```yaml
scrape_configs:
  - job_name: 'orchestrall'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Grafana Dashboard

You can create a Grafana dashboard with panels for:

- PatientFlow message rate by channel and direction
- Call completion rates and duration distribution  
- Appointment booking trends by source
- PatientFlow subsystem health status

## Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: patientflow
    rules:
      - alert: PatientFlowUnhealthy
        expr: up{job="orchestrall"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PatientFlow service is down"
          
      - alert: PatientFlowHighFailureRate
        expr: rate(patientflow_calls_total{status="failed"}[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High call failure rate detected"
```

## Troubleshooting

### Metrics Not Appearing
1. Check that the monitoring service is initialized
2. Verify interactions are being processed via webhooks or simulation
3. Check `/metrics` endpoint is accessible

### Health Check Shows Unhealthy
1. Verify required environment variables are set
2. Check credential formats match expected patterns
3. For Google TTS, ensure credential file exists

### Webhook Failures
1. Check request body format matches expected schema
2. Verify required fields are present
3. Check server logs for detailed error messages