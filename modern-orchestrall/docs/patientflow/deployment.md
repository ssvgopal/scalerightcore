# PatientFlow Dashboard Deployment Guide

## Overview

The PatientFlow Dashboard is a Next.js application that provides real-time monitoring of clinic operations, including patient communications, appointments, and call sessions. This guide covers installation, configuration, development, and deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [API Integration](#api-integration)
- [Authentication](#authentication)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Backend Requirements
- Node.js 18+ 
- PostgreSQL database
- Prisma CLI
- Modern Orchestrall backend running

### Frontend Requirements
- Node.js 18+
- npm or yarn package manager

## Installation

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd modern-orchestrall

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database configuration

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed demo data (optional but recommended)
npm run db:seed:patientflow

# Start the backend server
npm run dev
```

The backend will be available at `http://localhost:3000`

### 2. Frontend Setup

```bash
# Navigate to the dashboard directory
cd apps/patientflow-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

## Environment Configuration

### Backend Environment Variables (.env)

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/patientflow"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# Server Configuration
NODE_ENV="development"
PORT=3000
HOST="localhost"

# CORS (important for dashboard)
CORS_ORIGINS="http://localhost:3001,http://localhost:3000"
```

### Frontend Environment Variables (.env.local)

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_DEMO_KEY=demo-key-for-development

# Authentication (for demo purposes)
NEXT_PUBLIC_DEMO_EMAIL=admin@example.com
NEXT_PUBLIC_DEMO_PASSWORD=password123

# Development settings
NEXT_PUBLIC_NODE_ENV=development
NEXT_PUBLIC_REFRESH_INTERVAL=10000

# Optional: WebSocket/SSE configuration for real-time updates
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_ENABLE_REALTIME=true
```

## Development

### Starting the Development Servers

1. **Backend Server** (Terminal 1):
```bash
cd modern-orchestrall
npm run dev
```

2. **Frontend Dashboard** (Terminal 2):
```bash
cd apps/patientflow-dashboard
npm run dev
```

The dashboard will be available at `http://localhost:3001`

### Development Features

- **Hot Module Replacement**: Both frontend and backend support hot reloading
- **Auto-refresh**: Dashboard automatically refreshes data every 10 seconds
- **Demo Mode**: One-click demo access without authentication setup
- **Mock Data**: Pre-seeded demo data for testing all features

### File Structure

```
apps/patientflow-dashboard/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── layout.tsx         # Root layout with AuthProvider
│   │   └── page.tsx           # Main dashboard page
│   ├── components/             # React components
│   │   ├── MetricsCard.tsx    # Metrics display cards
│   │   ├── AppointmentsList.tsx # Appointments management
│   │   ├── LiveConversations.tsx # Real-time messages
│   │   └── ActiveCalls.tsx    # Active call sessions
│   ├── contexts/              # React contexts
│   │   └── AuthContext.tsx    # Authentication context
│   └── lib/                   # Utility libraries
│       └── api.ts             # API client and types
├── public/                    # Static assets
└── package.json               # Dependencies and scripts
```

## Production Deployment

### Option 1: Static Export (Vercel/Netlify)

1. **Build the Dashboard**:
```bash
cd apps/patientflow-dashboard
npm run build
```

2. **Deploy to Vercel**:
```bash
npm i -g vercel
vercel --prod
```

3. **Deploy to Netlify**:
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=.next
```

### Option 2: Railway Deployment

1. **Create a `railway.toml` file**:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[[services]]
name = "patientflow-dashboard"

[services.variables]
NODE_ENV = "production"
PORT = "3001"
```

2. **Deploy to Railway**:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
railway domain
```

### Option 3: Docker Deployment

1. **Create Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

2. **Build and Run**:
```bash
docker build -t patientflow-dashboard .
docker run -p 3001:3001 patientflow-dashboard
```

## API Integration

### Required Backend Endpoints

The dashboard expects these API endpoints to be available:

- `GET /patientflow/api/dashboard/overview` - Dashboard metrics
- `GET /patientflow/api/dashboard/appointments` - Upcoming appointments
- `GET /patientflow/api/dashboard/calls/active` - Active call sessions
- `GET /patientflow/api/dashboard/activities` - Recent activities
- `GET /patientflow/api/dashboard/conversations/live` - Live conversations
- `GET /health` - Health check

### Authentication

The dashboard supports two authentication methods:

1. **JWT Token Authentication** (Production):
   - Set `Authorization: Bearer <token>` header
   - Tokens obtained from `/auth/login` endpoint

2. **API Key Authentication** (Demo):
   - Set `X-API-Key: <demo-key>` header
   - Configured via `NEXT_PUBLIC_API_DEMO_KEY`

### Response Formats

All API responses follow this structure:
```json
{
  "metrics": {
    "totalMessages": 150,
    "totalCalls": 75,
    "totalAppointments": 25,
    "activeConversations": 12,
    "upcomingAppointments": 8
  },
  "recentMessages": [...],
  "appointments": [...],
  "activeCalls": [...],
  "activities": [...]
}
```

## Authentication

### Demo Mode

The dashboard includes a built-in demo mode for easy testing:

1. Visit the dashboard URL
2. Click "Enter Dashboard Demo"
3. No authentication required
4. Uses pre-configured demo API key

### Production Authentication

For production use:

1. **Backend Setup**:
   - Configure JWT secret in backend
   - Set up proper user authentication
   - Create API keys for service access

2. **Frontend Configuration**:
   - Remove demo mode from login flow
   - Implement proper login form
   - Store tokens securely

## Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Ensure `CORS_ORIGINS` includes your dashboard URL
   - Check that both frontend and backend are running

2. **API Connection Issues**:
   - Verify `NEXT_PUBLIC_API_BASE_URL` is correct
   - Check backend health at `/health` endpoint
   - Ensure API endpoints are accessible

3. **Authentication Failures**:
   - For demo mode: Check `NEXT_PUBLIC_API_DEMO_KEY`
   - For JWT: Verify token is being sent in Authorization header
   - Check token expiration

4. **Build Errors**:
   - Ensure all dependencies are installed
   - Check TypeScript types in API client
   - Verify environment variables are set

### Debug Mode

Enable debug logging by setting:
```env
NEXT_PUBLIC_NODE_ENV=development
```

### Health Checks

Monitor system health with:
- Backend: `GET /health`
- Frontend: Check browser console for errors
- Database: Verify Prisma connection

## Performance Optimization

### Frontend Optimization

1. **Image Optimization**: Use Next.js Image component
2. **Code Splitting**: Automatic with Next.js
3. **Caching**: Configure proper cache headers
4. **Bundle Size**: Monitor with `npm run build`

### Backend Optimization

1. **Database Indexing**: Ensure proper indexes on queries
2. **API Caching**: Implement Redis for frequently accessed data
3. **Connection Pooling**: Configure Prisma connection limits
4. **Query Optimization**: Use Prisma's `select` to limit fields

## Security Considerations

1. **API Keys**: Rotate demo keys regularly
2. **CORS**: Restrict to specific origins in production
3. **Rate Limiting**: Configure on backend endpoints
4. **Input Validation**: Validate all API inputs
5. **HTTPS**: Enforce in production

## Monitoring and Logging

### Frontend Monitoring

- Use browser console for development debugging
- Implement error boundaries for production
- Consider analytics integration

### Backend Monitoring

- Check `/metrics` endpoint for Prometheus metrics
- Monitor `/health` endpoint availability
- Log API access and errors

## Support

For issues and questions:

1. Check this documentation first
2. Review browser console for frontend errors
3. Check backend logs for API issues
4. Verify environment configurations
5. Test with demo data before custom integrations

## Version History

- **v1.0.0**: Initial release with core dashboard features
- Real-time messaging and call monitoring
- Appointment management
- Metrics and analytics
- Demo mode for easy testing