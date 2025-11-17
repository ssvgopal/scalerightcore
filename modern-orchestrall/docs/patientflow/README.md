# PatientFlow Documentation

Welcome to the **PatientFlow** documentation. This directory contains comprehensive guides for deploying, demonstrating, and operating the PatientFlow healthcare appointment management system.

## 📚 Documentation Overview

### 📖 [Deployment Guide](./deployment.md)
Complete deployment instructions including:
- Railway.app project setup
- Environment variable configuration
- Twilio Voice & WhatsApp integration
- Google Cloud Text-to-Speech setup
- Database migrations and seeding
- Cost estimates and troubleshooting

**Target Audience**: DevOps engineers, system administrators

### 🎬 [Demo Scenarios](./demo-scenarios.md)
Scripted walkthroughs for product demonstrations including:
- Unknown caller booking first appointment (Voice IVR)
- Known patient booking via WhatsApp
- Patient rescheduling appointments
- Multi-turn WhatsApp conversations
- Voice IVR menu navigation
- Error handling demonstrations

**Target Audience**: Sales teams, demo specialists, product managers

### 🛟 [Operations Runbook](./runbook.md)
Operational procedures and troubleshooting guides including:
- Health check endpoints and monitoring
- Alert configuration
- Twilio webhook troubleshooting
- TTS audio cache management
- Database connection issues
- Performance optimization
- Incident escalation procedures

**Target Audience**: DevOps engineers, SREs, on-call engineers

## 🚀 Quick Start

### 1. Deploy the System
Follow the [Deployment Guide](./deployment.md) to set up:
```bash
# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npx prisma migrate deploy

# Seed demo data
npx tsx prisma/seed-patientflow.ts

# Start server
npm start
```

### 2. Test the System
```bash
# Health check
curl http://localhost:3000/health

# Test API
curl http://localhost:3000/api/patientflow/doctors \
  -H "X-Organization-ID: org_demo_clinic"
```

### 3. Run a Demo
Follow the [Demo Scenarios](./demo-scenarios.md) to:
- Book an appointment via voice call
- Book via WhatsApp messaging
- Demonstrate AI conversation capabilities

### 4. Monitor & Maintain
Use the [Operations Runbook](./runbook.md) for:
- Daily health checks
- Performance monitoring
- Incident response

## 🏥 System Architecture

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

## 🔑 Key Components

### Database Models
- **ClinicBranch**: Clinic locations with operating hours
- **Doctor**: Medical professionals with schedules and specialties
- **Patient**: Patient records with contact info and preferences
- **Appointment**: Booking records with status tracking
- **ConversationSession**: AI conversation state management
- **PatientCallLog**: Voice call history and transcriptions
- **PatientMessageLog**: WhatsApp/SMS message history

### External Services
- **Twilio**: Voice calls and WhatsApp messaging
- **Google Cloud TTS**: Text-to-speech for voice responses
- **OpenAI GPT-4**: AI-powered natural language conversations
- **Railway**: Cloud hosting and deployment platform

## 📊 Key Features

- ✅ **24/7 Automated Booking**: AI handles appointments round-the-clock
- ✅ **Multi-Channel Support**: Voice calls, WhatsApp, SMS
- ✅ **Natural Language Understanding**: Conversational booking flow
- ✅ **Doctor Schedule Management**: Availability and conflict detection
- ✅ **Patient Preferences**: Remembers preferred times and doctors
- ✅ **Automated Reminders**: SMS/WhatsApp notifications before appointments
- ✅ **Multi-Tenant Architecture**: Supports multiple clinics/organizations
- ✅ **Conversation History**: Complete audit trail of interactions

## 🎯 Common Tasks

### For DevOps/SRE Teams
- [Deploy to Railway](./deployment.md#step-6-deploy-to-railway)
- [Configure Twilio Webhooks](./deployment.md#23-configure-twilio-webhooks)
- [Set up Monitoring](./runbook.md#monitoring--alerts)
- [Troubleshoot Webhooks](./runbook.md#twilio-webhook-troubleshooting)
- [Regenerate TTS Cache](./runbook.md#regenerating-tts-audio-cache)

### For Demo/Sales Teams
- [Prepare for Demo](./demo-scenarios.md#pre-demo-checklist)
- [Demo: Voice Call Booking](./demo-scenarios.md#scenario-1-unknown-caller-books-first-appointment-voice-ivr)
- [Demo: WhatsApp Booking](./demo-scenarios.md#scenario-2-known-patient-books-via-whatsapp)
- [Demo: Rescheduling](./demo-scenarios.md#scenario-3-patient-reschedules-appointment-whatsapp)
- [Troubleshoot Demo Issues](./demo-scenarios.md#demo-troubleshooting)

### For Product/Business Teams
- [Understand Architecture](./deployment.md#architecture-overview)
- [Review Cost Estimates](./deployment.md#cost-estimates)
- [View API Examples](../../README.md#api-examples)
- [Understand SLAs](./runbook.md#sla--performance-targets)

## 📞 Support & Resources

### Documentation
- [Main README](../../README.md#patientflow---healthcare-appointment-system)
- [Deployment Guide](./deployment.md)
- [Demo Scenarios](./demo-scenarios.md)
- [Operations Runbook](./runbook.md)

### External Resources
- [Railway Documentation](https://docs.railway.app/)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Google Cloud TTS](https://cloud.google.com/text-to-speech)
- [OpenAI API](https://platform.openai.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

### Contact
- 📧 **Email**: patientflow-support@orchestrall.com
- 💬 **Slack**: #patientflow-support
- 🐛 **Issues**: GitHub Issues (if applicable)
- 📚 **Documentation Feedback**: Submit PR or email docs@orchestrall.com

## 🎓 Training Resources

### New Team Member Onboarding
1. Read [Deployment Guide](./deployment.md) to understand setup
2. Review [Demo Scenarios](./demo-scenarios.md) to learn features
3. Study [Operations Runbook](./runbook.md) for troubleshooting
4. Complete hands-on exercises in runbook
5. Shadow experienced team member during live demo
6. Practice demo scenarios until comfortable

### Self-Service Learning Path
1. **Week 1**: Understand system architecture and database models
2. **Week 2**: Deploy to local environment, run migrations, seed data
3. **Week 3**: Configure Twilio sandbox, test voice and WhatsApp flows
4. **Week 4**: Practice all demo scenarios, troubleshoot common issues
5. **Week 5**: Deploy to Railway staging, configure monitoring
6. **Week 6**: Shadow on-call engineer, review incident post-mortems

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2024 | Initial documentation release |

## 📝 Contributing

To improve this documentation:

1. Fork the repository
2. Make your changes in `docs/patientflow/`
3. Test any code examples or commands
4. Submit a pull request with clear description
5. Tag @docs-team for review

**Documentation Guidelines:**
- Use clear, concise language
- Include code examples with expected outputs
- Add troubleshooting steps for common issues
- Keep architecture diagrams up-to-date
- Test all commands before committing

---

**📖 Documentation Last Updated**: January 2024  
**🔄 Next Review Date**: April 2024  
**👥 Documentation Maintained By**: Orchestrall DevOps & Product Teams
