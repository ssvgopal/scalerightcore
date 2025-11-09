# PatientFlow Environment Configuration Guide

This document describes the environment variables required for PatientFlow services in Railway deployment.

## Overview

PatientFlow adds AI-powered voice and messaging capabilities to the Orchestrall platform. The configuration includes:

- **AI Providers**: OpenAI (Whisper), Claude (Anthropic)
- **Communication Channels**: Twilio (WhatsApp, Voice, SMS)
- **Text-to-Speech**: Google Cloud TTS
- **Session Management**: TTL configuration and phone allowlisting

## Environment Variables

### AI Provider Configuration

#### Primary AI Provider Selector
```bash
PATIENTFLOW_AI_PROVIDER=openai          # Options: openai, claude
OPENAI_WHISPER_MODEL=whisper-1          # Speech-to-text model
CLAUDE_API_KEY=sk-ant-...               # Required if PATIENTFLOW_AI_PROVIDER=claude
```

### Twilio Configuration (Required for Voice/SMS)

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+1234567890      # Twilio WhatsApp-enabled number
TWILIO_VOICE_NUMBER=+1234567890         # Twilio voice-enabled number
TWILIO_WEBHOOK_SECRET=webhook_secret    # For securing webhook callbacks
```

**Important**: Both numbers should be verified and enabled in Twilio console.

### Google Cloud Text-to-Speech Configuration

The application supports two methods for Google Cloud credentials:

#### Method 1: Individual Credentials (Recommended for Cloud Deployment)
```bash
GOOGLE_TTS_PROJECT_ID=my-project-id
GOOGLE_TTS_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_TTS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQ...
```

**Note**: When setting `GOOGLE_TTS_PRIVATE_KEY` in Railway:
- Copy the entire private key from the service account JSON
- Include the `\n` newlines as-is (the system handles escape sequences)
- Alternative: Use Method 2 below

#### Method 2: JSON Credentials (Recommended for Docker/Local)
```bash
GOOGLE_TTS_CREDENTIALS_JSON={"type":"service_account","project_id":"my-project-id",...}
```

**Usage in Docker**:
- The bootstrap script automatically detects this variable
- Credentials are written to `/tmp/gcp-credentials/service-account.json`
- `GOOGLE_APPLICATION_CREDENTIALS` is set automatically

### Session and Demo Configuration

```bash
PATIENTFLOW_SESSION_TTL=3600            # Session timeout in seconds (default: 1 hour)
DEMO_PHONE_ALLOWLIST=+1234567890,+0987654321  # Comma-separated phone numbers
```

## Railway Deployment Setup

### Step 1: Create Twilio Credentials

1. Sign up or log in to [Twilio Console](https://www.twilio.com/console)
2. Navigate to **Account Settings** → **API Credentials**
3. Copy `Account SID` and `Auth Token`
4. Navigate to **Phone Numbers** → **Manage Numbers**
5. Verify/purchase phone numbers for WhatsApp and Voice

### Step 2: Create Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Cloud Text-to-Speech API**
4. Create a Service Account:
   - Go to **Service Accounts**
   - Click **Create Service Account**
   - Grant `Editor` role (or minimum `Cloud Text-to-Speech Client`)
5. Create and download JSON key file
6. Extract credentials from JSON:
   ```json
   {
     "project_id": "...",
     "private_key": "...",
     "client_email": "..."
   }
   ```

### Step 3: Add to Railway Dashboard

1. Go to Railway project settings
2. Add the following environment variables:

**For Production** (using individual credentials):
```
PATIENTFLOW_AI_PROVIDER=openai
OPENAI_WHISPER_MODEL=whisper-1
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+1...
TWILIO_VOICE_NUMBER=+1...
TWILIO_WEBHOOK_SECRET=...
GOOGLE_TTS_PROJECT_ID=...
GOOGLE_TTS_CLIENT_EMAIL=...
GOOGLE_TTS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMII...
PATIENTFLOW_SESSION_TTL=3600
DEMO_PHONE_ALLOWLIST=+1234567890
```

**Alternative: Using JSON Credentials**:
```
GOOGLE_TTS_CREDENTIALS_JSON={"type":"service_account",...}
```

### Step 4: Set Required API Keys

Ensure these are also configured in Railway:
```bash
OPENAI_API_KEY=sk-...              # For Whisper API
# Optional if using Claude:
CLAUDE_API_KEY=sk-ant-...
```

## Service Plan Recommendations

### Integration Environment (Development)
- **Twilio**: Developer/Test account with test credentials
- **Google Cloud**: Free tier (300 hours TTS/month included)
- **Cost**: $0-15/month

### Staging Environment (Pre-production)
- **Twilio**: Production account, Hobby plan ($20-50/month)
- **Google Cloud**: Standard tier with quota limits
- **Cost**: $50-150/month

### Production Environment (Live)
- **Twilio**: Production account, Pro plan ($100+/month)
- **Google Cloud**: Standard tier with monitoring
- **Cost**: $200-500+/month (includes concurrent call capacity)

## Configuration Validation

The application validates PatientFlow configuration at startup:

### Production Mode Warnings
```
⚠️ Missing PatientFlow configuration: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
```

### Required for Features
- **Whisper Transcription**: `OPENAI_WHISPER_MODEL`, `OPENAI_API_KEY`
- **Claude Integration**: `CLAUDE_API_KEY` (if `PATIENTFLOW_AI_PROVIDER=claude`)
- **WhatsApp Messaging**: `TWILIO_WHATSAPP_NUMBER`, `TWILIO_AUTH_TOKEN`
- **Voice Calls**: `TWILIO_VOICE_NUMBER`, `TWILIO_AUTH_TOKEN`
- **Text-to-Speech**: Either Method 1 or Method 2 Google credentials

## Secrets Handling Best Practices

### Railway-Specific

1. **Use Environment Variables**: Never hardcode secrets in docker/configuration files
2. **Use Railway Secrets**: Store sensitive keys in Railway dashboard (not in code)
3. **Rotate Regularly**: Change API keys and tokens quarterly
4. **Audit Access**: Monitor who has access to sensitive keys

### Docker/Local Development

1. **Use .env.local**: Create a local `.env.local` file (gitignored)
2. **Use Docker Secrets** (if using Docker Swarm/Compose):
   ```yaml
   secrets:
     twilio_auth_token:
       external: true
   ```
3. **Use AWS Secrets Manager** (if deployed on AWS)
4. **Use GCP Secret Manager** (for Google credentials)

### Google Cloud Credentials

For the `GOOGLE_TTS_PRIVATE_KEY` environment variable:

1. **Railway UI**: Paste the entire private key including `-----BEGIN PRIVATE KEY-----` header
2. **CLI**: Escape newlines properly:
   ```bash
   railway env set GOOGLE_TTS_PRIVATE_KEY "$(cat key.json | jq -r '.private_key')"
   ```
3. **Docker**: Use the JSON method (`GOOGLE_TTS_CREDENTIALS_JSON`) for cleaner handling

## Troubleshooting

### "GOOGLE_APPLICATION_CREDENTIALS not set"
- The bootstrap script should set this automatically
- Check: `docker exec <container> echo $GOOGLE_APPLICATION_CREDENTIALS`
- Verify credentials file exists: `docker exec <container> ls -la /tmp/gcp-credentials/`

### "Twilio: Invalid Credentials"
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are correct
- Check they're from the same Twilio account
- Ensure numbers are verified and active

### "Whisper API timeout"
- Increase timeout in your API calls
- Check `OPENAI_API_KEY` is valid and has quota
- For large files, consider chunking/streaming

### "WhatsApp Message delivery failed"
- Verify `TWILIO_WHATSAPP_NUMBER` format: `+1234567890`
- Ensure number is WhatsApp-enabled in Twilio
- Check recipient opted in to WhatsApp messaging

## Docker Build Prerequisites

The Dockerfile includes required system dependencies:

```dockerfile
RUN apk add --no-cache libc6-compat sox ffmpeg
```

These enable:
- **sox**: Audio format conversion and processing
- **ffmpeg**: Media transcoding for Twilio playback
- **libc6-compat**: C library compatibility for Google Cloud client

## Example Configuration Files

### Development (.env.local)
```bash
PATIENTFLOW_AI_PROVIDER=openai
OPENAI_WHISPER_MODEL=whisper-1
TWILIO_ACCOUNT_SID=AC_test_...
TWILIO_AUTH_TOKEN=test_token
TWILIO_WHATSAPP_NUMBER=+1234567890
TWILIO_VOICE_NUMBER=+1234567890
GOOGLE_TTS_CREDENTIALS_JSON={"type":"service_account","project_id":"dev-project",...}
PATIENTFLOW_SESSION_TTL=3600
DEMO_PHONE_ALLOWLIST=+1234567890,+9876543210
```

### Production (Railway environment)
```
PATIENTFLOW_AI_PROVIDER=openai
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+1234567890
TWILIO_VOICE_NUMBER=+1234567890
TWILIO_WEBHOOK_SECRET=...
GOOGLE_TTS_PROJECT_ID=prod-project
GOOGLE_TTS_CLIENT_EMAIL=service-account@prod-project.iam.gserviceaccount.com
GOOGLE_TTS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQ...
PATIENTFLOW_SESSION_TTL=3600
DEMO_PHONE_ALLOWLIST=+1234567890
```

## References

- [Twilio Documentation](https://www.twilio.com/docs/)
- [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech/docs)
- [OpenAI Whisper API](https://openai.com/research/whisper)
- [Anthropic Claude API](https://www.anthropic.com/product)
- [Railway Documentation](https://docs.railway.app/)
