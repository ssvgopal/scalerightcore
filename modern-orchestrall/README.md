# Modern Orchestrall Implementation - README

## 🎯 Project Overview

This is the **next-generation Orchestrall platform** implementing a modern hybrid deployment architecture with:

- **Microservices Architecture**: Independent, scalable services
- **Hybrid Deployment**: Self-hosting and cloud-native support
- **Agentic AI Frameworks**: LangGraph, CrewAI, AutoGen integration
- **Feature Flag System**: Runtime configuration per client
- **Plugin Architecture**: 200+ pre-built integrations

## 📁 Project Structure

```
modern-orchestrall/
├── packages/
│   ├── shared/              # Shared utilities and types
│   │   ├── src/
│   │   │   ├── types/       # TypeScript types and interfaces
│   │   │   ├── utils/       # Logging, metrics, circuit breaker
│   │   │   ├── workflows/   # LangGraph workflow engine
│   │   │   └── agents/      # CrewAI and AutoGen implementations
│   │   └── package.json
│   │
│   ├── auth-service/        # Authentication & authorization
│   │   ├── src/
│   │   │   └── index.ts     # JWT auth, login, register, refresh
│   │   └── package.json
│   │
│   ├── plugin-service/      # Plugin management
│   │   ├── src/
│   │   │   └── index.ts     # Install, enable, disable plugins
│   │   └── package.json
│   │
│   └── workflow-service/    # Workflow orchestration
│       ├── src/
│       │   └── index.ts     # LangGraph workflow execution
│       └── package.json
│
├── src/
│   ├── core/                # Core API gateway
│   │   ├── app.ts           # Fastify application
│   │   └── config.ts        # Environment configuration
│   ├── plugins/             # Fastify plugins
│   │   ├── auth.ts          # Authentication plugin
│   │   ├── feature-flags.ts # Feature flag plugin
│   │   ├── agent-runtime.ts # Agent runtime plugin
│   │   └── api-gateway.ts   # API gateway plugin
│   ├── middleware/          # Middleware
│   │   └── error-handler.ts # Global error handling
│   └── utils/               # Utilities
│       └── logger.ts        # Winston logger
│
├── prisma/
│   └── schema.prisma        # Database schema
│
├── deployment/
│   └── kubernetes/          # Kubernetes manifests
│       └── base.yaml        # Base deployment configuration
│
├── docker/
│   └── api-gateway/         # Docker builds
│       └── Dockerfile       # Multi-stage Docker build
│
├── docker-compose.yml       # Local development environment
├── package.json             # Monorepo configuration
├── tsconfig.json            # TypeScript configuration
└── .env.example             # Environment variables template
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (LTS)
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** (optional, for containerized deployment)
- **Kubernetes** or **K3s** (optional, for orchestration)

### Installation

```bash
# Clone the repository
cd modern-orchestrall

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# Set DATABASE_URL, REDIS_URL, JWT_SECRET, etc.

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

### Development

```bash
# Start all services in development mode
npm run dev

# Or start individual services
cd packages/auth-service && npm run dev
cd packages/plugin-service && npm run dev
cd packages/workflow-service && npm run dev
```

### Docker Compose (Recommended for Development)

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Build

```bash
# Build all packages
npm run build

# Start production server
npm run start
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- **Server**: `PORT`, `HOST`, `NODE_ENV`
- **Database**: `DATABASE_URL`, `DB_HOST`, `DB_PORT`
- **Redis**: `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`
- **Security**: `JWT_SECRET`, `JWT_EXPIRES_IN`
- **Feature Flags**: `FEATURE_FLAGS_PROVIDER`, `UNLEASH_URL`
- **Agents**: `AGENT_RUNTIME`, `OPENAI_API_KEY`
- **Deployment**: `DEPLOYMENT_TYPE`, `DEPLOYMENT_REGION`

### Feature Flags

Configure feature flags in the environment or via Unleash:

```yaml
# Local feature flags (default)
FEATURE_FLAGS_PROVIDER=local

# Unleash feature flags
FEATURE_FLAGS_PROVIDER=unleash
UNLEASH_URL=http://unleash:4242/api
UNLEASH_API_TOKEN=your-token
```

## 🤖 Agent Frameworks

### LangGraph Workflows

```typescript
import { langGraphEngine } from '@orchestrall/shared';

// Execute predefined workflow
const result = await langGraphEngine.executeWorkflow('customer-onboarding', {
  data: { customerData: { email: 'user@example.com', name: 'John Doe' } },
  metadata: {
    workflowId: 'workflow_123',
    executionId: 'exec_456',
    startTime: Date.now(),
    organizationId: 'org_789',
    userId: 'user_101',
  },
});
```

### CrewAI Multi-Agent Collaboration

```typescript
import { crewAIService, CREW_TEMPLATES } from '@orchestrall/shared';

// Create a business analysis crew
const crewId = await crewAIService.createCrew(CREW_TEMPLATES['business-analysis']);

// Execute the crew
const result = await crewAIService.executeCrew(crewId, {
  industry: 'e-commerce',
  timeframe: '2024-2025',
});
```

### AutoGen Conversations

```typescript
import { autoGenService, CONVERSATION_TEMPLATES } from '@orchestrall/shared';

// Start a code review conversation
const conversationId = await autoGenService.startConversation(
  ['CodeReviewer', 'SecurityExpert', 'PerformanceEngineer'],
  'Please review this code for security and performance issues.',
  { topic: 'Code Review', maxRounds: 8 }
);

// Get conversation history
const history = await autoGenService.getConversationHistory(conversationId);
```

## 🐳 Deployment

### Docker

```bash
# Build Docker image
docker build -t orchestrall/api-gateway:latest -f docker/api-gateway/Dockerfile .

# Run container
docker run -p 3000:3000 --env-file .env orchestrall/api-gateway:latest
```

### Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f deployment/kubernetes/base.yaml

# Check deployment status
kubectl get pods -n orchestrall

# View logs
kubectl logs -f deployment/orchestrall-api-gateway -n orchestrall

# Scale deployment
kubectl scale deployment orchestrall-api-gateway --replicas=5 -n orchestrall
```

### K3s (Lightweight Kubernetes for Self-Hosting)

```bash
# Install K3s
curl -sfL https://get.k3s.io | sh -

# Deploy to K3s
kubectl apply -f deployment/kubernetes/base.yaml

# Access services
kubectl port-forward svc/orchestrall-api-gateway 3000:80 -n orchestrall
```

## 📊 Monitoring & Observability

### Health Checks

```bash
# API Gateway health
curl http://localhost:3000/health

# Auth service health
curl http://localhost:3001/health

# Plugin service health
curl http://localhost:3004/health

# Workflow service health
curl http://localhost:3005/health
```

### Metrics

Access metrics at:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

### Logs

Logs are written to:
- **Console**: Structured JSON logs
- **Files**: `./logs/orchestrall-YYYY-MM-DD.log`

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🏥 PatientFlow - Healthcare Appointment System

**PatientFlow** is an AI-powered healthcare appointment management system that enables patients to book, reschedule, and manage appointments via voice calls and WhatsApp messaging. Built with Twilio, Google Cloud TTS, and OpenAI, it provides 24/7 automated patient support.

### Key Features

- 📞 **Voice IVR System**: AI-powered phone appointments with natural language understanding
- 💬 **WhatsApp Integration**: Self-service booking via WhatsApp messaging
- 🤖 **AI Conversations**: Context-aware multi-turn conversations with patients
- 📅 **Smart Scheduling**: Doctor availability management and conflict detection
- 🔔 **Automated Reminders**: SMS/WhatsApp appointment reminders
- 📊 **Patient Management**: Complete patient records with preferences and history
- 🏥 **Multi-Clinic Support**: Manage multiple clinic branches and doctors
- 🌍 **Multi-Language**: Support for multiple languages and locales

### Required Environment Variables

```bash
# Twilio Configuration (Voice & WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Google Cloud TTS (Text-to-Speech)
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# OR use base64 encoded credentials:
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=base64_encoded_json_here

# OpenAI (AI Conversations)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview
```

### Quick Start

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your Twilio, Google Cloud, and OpenAI credentials

# 2. Run database migrations
npx prisma migrate deploy

# 3. Seed demo data (clinic, doctors, schedules)
npx tsx prisma/seed-patientflow.ts

# 4. Start the server
npm run start

# 5. Test the system
curl http://localhost:3000/health
```

### API Examples

#### Health Check
```bash
# Basic health check
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "uptime": 3600
# }
```

#### Get Available Doctors
```bash
curl http://localhost:3000/api/patientflow/doctors \
  -H "X-Organization-ID: org_demo_clinic"

# Expected response:
# [
#   {
#     "id": "doc_123",
#     "firstName": "Sarah",
#     "lastName": "Smith",
#     "specialty": "General Practice",
#     "isAvailable": true,
#     "languages": ["en", "es"]
#   }
# ]
```

#### Check Doctor Availability
```bash
curl http://localhost:3000/api/patientflow/doctors/doc_123/availability \
  -H "X-Organization-ID: org_demo_clinic" \
  -G \
  --data-urlencode "date=2024-01-20" \
  --data-urlencode "duration=30"

# Expected response:
# {
#   "date": "2024-01-20",
#   "slots": [
#     { "start": "09:00", "end": "09:30", "available": true },
#     { "start": "09:30", "end": "10:00", "available": true },
#     { "start": "10:00", "end": "10:30", "available": false }
#   ]
# }
```

#### Book Appointment
```bash
curl -X POST http://localhost:3000/api/patientflow/appointments \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: org_demo_clinic" \
  -d '{
    "patientPhone": "+15555551234",
    "patientFirstName": "John",
    "patientLastName": "Doe",
    "patientEmail": "john.doe@email.com",
    "doctorId": "doc_123",
    "startTime": "2024-01-20T09:00:00Z",
    "endTime": "2024-01-20T09:30:00Z",
    "reason": "General checkup",
    "source": "MANUAL"
  }'

# Expected response:
# {
#   "id": "apt_456",
#   "status": "BOOKED",
#   "referenceNumber": "APT-2024-001",
#   "patient": {
#     "id": "pat_789",
#     "firstName": "John",
#     "lastName": "Doe"
#   },
#   "doctor": {
#     "id": "doc_123",
#     "name": "Dr. Sarah Smith"
#   },
#   "startTime": "2024-01-20T09:00:00Z",
#   "endTime": "2024-01-20T09:30:00Z"
# }
```

#### Get Patient Appointments
```bash
curl http://localhost:3000/api/patientflow/patients/phone/+15555551234/appointments \
  -H "X-Organization-ID: org_demo_clinic"

# Expected response:
# [
#   {
#     "id": "apt_456",
#     "status": "BOOKED",
#     "startTime": "2024-01-20T09:00:00Z",
#     "doctor": {
#       "name": "Dr. Sarah Smith",
#       "specialty": "General Practice"
#     },
#     "branch": {
#       "name": "Main Branch - Downtown",
#       "address": "123 Healthcare Ave"
#     }
#   }
# ]
```

#### Cancel/Reschedule Appointment
```bash
# Cancel appointment
curl -X PATCH http://localhost:3000/api/patientflow/appointments/apt_456 \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: org_demo_clinic" \
  -d '{
    "status": "CANCELLED"
  }'

# Reschedule appointment
curl -X PATCH http://localhost:3000/api/patientflow/appointments/apt_456 \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: org_demo_clinic" \
  -d '{
    "startTime": "2024-01-22T10:00:00Z",
    "endTime": "2024-01-22T10:30:00Z"
  }'
```

#### Get Call Logs
```bash
curl http://localhost:3000/api/patientflow/call-logs \
  -H "X-Organization-ID: org_demo_clinic" \
  -G \
  --data-urlencode "patientPhone=+15555551234" \
  --data-urlencode "limit=10"

# Expected response:
# [
#   {
#     "id": "call_789",
#     "callSid": "CAxxxxxxxxxxxxxxxx",
#     "status": "COMPLETED",
#     "startTime": "2024-01-15T14:30:00Z",
#     "durationSeconds": 120,
#     "transcription": "Patient called to book appointment..."
#   }
# ]
```

#### Get WhatsApp Message Logs
```bash
curl http://localhost:3000/api/patientflow/message-logs \
  -H "X-Organization-ID: org_demo_clinic" \
  -G \
  --data-urlencode "patientPhone=+15555551234" \
  --data-urlencode "channel=WHATSAPP" \
  --data-urlencode "limit=10"

# Expected response:
# [
#   {
#     "id": "msg_101",
#     "channel": "WHATSAPP",
#     "direction": "INBOUND",
#     "payload": {
#       "from": "whatsapp:+15555551234",
#       "body": "Hi, I need to book an appointment"
#     },
#     "createdAt": "2024-01-15T14:30:00Z"
#   }
# ]
```

### Documentation

For detailed setup, demo scenarios, and operational procedures, see:

- 📖 **[Deployment Guide](./docs/patientflow/deployment.md)** - Railway setup, environment configuration, Twilio/Google Cloud integration
- 🎬 **[Demo Scenarios](./docs/patientflow/demo-scenarios.md)** - Scripted walkthroughs for voice and WhatsApp demos
- 🛟 **[Operations Runbook](./docs/patientflow/runbook.md)** - Monitoring, troubleshooting, and maintenance procedures

### Demo Validation Checklist

Before running a demo:

- [ ] ✅ Railway deployment is healthy (`/health` returns 200)
- [ ] ✅ Database migrations are complete (`npx prisma migrate status`)
- [ ] ✅ Demo data is seeded (doctors, schedules, clinic branches)
- [ ] ✅ Twilio phone number is active and webhooks configured
- [ ] ✅ WhatsApp sandbox connected (or production number approved)
- [ ] ✅ Google Cloud TTS credentials valid (`gcloud auth list`)
- [ ] ✅ OpenAI API key has sufficient credits
- [ ] ✅ Test appointment booking via API works
- [ ] ✅ Test voice call triggers webhook correctly
- [ ] ✅ Test WhatsApp message triggers webhook correctly

### Cost Estimates

**Development Environment:**
- Railway Hobby: ~$5/month
- Twilio Phone Number: ~$1-2/month
- Twilio Usage: $0.0085/min for calls, $0.0075/SMS
- Google Cloud TTS: ~$4 per 1M characters (pay-as-you-go)
- OpenAI GPT-4: ~$0.03 per 1K tokens (pay-as-you-go)

**Production Environment:**
- Railway Pro: ~$20/month + databases
- Estimated usage: $50-100/month for 500 appointments/month

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   PatientFlow System                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │  Twilio  │───▶│  Fastify │───▶│PostgreSQL│         │
│  │ Voice +  │    │   API    │    │ Database │         │
│  │ WhatsApp │◀───│  Server  │◀───│  Prisma  │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│       │               │                                  │
│       │          ┌────┴────┐                           │
│       │          │         │                           │
│  ┌────▼───┐  ┌──▼──┐  ┌──▼────┐                      │
│  │ Google │  │Redis│  │OpenAI │                      │
│  │  TTS   │  │Cache│  │  AI   │                      │
│  └────────┘  └─────┘  └───────┘                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Support

For PatientFlow issues:
- 📧 Email: patientflow-support@orchestrall.com
- 💬 Slack: #patientflow-support
- 📖 Docs: [docs/patientflow/](./docs/patientflow/)

---

## 📚 API Documentation

### Authentication

```bash
# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Register
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "organizationName": "ACME Corp"
}

# Refresh token
POST /auth/refresh
{
  "refreshToken": "your-refresh-token"
}

# Get current user
GET /auth/me
Authorization: Bearer <access-token>
```

### Plugins

```bash
# List available plugins
GET /plugins

# Get plugin details
GET /plugins/:pluginId

# Install plugin
POST /organizations/:organizationId/plugins
{
  "pluginId": "crm-salesforce",
  "config": {
    "instanceUrl": "https://your-instance.salesforce.com",
    "apiKey": "your-api-key"
  }
}

# List installed plugins
GET /organizations/:organizationId/plugins

# Enable/disable plugin
PUT /plugins/:pluginId
{
  "enabled": true
}

# Uninstall plugin
DELETE /plugins/:pluginId
```

### Workflows

```bash
# Create workflow
POST /workflows
{
  "name": "Customer Onboarding",
  "description": "Automated customer onboarding workflow",
  "definition": { ... }
}

# List workflows
GET /workflows

# Execute workflow
POST /workflows/:workflowId/execute
{
  "input": { ... },
  "async": false
}

# Get execution status
GET /executions/:executionId
```

### Agents

```bash
# Execute agent
POST /api/v2/agents/execute
{
  "input": "Analyze this customer data",
  "agent": "DataAnalyst",
  "context": {
    "conversationId": "conv_123"
  }
}

# List available agents
GET /api/v2/agents
```

## 🔐 Security

- **JWT Authentication**: Secure token-based authentication
- **RBAC**: Role-based access control
- **Rate Limiting**: Prevent abuse and DDoS attacks
- **Input Validation**: Zod schema validation
- **SQL Injection Protection**: Prisma ORM
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configurable cross-origin resource sharing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@orchestrall.com or join our Slack channel.

## 🎉 Acknowledgments

- **Fastify** - Fast and low overhead web framework
- **Prisma** - Next-generation ORM
- **LangGraph** - Stateful AI agent workflows
- **CrewAI** - Role-based agent collaboration
- **AutoGen** - Multi-agent conversations

---

**Built with ❤️ by the Orchestrall Team**
