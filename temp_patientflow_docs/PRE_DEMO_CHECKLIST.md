# PatientFlow Pre-Demo Validation Checklist

## 📋 Overview

This checklist ensures your PatientFlow demo environment is fully configured and ready for a successful demonstration. Complete all items at least 1 hour before your scheduled demo.

---

## ✅ System Deployment

### Railway Environment

- [ ] **Railway project is active**
  ```bash
  railway status
  # Expected: Service is running
  ```

- [ ] **Health endpoint returns 200**
  ```bash
  curl -v https://your-railway-app.railway.app/health
  # Expected: HTTP 200 OK
  ```

- [ ] **Environment variables are set**
  ```bash
  railway variables list | grep -E "TWILIO|GOOGLE|OPENAI"
  # Verify all required variables are present
  ```

- [ ] **No recent deployment errors**
  ```bash
  railway logs --tail 50 | grep -i error
  # Should be empty or only minor warnings
  ```

---

## 🗄️ Database Configuration

### Migrations

- [ ] **All migrations are applied**
  ```bash
  railway run npx prisma migrate status
  # Expected: All migrations applied
  ```

- [ ] **Database connection is working**
  ```bash
  railway run npx prisma db pull
  # Expected: Schema successfully pulled
  ```

### Seed Data

- [ ] **Demo organization exists**
  ```bash
  curl https://your-railway-app.railway.app/api/patientflow/organizations/org_demo_clinic
  # Expected: Organization details returned
  ```

- [ ] **At least 2 doctors are seeded**
  ```bash
  curl https://your-railway-app.railway.app/api/patientflow/doctors \
    -H "X-Organization-ID: org_demo_clinic"
  # Expected: Array with 2+ doctors
  ```

- [ ] **Clinic branches are configured**
  ```bash
  curl https://your-railway-app.railway.app/api/patientflow/branches \
    -H "X-Organization-ID: org_demo_clinic"
  # Expected: At least 1 branch with operating hours
  ```

- [ ] **Doctor schedules are set up**
  ```bash
  railway run npx prisma studio
  # Verify DoctorSchedule table has entries for demo doctors
  ```

---

## 📞 Twilio Configuration

### Account Setup

- [ ] **Twilio account is active**
  - Login: https://console.twilio.com
  - Verify account status is "Active"
  - Check available credit: $10+ recommended

- [ ] **Phone number is active**
  ```bash
  curl -X GET "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json" \
    -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}"
  # Expected: Active phone number in response
  ```

- [ ] **Phone number capabilities enabled**
  - Voice: ✅ Enabled
  - SMS: ✅ Enabled
  - WhatsApp: ✅ Configured (sandbox or approved)

### Webhook Configuration

- [ ] **Voice webhook URL is correct**
  - Go to: Phone Numbers → Active Numbers → [Your Number]
  - Voice: `https://your-railway-app.railway.app/api/voice/incoming`
  - Method: POST
  - Click "Save"

- [ ] **Voice webhook is reachable**
  ```bash
  curl -X POST https://your-railway-app.railway.app/api/voice/incoming \
    -d "CallSid=TEST123" \
    -d "From=+15555551234" \
    -d "To=+15555555678"
  # Expected: TwiML response (200 OK)
  ```

- [ ] **SMS webhook URL is correct** (if using SMS)
  - SMS: `https://your-railway-app.railway.app/api/sms/incoming`
  - Method: POST

- [ ] **Status callback URL is set**
  - Status: `https://your-railway-app.railway.app/api/voice/status`
  - Method: POST

### WhatsApp Configuration

- [ ] **WhatsApp sandbox is active** (for development)
  - Go to: Messaging → Try it out → WhatsApp
  - Sandbox status: Active
  - Join code sent to demo phone

- [ ] **WhatsApp webhook is configured**
  - Webhook: `https://your-railway-app.railway.app/api/whatsapp/incoming`
  - Method: POST
  - Click "Save"

- [ ] **WhatsApp webhook is reachable**
  ```bash
  curl -X POST https://your-railway-app.railway.app/api/whatsapp/incoming \
    -d "From=whatsapp:+15555551234" \
    -d "Body=Test message"
  # Expected: 200 OK
  ```

- [ ] **Demo phone has joined sandbox** (for development)
  - Send join code to Twilio WhatsApp number
  - Verify confirmation message received

---

## ☁️ Google Cloud Configuration

### Project Setup

- [ ] **Google Cloud project is active**
  ```bash
  gcloud projects describe your-project-id
  # Expected: Project details returned
  ```

- [ ] **Text-to-Speech API is enabled**
  ```bash
  gcloud services list --enabled | grep texttospeech
  # Expected: texttospeech.googleapis.com listed
  ```

### Service Account

- [ ] **Service account exists**
  ```bash
  gcloud iam service-accounts list | grep patientflow
  # Expected: patientflow-tts-service@...
  ```

- [ ] **Service account has correct permissions**
  ```bash
  gcloud projects get-iam-policy your-project-id \
    --flatten="bindings[].members" \
    --filter="bindings.members:patientflow-tts-service@*"
  # Expected: roles/cloudtexttospeech.user
  ```

- [ ] **Service account key is valid**
  ```bash
  # Test TTS API with service account
  curl -X POST \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "Content-Type: application/json" \
    --data '{"input":{"text":"Test"},"voice":{"languageCode":"en-US","name":"en-US-Neural2-F"},"audioConfig":{"audioEncoding":"MP3"}}' \
    https://texttospeech.googleapis.com/v1/text:synthesize
  # Expected: 200 OK with audio content
  ```

- [ ] **Credentials are in Railway environment**
  ```bash
  railway variables get GOOGLE_APPLICATION_CREDENTIALS
  # OR
  railway variables get GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
  # Expected: Value is set
  ```

---

## 🤖 OpenAI Configuration

- [ ] **API key is valid**
  ```bash
  curl https://api.openai.com/v1/models \
    -H "Authorization: Bearer ${OPENAI_API_KEY}"
  # Expected: List of available models
  ```

- [ ] **API key has sufficient credits**
  - Login: https://platform.openai.com/account/billing
  - Verify: Credits > $5.00
  - Check usage limits not exceeded

- [ ] **Correct model is configured**
  ```bash
  railway variables get OPENAI_MODEL
  # Expected: gpt-4-turbo-preview or gpt-3.5-turbo
  ```

- [ ] **API rate limits are not exceeded**
  - Check: https://platform.openai.com/account/rate-limits
  - Verify: No rate limit warnings

---

## 🔄 Redis Cache

- [ ] **Redis connection is working**
  ```bash
  curl https://your-railway-app.railway.app/health/redis
  # Expected: {"status": "connected"}
  ```

- [ ] **TTS cache is pre-warmed** (optional but recommended)
  ```bash
  railway run node scripts/warm-tts-cache.js
  # Expected: Common phrases cached
  ```

- [ ] **Cache hit rate is healthy** (if pre-warmed)
  ```bash
  railway run redis-cli --url $REDIS_URL INFO stats | grep keyspace
  # Expected: Hit rate > 80%
  ```

---

## 🧪 Functional Testing

### API Endpoints

- [ ] **Book appointment via API works**
  ```bash
  curl -X POST https://your-railway-app.railway.app/api/patientflow/appointments \
    -H "Content-Type: application/json" \
    -H "X-Organization-ID: org_demo_clinic" \
    -d '{
      "patientPhone": "+15555559999",
      "patientFirstName": "Test",
      "patientLastName": "User",
      "patientEmail": "test@example.com",
      "doctorId": "doc_123",
      "startTime": "2024-01-25T10:00:00Z",
      "endTime": "2024-01-25T10:30:00Z",
      "source": "MANUAL"
    }'
  # Expected: 201 Created with appointment details
  ```

- [ ] **Get doctors list works**
  ```bash
  curl https://your-railway-app.railway.app/api/patientflow/doctors \
    -H "X-Organization-ID: org_demo_clinic"
  # Expected: Array of doctors
  ```

- [ ] **Check doctor availability works**
  ```bash
  curl "https://your-railway-app.railway.app/api/patientflow/doctors/doc_123/availability?date=2024-01-25" \
    -H "X-Organization-ID: org_demo_clinic"
  # Expected: Available time slots
  ```

### Voice Call Flow

- [ ] **Test call connects successfully**
  - Call Twilio number from demo phone
  - Verify: IVR greeting plays
  - Hang up after greeting

- [ ] **Call is logged in database**
  ```bash
  railway run npx prisma studio
  # Check PatientCallLog table for recent entry
  ```

- [ ] **Call webhook logs show no errors**
  ```bash
  railway logs --filter "voice" --tail 20
  # Should show successful webhook processing
  ```

### WhatsApp Flow

- [ ] **Test WhatsApp message is received**
  - Send "Hi" to Twilio WhatsApp number
  - Verify: Bot responds with greeting

- [ ] **Message is logged in database**
  ```bash
  railway run npx prisma studio
  # Check PatientMessageLog table for recent entry
  ```

- [ ] **WhatsApp webhook logs show no errors**
  ```bash
  railway logs --filter "whatsapp" --tail 20
  # Should show successful message processing
  ```

---

## 📱 Demo Device Preparation

### Physical Setup

- [ ] **Demo phone is charged** (>80% battery)
- [ ] **Demo phone has stable internet** (WiFi or 4G/5G)
- [ ] **WhatsApp is installed and logged in**
- [ ] **Twilio WhatsApp number is saved in contacts**
- [ ] **Phone volume is appropriate** (test in demo space)
- [ ] **Phone screen recording is ready** (optional, for backup)

### Test Numbers

- [ ] **Known patient test number configured**
  - Number: +1-555-0100
  - Patient exists in database
  - Has preferences set

- [ ] **Unknown caller test number ready**
  - Number: +1-555-0999
  - NOT in database (for new patient demo)

- [ ] **WhatsApp test number ready**
  - Has joined Twilio sandbox
  - Can send/receive messages

---

## 📊 Monitoring & Alerts

- [ ] **Railway monitoring dashboard is accessible**
  - URL: https://railway.app/project/[your-project-id]
  - Can view metrics and logs

- [ ] **Alert thresholds are configured**
  - CPU > 80%
  - Memory > 80%
  - Error rate > 5%

- [ ] **Logs are flowing correctly**
  ```bash
  railway logs --follow
  # Should show real-time logs
  ```

---

## 📝 Documentation & Materials

- [ ] **Demo script is printed/accessible**
  - [Demo Scenarios](./demo-scenarios.md) document ready
  - Key scenarios bookmarked

- [ ] **API examples are ready**
  - curl commands tested and working
  - Postman collection exported (if using)

- [ ] **Troubleshooting guide is accessible**
  - [Operations Runbook](./runbook.md) bookmarked
  - Emergency contacts list ready

- [ ] **Architecture diagram is prepared**
  - Slide deck with PatientFlow architecture
  - Explanation of data flow ready

---

## 🎭 Demo Scenario Validation

Run through each scenario at least once:

### Scenario 1: Voice Call - Unknown Caller

- [ ] **Call connects and IVR greeting plays**
- [ ] **AI collects: First name, last name, DOB, email**
- [ ] **Available doctors are listed**
- [ ] **Appointment is successfully booked**
- [ ] **Confirmation is provided**
- [ ] **SMS confirmation is sent** (verify on test phone)

### Scenario 2: WhatsApp - Known Patient

- [ ] **WhatsApp message is received by bot**
- [ ] **Bot identifies returning patient**
- [ ] **Bot offers time slots based on preferences**
- [ ] **Appointment is booked successfully**
- [ ] **Confirmation message is sent**

### Scenario 3: Rescheduling

- [ ] **Existing appointment is found**
- [ ] **New time slots are offered**
- [ ] **Appointment is rescheduled**
- [ ] **Old appointment is cancelled in database**
- [ ] **New appointment confirmation is sent**

---

## 💰 Cost & Credit Limits

- [ ] **Railway credit balance checked**
  - Balance: $XX.XX
  - Sufficient for demo + 1 day buffer

- [ ] **Twilio credit balance checked**
  - Balance: $XX.XX
  - Minimum: $10.00 recommended

- [ ] **Google Cloud billing is enabled**
  - Billing account active
  - No spending limits hit

- [ ] **OpenAI credit balance checked**
  - Balance: $XX.XX
  - Minimum: $5.00 recommended

---

## 🔐 Security & Access

- [ ] **Demo uses test/sandbox credentials only**
  - No production patient data
  - Test phone numbers only

- [ ] **HIPAA compliance noted** (if discussing)
  - Explain data encryption
  - Explain PHI handling

- [ ] **API keys are not exposed**
  - No .env files in slides
  - Credentials redacted in screenshots

---

## ⏰ Timing

### 1 Day Before Demo

- [ ] Complete full checklist
- [ ] Run through all scenarios
- [ ] Pre-warm TTS cache
- [ ] Verify all credits/balances

### 1 Hour Before Demo

- [ ] Run quick health checks
- [ ] Test voice call (1 quick test)
- [ ] Test WhatsApp (1 quick message)
- [ ] Verify logs are clean

### 15 Minutes Before Demo

- [ ] Charge demo phone
- [ ] Open Railway dashboard
- [ ] Open demo script
- [ ] Test demo room audio/projection
- [ ] Clear any test data from previous runs

---

## 🚨 Emergency Procedures

### If Voice Calls Fail

1. Check Railway logs: `railway logs --filter "voice" --tail 50`
2. Verify Twilio webhook URL is correct
3. Test webhook manually with curl
4. Fall back to WhatsApp demo if needed

### If WhatsApp Fails

1. Verify sandbox is still active
2. Check demo phone has joined sandbox
3. Test webhook with curl
4. Fall back to API demo with curl if needed

### If Database Connection Lost

1. Check Railway database status
2. Restart Railway service: `railway restart`
3. Fall back to architecture/slide demo if needed

### If Demo Environment Completely Down

1. Switch to backup environment (staging)
2. Use recorded video demo as backup
3. Walk through architecture slides
4. Show screenshots of previous successful demos

---

## ✅ Final Sign-Off

**Demo Environment**: _________________ (integration/staging/production)

**Date**: _________________

**Time**: _________________

**Validated By**: _________________

**Signature**: _________________

---

## 📞 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| On-Call Engineer | ____________ | +1-555-ONCALL |
| Demo Lead | ____________ | +1-555-DEMO |
| Technical Support | ____________ | Slack: #demo-support |

---

**🎬 You're ready to demo!** Good luck! 🚀
