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

### PatientFlow Configuration

PatientFlow provides AI-powered voice and messaging capabilities. See `deployment/patientflow-env-config.md` for detailed setup:

```bash
# AI Provider
PATIENTFLOW_AI_PROVIDER=openai
OPENAI_WHISPER_MODEL=whisper-1
CLAUDE_API_KEY=sk-ant-...

# Twilio (WhatsApp, Voice, SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+1234567890
TWILIO_VOICE_NUMBER=+1234567890
TWILIO_WEBHOOK_SECRET=...

# Google Cloud Text-to-Speech
GOOGLE_TTS_PROJECT_ID=my-project
GOOGLE_TTS_CLIENT_EMAIL=...@iam.gserviceaccount.com
GOOGLE_TTS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...

# Session Management
PATIENTFLOW_SESSION_TTL=3600
DEMO_PHONE_ALLOWLIST=+1234567890
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
