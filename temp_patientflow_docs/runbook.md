# PatientFlow Operations Runbook

## 📋 Overview

This runbook provides operational procedures for monitoring, troubleshooting, and maintaining the PatientFlow system in production. It's designed for DevOps engineers, SREs, and technical support teams managing the platform.

## 🎯 Quick Reference

| Issue | Page | Severity |
|-------|------|----------|
| Service Down | [Service Outage](#service-outage) | 🔴 Critical |
| Twilio Webhooks Failing | [Webhook Issues](#twilio-webhook-troubleshooting) | 🟠 High |
| Database Connection Lost | [Database Issues](#database-connection-issues) | 🔴 Critical |
| TTS Audio Cache Full | [Cache Management](#regenerating-tts-audio-cache) | 🟡 Medium |
| High API Latency | [Performance Issues](#performance-degradation) | 🟠 High |
| Appointment Not Created | [Booking Failures](#appointment-booking-failures) | 🟠 High |

---

## 📊 Monitoring & Alerts

### Health Check Endpoints

#### Basic Health Check
```bash
curl https://your-railway-app.railway.app/health

# Expected Response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 86400,
  "version": "1.0.0"
}
```

#### Database Health Check
```bash
curl https://your-railway-app.railway.app/health/database

# Expected Response:
{
  "status": "connected",
  "latency": "12ms",
  "connections": {
    "active": 5,
    "idle": 10,
    "total": 15
  }
}
```

#### Redis Health Check
```bash
curl https://your-railway-app.railway.app/health/redis

# Expected Response:
{
  "status": "connected",
  "latency": "3ms",
  "memory": "15.2MB",
  "keys": 234
}
```

#### Full System Health
```bash
curl https://your-railway-app.railway.app/health/full

# Expected Response:
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "twilio": "ok",
    "google_tts": "ok",
    "openai": "ok"
  },
  "metrics": {
    "response_time_p95": "245ms",
    "error_rate": "0.02%",
    "active_sessions": 12
  }
}
```

### Monitoring Dashboards

#### Railway Dashboard
- **URL**: https://railway.app/project/[your-project-id]
- **Metrics**:
  - CPU usage (target: <70%)
  - Memory usage (target: <80%)
  - Response time (target: <500ms p95)
  - Error rate (target: <1%)
  - Request count (throughput)

#### Custom Metrics Endpoint
```bash
curl https://your-railway-app.railway.app/metrics

# Prometheus-format metrics
# Include: request counts, latencies, error rates, queue depths
```

### Alert Configuration

#### Critical Alerts (Page On-Call)

1. **Service Down**
   - Condition: `/health` returns non-200 status for 2+ minutes
   - Action: Page on-call engineer immediately

2. **Database Connection Lost**
   - Condition: Database health check fails for 1+ minute
   - Action: Page on-call + database team

3. **Error Rate Spike**
   - Condition: Error rate >5% for 5+ minutes
   - Action: Page on-call engineer

#### High Priority Alerts (Slack/Email)

1. **High API Latency**
   - Condition: p95 response time >2s for 10+ minutes
   - Action: Notify on-call via Slack

2. **Twilio Webhook Failures**
   - Condition: >10 webhook failures in 5 minutes
   - Action: Notify on-call via Slack

3. **Memory Usage High**
   - Condition: Memory >85% for 15+ minutes
   - Action: Notify DevOps team

#### Medium Priority Alerts (Email Only)

1. **TTS Cache Miss Rate High**
   - Condition: Cache miss rate >20% for 1 hour
   - Action: Email ops team

2. **Appointment Booking Slowdown**
   - Condition: Average booking time >5 minutes
   - Action: Email product team

### Setting Up Alerts in Railway

```bash
# Railway CLI alert configuration
railway environment alerts create \
  --name "Service Down" \
  --type "service_health" \
  --threshold "DOWN" \
  --duration "2m" \
  --channel "slack"

railway environment alerts create \
  --name "High CPU" \
  --type "cpu_usage" \
  --threshold "80" \
  --duration "10m" \
  --channel "email"
```

---

## 🚨 Common Issues & Troubleshooting

### Service Outage

**Symptoms:**
- `/health` endpoint returns 500 or times out
- Users cannot make calls or send WhatsApp messages
- Railway dashboard shows service as "crashed"

**Diagnostic Steps:**

1. **Check Railway logs:**
```bash
railway logs --tail 100
```

2. **Check for recent deployments:**
```bash
railway deployments list
```

3. **Check environment variables:**
```bash
railway variables list
```

**Resolution:**

**Option 1: Restart Service**
```bash
railway restart
```

**Option 2: Rollback to Previous Deployment**
```bash
# List recent deployments
railway deployments list

# Rollback to specific deployment
railway rollback [deployment-id]
```

**Option 3: Manual Recovery**
```bash
# SSH into Railway service (if available)
railway run bash

# Check process status
ps aux | grep node

# Check disk space
df -h

# Check memory
free -m

# Restart manually
pkill node && npm start
```

**Post-Resolution:**
- Document root cause in incident log
- Add monitoring if issue was missed
- Review recent code changes

---

### Twilio Webhook Troubleshooting

**Symptoms:**
- Incoming calls/messages not triggering webhooks
- Twilio console shows webhook errors
- Patients report calls dropping or not connecting

**Diagnostic Steps:**

1. **Check Twilio Console:**
   - Go to https://console.twilio.com
   - Monitor → Logs → Errors
   - Look for webhook failures (11200, 11205, 11206)

2. **Test Webhook Endpoint:**
```bash
# Test voice webhook
curl -X POST https://your-railway-app.railway.app/api/voice/incoming \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=CAtest123" \
  -d "From=+15555551234" \
  -d "To=+15555555678" \
  -d "CallStatus=ringing"

# Expected: 200 OK with TwiML response
```

3. **Check Railway logs for webhook requests:**
```bash
railway logs --filter "webhook" --tail 50
```

**Common Issues & Fixes:**

#### Issue: Webhook Timeout (Error 11200)

**Cause:** Webhook response taking >15 seconds

**Fix:**
1. Check database query performance:
```bash
railway run npx prisma studio
# Review slow query log
```

2. Check OpenAI API latency:
```bash
# Add request timeout to OpenAI calls
railway variables set OPENAI_TIMEOUT=10000
```

3. Optimize webhook response:
```javascript
// Return TwiML immediately, process async
// In webhook handler: respond first, then update database
```

#### Issue: Webhook 404 (Error 11205)

**Cause:** Webhook URL incorrect or service not responding

**Fix:**
1. Verify webhook URL in Twilio console matches Railway URL
2. Check Railway service is running:
```bash
railway status
```

3. Update webhook URL:
```bash
# Via Twilio CLI
twilio phone-numbers:update +15555555678 \
  --voice-url https://your-railway-app.railway.app/api/voice/incoming
```

#### Issue: Webhook SSL Error (Error 11206)

**Cause:** SSL certificate invalid or expired

**Fix:**
1. Railway handles SSL automatically, but verify:
```bash
curl -vI https://your-railway-app.railway.app/health
# Check for SSL handshake errors
```

2. If using custom domain, verify DNS:
```bash
dig your-domain.com
# Should point to Railway CNAME
```

#### Issue: Webhook Receiving Wrong Data

**Cause:** Twilio webhook signature validation failing

**Fix:**
1. Verify `TWILIO_AUTH_TOKEN` environment variable:
```bash
railway variables get TWILIO_AUTH_TOKEN
```

2. Add webhook signature validation:
```javascript
const twilio = require('twilio');

// In webhook handler
const isValid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN,
  signature,
  url,
  params
);

if (!isValid) {
  return reply.code(403).send('Invalid signature');
}
```

**Monitoring Webhook Health:**

```bash
# Create monitoring script
cat > monitor-webhooks.sh << 'EOF'
#!/bin/bash
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    https://your-railway-app.railway.app/api/webhook-health)
  
  if [ "$STATUS" != "200" ]; then
    echo "$(date): Webhook health check failed: $STATUS"
    # Send alert
  fi
  
  sleep 60
done
EOF

chmod +x monitor-webhooks.sh
./monitor-webhooks.sh &
```

---

### Regenerating TTS Audio Cache

**Purpose:** Google Cloud Text-to-Speech API calls are cached to reduce latency and costs. Occasionally, cache needs to be regenerated (e.g., voice updated, text changed, cache corruption).

**When to Regenerate:**
- TTS voice sounds incorrect or garbled
- Cache miss rate is unexpectedly high
- After updating TTS configuration (voice, speed, pitch)
- After system migration or Redis reset

**Cache Structure:**

```
Redis Key Format:
tts:cache:{text_hash}:{voice}:{language}

Example:
tts:cache:a3f8b2c1:en-US-Neural2-F:en-US

Value: Base64-encoded MP3 audio
TTL: 7 days (configurable)
```

**Diagnostic Steps:**

1. **Check cache hit rate:**
```bash
railway run node -e "
  const redis = require('redis');
  const client = redis.createClient(process.env.REDIS_URL);
  
  client.info('stats', (err, stats) => {
    console.log(stats);
    // Look for keyspace_hits vs keyspace_misses
  });
"
```

2. **Check cache size:**
```bash
railway run redis-cli --url $REDIS_URL
> INFO memory
> DBSIZE
> KEYS tts:cache:* | wc -l
```

3. **Check sample cache entry:**
```bash
railway run redis-cli --url $REDIS_URL
> GET "tts:cache:sample_key"
> TTL "tts:cache:sample_key"
```

**Cache Regeneration Procedures:**

#### Full Cache Clear (⚠️ Use with Caution)

```bash
# Clear all TTS cache entries
railway run redis-cli --url $REDIS_URL
> KEYS "tts:cache:*" | xargs redis-cli --url $REDIS_URL DEL

# Or via script:
railway run node scripts/clear-tts-cache.js
```

#### Selective Cache Clear

```bash
# Clear cache for specific voice
railway run redis-cli --url $REDIS_URL
> KEYS "tts:cache:*:en-US-Neural2-F:*" | xargs redis-cli --url $REDIS_URL DEL

# Clear cache for specific phrase
railway run node -e "
  const crypto = require('crypto');
  const text = 'Welcome to Demo Healthcare Clinic';
  const hash = crypto.createHash('md5').update(text).digest('hex');
  console.log('Clearing cache for hash:', hash);
  // Delete keys matching hash
"
```

#### Pre-Warm Cache (Recommended)

```bash
# Generate cache for common phrases before production
railway run node scripts/warm-tts-cache.js

# Script contents:
const commonPhrases = [
  "Welcome to Demo Healthcare Clinic",
  "Please select from the following options",
  "Your appointment is confirmed",
  // ... more common phrases
];

for (const phrase of commonPhrases) {
  await generateAndCacheTTS(phrase);
}
```

**Cache Warming Script Example:**

```javascript
// scripts/warm-tts-cache.js
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const redis = require('redis');
const crypto = require('crypto');

const ttsClient = new TextToSpeechClient();
const redisClient = redis.createClient(process.env.REDIS_URL);

const COMMON_PHRASES = [
  'Welcome to Demo Healthcare Clinic',
  'Thank you for calling',
  'Please hold while I check availability',
  'Your appointment is confirmed',
  'Is there anything else I can help you with?',
  // Add more common phrases
];

const VOICES = [
  { languageCode: 'en-US', name: 'en-US-Neural2-F' },
  { languageCode: 'en-US', name: 'en-US-Neural2-D' },
];

async function warmCache() {
  console.log('🔥 Warming TTS cache...');
  
  for (const phrase of COMMON_PHRASES) {
    for (const voice of VOICES) {
      const hash = crypto.createHash('md5').update(phrase).digest('hex');
      const cacheKey = `tts:cache:${hash}:${voice.name}:${voice.languageCode}`;
      
      // Check if already cached
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Already cached: ${phrase.substring(0, 50)}`);
        continue;
      }
      
      // Generate TTS
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text: phrase },
        voice: voice,
        audioConfig: { audioEncoding: 'MP3' },
      });
      
      // Cache for 7 days
      await redisClient.setEx(
        cacheKey,
        7 * 24 * 60 * 60,
        response.audioContent.toString('base64')
      );
      
      console.log(`✅ Cached: ${phrase.substring(0, 50)}`);
    }
  }
  
  console.log('🎉 Cache warming complete!');
}

warmCache()
  .catch(console.error)
  .finally(() => redisClient.quit());
```

**Run Cache Warming:**

```bash
# Before production deployment
railway run node scripts/warm-tts-cache.js

# Schedule regular cache warming (cron job)
# Add to package.json scripts:
"cache:warm": "node scripts/warm-tts-cache.js"

# Add to Railway cron (if supported):
railway cron add "0 2 * * *" "npm run cache:warm"
```

**Monitor Cache Performance:**

```bash
# Create cache monitoring dashboard
railway run node -e "
  setInterval(async () => {
    const hitRate = await getCacheHitRate();
    const size = await getCacheSize();
    
    console.log('TTS Cache Metrics:', {
      hitRate: hitRate + '%',
      size: size + ' MB',
      entries: await getCacheEntryCount(),
      oldestEntry: await getOldestCacheEntry(),
    });
  }, 60000);
"
```

**Cache Optimization Tips:**

1. **Increase TTL for common phrases:**
```javascript
// For phrases used in every call
await redisClient.setEx(cacheKey, 30 * 24 * 60 * 60, audio); // 30 days
```

2. **Implement cache preloading on startup:**
```javascript
// In app startup
await warmCache(COMMON_PHRASES);
console.log('✅ TTS cache preloaded');
```

3. **Monitor cache miss rate:**
```javascript
// Add metrics
const cacheMissRate = (misses / (hits + misses)) * 100;
if (cacheMissRate > 20) {
  console.warn('⚠️ High TTS cache miss rate:', cacheMissRate);
}
```

---

### Database Connection Issues

**Symptoms:**
- Prisma errors in logs
- API returns 500 errors
- "Connection pool exhausted" errors

**Diagnostic Steps:**

1. **Check database connection:**
```bash
railway run npx prisma db pull
```

2. **Check connection pool:**
```bash
railway run node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  prisma.\$queryRaw\`SELECT count(*) FROM pg_stat_activity\`
    .then(console.log)
    .catch(console.error);
"
```

3. **Check Railway database metrics:**
```bash
railway database metrics [database-id]
```

**Resolution:**

1. **Increase connection pool size:**
```bash
railway variables set DATABASE_URL="${DATABASE_URL}?connection_limit=20"
```

2. **Restart database connection:**
```bash
railway restart
```

3. **Check for long-running queries:**
```sql
-- Connect to database
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```

---

### Performance Degradation

**Symptoms:**
- Slow API response times (>2s p95)
- Users reporting delayed responses
- High CPU/memory usage

**Diagnostic Steps:**

1. **Check Railway metrics:**
```bash
railway metrics --service patientflow-api
```

2. **Profile slow endpoints:**
```bash
railway logs --filter "duration" --tail 100 | grep "slow"
```

3. **Check database query performance:**
```bash
railway run npx prisma studio
# Enable query logging in Prisma
```

**Resolution:**

1. **Optimize database queries:**
   - Add missing indexes
   - Use query pagination
   - Implement database read replicas

2. **Scale up Railway service:**
```bash
# Upgrade Railway plan for more resources
railway environment scale --replicas 2
```

3. **Enable caching:**
```bash
railway variables set CACHE_ENABLED=true
railway variables set CACHE_TTL=300
```

4. **Optimize OpenAI API calls:**
   - Reduce max_tokens
   - Use faster models (gpt-3.5-turbo)
   - Implement response streaming

---

### Appointment Booking Failures

**Symptoms:**
- User completes booking flow but appointment not created
- "Booking failed" errors in logs
- Appointments missing from database

**Diagnostic Steps:**

1. **Check recent booking logs:**
```bash
railway logs --filter "booking" --tail 50
```

2. **Query database for failed bookings:**
```bash
railway run npx prisma studio
# Check appointments table for records with error status
```

3. **Check appointment validation:**
```bash
# Test appointment creation manually
curl -X POST https://your-railway-app.railway.app/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "test-patient-id",
    "doctorId": "test-doctor-id",
    "startTime": "2024-01-20T10:00:00Z",
    "endTime": "2024-01-20T10:30:00Z"
  }'
```

**Common Causes & Fixes:**

1. **Doctor schedule not configured:**
```bash
railway run npx tsx scripts/fix-doctor-schedules.ts
```

2. **Time slot overlap:**
   - Check for existing appointments at same time
   - Implement better conflict detection

3. **Timezone issues:**
```bash
railway variables set TZ=America/Los_Angeles
```

4. **Database transaction rollback:**
   - Review transaction logs
   - Implement retry logic

---

## 🔄 Maintenance Procedures

### Database Backup & Restore

#### Manual Backup

```bash
# Backup database
railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Verify backup
ls -lh backup-*.sql
```

#### Manual Restore

```bash
# Restore from backup (⚠️ destructive)
railway run psql $DATABASE_URL < backup-20240115.sql
```

#### Automated Backups

Railway automatically backs up databases. To configure:

1. Go to Railway Dashboard → Database → Settings
2. Set backup retention: 7 days (recommended)
3. Enable point-in-time recovery

### Database Migration

```bash
# Create migration
railway run npx prisma migrate dev --name add_new_field

# Apply migration to production
railway run npx prisma migrate deploy

# Rollback migration (⚠️ manual)
# Edit migration files and reapply
```

### Log Rotation

```bash
# Railway handles log rotation automatically
# To download logs for archival:

railway logs --since 24h > logs-$(date +%Y%m%d).txt

# Compress and archive
gzip logs-*.txt
mv logs-*.txt.gz /archive/
```

### Security Updates

```bash
# Update dependencies
npm audit
npm audit fix

# Deploy security updates
git commit -am "Security updates"
git push origin main

# Verify deployment
railway status
```

---

## 📞 Escalation Procedures

### Incident Severity Levels

#### P0 - Critical (Response: Immediate)
- Service completely down
- Data loss or corruption
- Security breach

**Actions:**
1. Page on-call engineer immediately
2. Create incident channel in Slack
3. Notify CTO and engineering manager
4. Start incident log

#### P1 - High (Response: <30 minutes)
- Major feature broken (bookings, calls, WhatsApp)
- Database connection lost
- >50% error rate

**Actions:**
1. Notify on-call via Slack
2. Create incident ticket
3. Start troubleshooting

#### P2 - Medium (Response: <2 hours)
- Minor feature degradation
- High latency (but functional)
- Non-critical service down

**Actions:**
1. Create ticket
2. Assign to on-call engineer
3. Investigate during business hours

#### P3 - Low (Response: <1 day)
- Documentation issues
- Minor UI bugs
- Performance optimization

**Actions:**
1. Create ticket in backlog
2. Schedule for next sprint

### On-Call Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Primary On-Call | +1-555-ONCALL | Slack: @oncall |
| Secondary On-Call | +1-555-BACKUP | Slack: @backup |
| Engineering Manager | +1-555-MANAGER | Slack: @eng-manager |
| Database Admin | +1-555-DBA | Slack: @dba-team |
| CTO | +1-555-CTO | Slack: @cto |

### Incident Communication Template

```
🚨 INCIDENT ALERT

Severity: P1
Status: Investigating
Impact: Appointment bookings failing for 50% of users

Timeline:
- 14:05 UTC: Issue detected via monitoring
- 14:07 UTC: On-call paged
- 14:10 UTC: Investigation started

Current Actions:
- Checking Twilio webhook logs
- Reviewing database query performance
- Testing booking flow manually

Next Update: 14:30 UTC

Incident Commander: @engineer-name
```

---

## 📚 Reference Materials

### Quick Commands Cheatsheet

```bash
# Health checks
curl https://your-app.railway.app/health
curl https://your-app.railway.app/health/full

# Railway CLI
railway logs --tail 100
railway restart
railway status
railway variables list

# Database
railway run npx prisma studio
railway run npx prisma db pull
railway run npx prisma migrate deploy

# Redis
railway run redis-cli --url $REDIS_URL
> KEYS *
> MONITOR

# Twilio
twilio phone-numbers:list
twilio logs:list
```

### Log Analysis Commands

```bash
# Find errors
railway logs --filter "error" --tail 100

# Find slow requests
railway logs --filter "duration" | grep "slow"

# Find webhook failures
railway logs --filter "webhook" --filter "failed"

# Real-time monitoring
railway logs --follow
```

### Database Query Helpers

```sql
-- Active appointments today
SELECT * FROM appointments
WHERE start_time::date = CURRENT_DATE
AND status IN ('BOOKED', 'CONFIRMED');

-- Recent call logs
SELECT * FROM patient_call_logs
ORDER BY created_at DESC
LIMIT 10;

-- Patient with most appointments
SELECT patient_id, COUNT(*) as appointment_count
FROM appointments
GROUP BY patient_id
ORDER BY appointment_count DESC
LIMIT 10;

-- Average booking duration
SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
FROM appointments
WHERE status = 'BOOKED'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## 🎓 Training & Onboarding

### New Team Member Checklist

- [ ] Railway access granted
- [ ] Twilio console access
- [ ] Google Cloud project access
- [ ] Slack channels joined (#patientflow, #oncall)
- [ ] Read this runbook
- [ ] Complete hands-on exercises
- [ ] Shadow on-call engineer for 1 week
- [ ] Review incident post-mortems

### Hands-On Exercises

1. **Exercise 1: Deploy Code Change**
   - Make a minor code change
   - Deploy to staging
   - Verify health checks
   - Monitor logs

2. **Exercise 2: Troubleshoot Webhook**
   - Simulate webhook failure
   - Review Twilio console
   - Check Railway logs
   - Fix and verify

3. **Exercise 3: Database Backup/Restore**
   - Create manual backup
   - Restore to test environment
   - Verify data integrity

4. **Exercise 4: Regenerate TTS Cache**
   - Clear TTS cache
   - Warm cache with common phrases
   - Verify cache hit rate

---

## 📊 SLA & Performance Targets

### Service Level Objectives (SLOs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | Monthly |
| API Response Time (p95) | <500ms | Daily |
| API Response Time (p99) | <2s | Daily |
| Error Rate | <0.5% | Hourly |
| Appointment Booking Success | >99% | Daily |
| Webhook Processing Time | <10s | Per request |

### Performance Benchmarks

```bash
# Run performance tests
npm run test:performance

# Expected results:
# - API latency p50: <200ms
# - API latency p95: <500ms
# - API latency p99: <2s
# - Throughput: >100 req/s
# - Error rate: <0.1%
```

---

**📖 Runbook Version**: 1.0.0  
**Last Updated**: January 2024  
**Next Review**: April 2024  

For runbook updates or feedback, contact: devops@orchestrall.com
