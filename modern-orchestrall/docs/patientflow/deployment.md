# PatientFlow Deployment Guide

## 📋 Overview

This guide provides step-by-step instructions for deploying the PatientFlow system, including Railway setup, environment configuration, Twilio/WhatsApp integration, Google Cloud credentials, and database setup.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Railway.app Deployment                 │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Fastify    │  │  PostgreSQL  │  │    Redis     │ │
│  │  Web Service │  │   Database   │  │    Cache     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
              ▲                ▲                ▲
              │                │                │
         ┌────┴────┐      ┌───┴────┐      ┌───┴────┐
         │ Twilio  │      │ Google │      │ OpenAI │
         │ Voice + │      │ Cloud  │      │   AI   │
         │WhatsApp │      │  TTS   │      │  LLM   │
         └─────────┘      └────────┘      └────────┘
```

## 🚀 Prerequisites

Before deploying PatientFlow, ensure you have:

- [ ] **Railway.app Account** (Free tier available, $5-20/month for production)
- [ ] **Twilio Account** with SMS/Voice enabled
- [ ] **Twilio WhatsApp Sandbox** configured
- [ ] **Google Cloud Project** with Text-to-Speech API enabled
- [ ] **OpenAI API Key** (for AI-powered conversations)
- [ ] **Node.js 20+** and npm (for local testing)
- [ ] **Railway CLI** installed (`npm install -g @railway/cli`)

## 🔧 Step 1: Railway Project Setup

### 1.1 Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 1.2 Create Railway Project

```bash
# Navigate to project directory
cd modern-orchestrall

# Initialize Railway project
railway init

# Link to existing project (if already created)
railway link
```

### 1.3 Create PostgreSQL Database

In Railway Dashboard:
1. Click **"New"** → **"Database"** → **"PostgreSQL"**
2. Wait for database to provision
3. Copy the **DATABASE_URL** from database settings

### 1.4 Create Redis Instance (Optional but Recommended)

In Railway Dashboard:
1. Click **"New"** → **"Database"** → **"Redis"**
2. Wait for Redis to provision
3. Copy the **REDIS_URL** from Redis settings

## 🔐 Step 2: Twilio Configuration

### 2.1 Create Twilio Account

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Complete account verification
3. Navigate to **Console Dashboard**

### 2.2 Get Twilio Credentials

From Twilio Console:
- **Account SID**: Found on dashboard (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- **Auth Token**: Click "Show" to reveal (e.g., `auth_token_here`)
- **Phone Number**: Purchase a phone number with Voice + SMS capabilities

```bash
# Phone Number Purchase:
# 1. Go to Phone Numbers → Buy a Number
# 2. Select country (e.g., United States)
# 3. Check "Voice" and "SMS" capabilities
# 4. Purchase number (costs ~$1-2/month)
```

### 2.3 Configure Twilio Webhooks

#### Voice Webhook Configuration:
1. Go to **Phone Numbers** → **Active Numbers**
2. Click on your purchased number
3. Under **Voice Configuration**:
   - **A Call Comes In**: `https://your-railway-app.railway.app/api/voice/incoming`
   - **HTTP Method**: POST
4. Click **Save**

#### SMS Webhook Configuration:
1. Same phone number settings
2. Under **Messaging Configuration**:
   - **A Message Comes In**: `https://your-railway-app.railway.app/api/sms/incoming`
   - **HTTP Method**: POST
3. Click **Save**

### 2.4 WhatsApp Sandbox Setup

For development/testing:

1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Join the sandbox by sending the provided code to the WhatsApp number
3. Configure webhook:
   - **When a message comes in**: `https://your-railway-app.railway.app/api/whatsapp/incoming`
   - **HTTP Method**: POST

For production:

1. Apply for WhatsApp Business API access
2. Complete business verification
3. Configure production WhatsApp number
4. Set webhook URL to production endpoint

**Sandbox Number Format**: `whatsapp:+14155238886`

## ☁️ Step 3: Google Cloud Configuration

### 3.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"New Project"**
3. Name: `orchestrall-patientflow`
4. Click **"Create"**

### 3.2 Enable Text-to-Speech API

```bash
# Using gcloud CLI
gcloud services enable texttospeech.googleapis.com

# Or via Console:
# 1. Go to APIs & Services → Library
# 2. Search "Cloud Text-to-Speech API"
# 3. Click "Enable"
```

### 3.3 Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **"Create Service Account"**
3. Name: `patientflow-tts-service`
4. Grant role: **"Cloud Text-to-Speech User"**
5. Click **"Done"**

### 3.4 Generate Service Account Key

1. Click on the service account
2. Go to **Keys** tab
3. Click **"Add Key"** → **"Create new key"**
4. Choose **JSON** format
5. Download the JSON key file

**Important**: Keep this file secure - it grants access to your Google Cloud resources.

### 3.5 Upload Service Account Key to Railway

```bash
# Convert JSON to base64 for Railway environment variable
cat service-account-key.json | base64 > service-account-key-base64.txt

# Copy the base64 string and add to Railway as GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
```

Or upload directly in Railway Dashboard:
1. Go to your Railway project
2. Click **Variables**
3. Add `GOOGLE_APPLICATION_CREDENTIALS` as a file upload
4. Upload the `service-account-key.json` file

## 🔑 Step 4: Environment Variables Configuration

### 4.1 Required Environment Variables

In Railway Dashboard, add the following variables:

#### **Server Configuration**
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

#### **Database Configuration** (Auto-populated by Railway)
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

#### **Redis Configuration** (Auto-populated by Railway)
```env
REDIS_URL=redis://host:port
```

#### **Security Configuration**
```env
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

#### **Twilio Configuration**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_STATUS_CALLBACK_URL=https://your-railway-app.railway.app/api/voice/status
```

#### **Google Cloud Configuration**
```env
GOOGLE_PROJECT_ID=orchestrall-patientflow
GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json
# OR use base64 encoded:
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=base64_encoded_json_key_here
```

#### **OpenAI Configuration**
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7
```

#### **PatientFlow Configuration**
```env
# Organization ID for multi-tenant setup
DEFAULT_ORGANIZATION_ID=org_patientflow_demo

# Appointment configuration
DEFAULT_APPOINTMENT_DURATION_MINUTES=30
APPOINTMENT_REMINDER_HOURS_BEFORE=24
MAX_APPOINTMENTS_PER_DAY=20

# TTS Configuration
TTS_CACHE_ENABLED=true
TTS_VOICE_NAME=en-US-Neural2-F
TTS_SPEAKING_RATE=1.0

# Call Configuration
MAX_CALL_DURATION_SECONDS=300
CALL_TIMEOUT_SECONDS=30
```

#### **CORS Configuration**
```env
CORS_ORIGIN=https://your-frontend-domain.com,https://studio.twilio.com
CORS_CREDENTIALS=true
```

#### **Rate Limiting**
```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.2 Optional Environment Variables

```env
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 📦 Step 5: Database Migration & Seeding

### 5.1 Run Database Migrations

```bash
# Using Railway CLI (recommended)
railway run npx prisma migrate deploy

# Or via Railway Dashboard:
# 1. Go to Settings → Deploy
# 2. Add to Build Command: npm ci && npm run db:generate
# 3. Migrations will run automatically on deploy
```

### 5.2 Verify Database Schema

```bash
railway run npx prisma db pull
railway run npx prisma studio
```

### 5.3 Seed Initial Data

Create seed script `prisma/seed-patientflow.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-clinic' },
    update: {},
    create: {
      name: 'Demo Healthcare Clinic',
      slug: 'demo-clinic',
      tier: 'professional',
      status: 'active',
    },
  });

  // Create clinic branch
  const branch = await prisma.clinicBranch.create({
    data: {
      name: 'Main Branch - Downtown',
      organizationId: org.id,
      address: '123 Healthcare Ave',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'USA',
      phone: '+14155551234',
      email: 'main@democlinic.com',
      operatingHours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '14:00' },
        sunday: { open: 'closed', close: 'closed' },
      },
    },
  });

  // Create doctors
  const drSmith = await prisma.doctor.create({
    data: {
      firstName: 'Sarah',
      lastName: 'Smith',
      email: 'dr.smith@democlinic.com',
      phone: '+14155551001',
      organizationId: org.id,
      branchId: branch.id,
      specialty: 'General Practice',
      licenseNumber: 'CA-GP-123456',
      qualifications: ['MD', 'Board Certified'],
      languages: ['en', 'es'],
      isAvailable: true,
      isActive: true,
    },
  });

  const drJohnson = await prisma.doctor.create({
    data: {
      firstName: 'Michael',
      lastName: 'Johnson',
      email: 'dr.johnson@democlinic.com',
      phone: '+14155551002',
      organizationId: org.id,
      branchId: branch.id,
      specialty: 'Cardiology',
      licenseNumber: 'CA-CARD-789012',
      qualifications: ['MD', 'Cardiology Fellowship'],
      languages: ['en'],
      isAvailable: true,
      isActive: true,
    },
  });

  // Create doctor schedules
  await prisma.doctorSchedule.createMany({
    data: [
      // Dr. Smith - Monday to Friday
      { doctorId: drSmith.id, dayOfWeek: 1, timeSlots: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], slotDurationMinutes: 30, isActive: true },
      { doctorId: drSmith.id, dayOfWeek: 2, timeSlots: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], slotDurationMinutes: 30, isActive: true },
      { doctorId: drSmith.id, dayOfWeek: 3, timeSlots: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], slotDurationMinutes: 30, isActive: true },
      { doctorId: drSmith.id, dayOfWeek: 4, timeSlots: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], slotDurationMinutes: 30, isActive: true },
      { doctorId: drSmith.id, dayOfWeek: 5, timeSlots: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }], slotDurationMinutes: 30, isActive: true },
      // Dr. Johnson - Tuesday, Thursday, Saturday
      { doctorId: drJohnson.id, dayOfWeek: 2, timeSlots: [{ start: '10:00', end: '14:00' }], slotDurationMinutes: 45, isActive: true },
      { doctorId: drJohnson.id, dayOfWeek: 4, timeSlots: [{ start: '10:00', end: '14:00' }], slotDurationMinutes: 45, isActive: true },
      { doctorId: drJohnson.id, dayOfWeek: 6, timeSlots: [{ start: '10:00', end: '14:00' }], slotDurationMinutes: 45, isActive: true },
    ],
  });

  console.log('✅ PatientFlow seed data created successfully!');
  console.log(`Organization: ${org.name} (${org.id})`);
  console.log(`Branch: ${branch.name} (${branch.id})`);
  console.log(`Doctors: Dr. ${drSmith.firstName} ${drSmith.lastName}, Dr. ${drJohnson.firstName} ${drJohnson.lastName}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seed:
```bash
railway run npx tsx prisma/seed-patientflow.ts
```

## 🚢 Step 6: Deploy to Railway

### 6.1 Deploy via Railway CLI

```bash
# Deploy current branch
railway up

# Or deploy with specific service
railway up --service orchestrall-api
```

### 6.2 Deploy via Git Push

```bash
# Connect Railway to your GitHub repository
# 1. Go to Railway Dashboard
# 2. Settings → Connect GitHub Repository
# 3. Select your repository and branch

# Push to deploy
git push origin main
```

### 6.3 Monitor Deployment

```bash
# View deployment logs
railway logs

# Check deployment status
railway status
```

## ✅ Step 7: Verification & Testing

### 7.1 Health Check

```bash
# Check API health
curl https://your-railway-app.railway.app/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### 7.2 Test Twilio Webhook

```bash
# Test incoming call webhook
curl -X POST https://your-railway-app.railway.app/api/voice/incoming \
  -d "CallSid=CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -d "From=+15555551234" \
  -d "To=+15555555678"
```

### 7.3 Test WhatsApp Integration

Send a WhatsApp message to your Twilio number:
```
Hi, I'd like to book an appointment
```

Check logs:
```bash
railway logs --filter "whatsapp"
```

### 7.4 Test Voice Call

Call your Twilio number and verify:
- [ ] Call is answered
- [ ] IVR greeting plays
- [ ] Menu options work
- [ ] Call is logged in database

## 🎯 Step 8: Post-Deployment Configuration

### 8.1 Set Up Monitoring Alerts

In Railway Dashboard:
1. Go to **Settings** → **Alerts**
2. Add alert for:
   - CPU usage > 80%
   - Memory usage > 80%
   - Deployment failures
   - HTTP 5xx errors

### 8.2 Configure Custom Domain (Optional)

```bash
# Add custom domain
railway domain add patientflow.yourdomain.com

# Configure DNS
# Add CNAME record: patientflow.yourdomain.com → your-app.railway.app
```

### 8.3 Enable Automatic Backups

```bash
# Railway automatically backs up PostgreSQL
# Configure backup retention in Database settings
```

## 📊 Cost Estimates

### Development Environment
- **Railway Hobby Plan**: $5/month
- **PostgreSQL**: Included
- **Redis**: Included
- **Twilio**: ~$1-2/month (number rental) + usage
- **Google Cloud TTS**: Pay-as-you-go (~$4 per 1M characters)
- **OpenAI**: Pay-as-you-go (~$0.03 per 1K tokens)

**Total**: ~$10-15/month + usage

### Production Environment
- **Railway Pro Plan**: $20/month
- **PostgreSQL**: $10/month
- **Redis**: $10/month
- **Twilio**: ~$1-2/month + $0.0085/min for calls
- **Google Cloud TTS**: Volume pricing
- **OpenAI**: Volume pricing

**Total**: ~$40-50/month + usage

## 🛟 Troubleshooting

### Database Connection Issues
```bash
# Test database connection
railway run npx prisma db pull

# Reset database (⚠️ destructive)
railway run npx prisma migrate reset
```

### Twilio Webhook Not Working
1. Verify webhook URL is publicly accessible
2. Check Railway logs for incoming requests
3. Test with Twilio's webhook debugger
4. Ensure SSL certificate is valid

### Google Cloud TTS Errors
```bash
# Verify service account has permissions
gcloud projects get-iam-policy orchestrall-patientflow

# Test TTS API
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data '{"input":{"text":"Hello"},"voice":{"languageCode":"en-US","name":"en-US-Neural2-F"},"audioConfig":{"audioEncoding":"MP3"}}' \
  https://texttospeech.googleapis.com/v1/text:synthesize
```

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Google Cloud TTS](https://cloud.google.com/text-to-speech)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)

## 🎉 Next Steps

Once deployment is complete:

1. Review [Demo Scenarios](./demo-scenarios.md) for testing workflows
2. Review [Runbook](./runbook.md) for operations procedures
3. Configure monitoring and alerts
4. Set up automated backups
5. Train your team on the demo scenarios

---

**✅ Deployment Complete!** Your PatientFlow system is now live and ready for demos.
