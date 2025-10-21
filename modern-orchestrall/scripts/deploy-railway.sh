#!/bin/bash

echo "🚀 Deploying Modern Orchestrall Platform to Railway.app"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Create new project or link to existing
echo "📦 Setting up Railway project..."
railway link

# Set environment variables
echo "🔧 Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set API_VERSION=v2
railway variables set LOG_LEVEL=info

# Database variables
railway variables set DATABASE_URL=$DATABASE_URL
railway variables set DATABASE_POOL_SIZE=20
railway variables set DATABASE_QUERY_TIMEOUT=30000

# Redis variables
railway variables set REDIS_HOST=$REDIS_HOST
railway variables set REDIS_PORT=$REDIS_PORT
railway variables set REDIS_PASSWORD=$REDIS_PASSWORD

# Security variables
railway variables set JWT_SECRET=$JWT_SECRET
railway variables set API_KEY_SECRET=$API_KEY_SECRET
railway variables set ENCRYPTION_KEY=$ENCRYPTION_KEY

# External API keys
railway variables set OPENAI_API_KEY=$OPENAI_API_KEY
railway variables set SARVAM_API_KEY=$SARVAM_API_KEY
railway variables set GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY
railway variables set OPENWEATHER_API_KEY=$OPENWEATHER_API_KEY

# Payment gateway
railway variables set RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID
railway variables set RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET

# SMS/Email services
railway variables set TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
railway variables set TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
railway variables set TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER

railway variables set SMTP_HOST=$SMTP_HOST
railway variables set SMTP_PORT=$SMTP_PORT
railway variables set SMTP_USER=$SMTP_USER
railway variables set SMTP_PASS=$SMTP_PASS

# Monitoring
railway variables set PROMETHEUS_ENABLED=true
railway variables set GRAFANA_ENABLED=true
railway variables set SENTRY_DSN=$SENTRY_DSN

# Backup configuration
railway variables set BACKUP_PATH=/app/backups
railway variables set BACKUP_RETENTION_DAYS=30
railway variables set BACKUP_COMPRESSION=true
railway variables set BACKUP_ENCRYPTION=true
railway variables set BACKUP_ENCRYPTION_KEY=$BACKUP_ENCRYPTION_KEY

# Performance configuration
railway variables set CACHE_TTL=300
railway variables set CACHE_CHECK_PERIOD=120
railway variables set ENABLE_QUERY_LOGGING=false
railway variables set ENABLE_SLOW_QUERY_LOGGING=true
railway variables set SLOW_QUERY_THRESHOLD=1000

# Multi-tenancy
railway variables set TENANT_ISOLATION_MODE=schema
railway variables set DEFAULT_TENANT_TIER=starter

# Internationalization
railway variables set DEFAULT_LANGUAGE=en
railway variables set SUPPORTED_LANGUAGES=en,hi,te,ta

# Feature flags
railway variables set ENABLE_VOICE_INTEGRATION=true
railway variables set ENABLE_MULTI_TENANCY=true
railway variables set ENABLE_BACKUP_RECOVERY=true
railway variables set ENABLE_PERFORMANCE_OPTIMIZATION=true
railway variables set ENABLE_INTERNATIONALIZATION=true

# Deploy the application
echo "🚀 Deploying application..."
railway up

echo "✅ Deployment completed!"
echo "🌐 Your application is now live at:"
railway domain
