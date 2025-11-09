# PatientFlow Demo Scenarios

## 📋 Overview

This document provides scripted walkthroughs for demonstrating PatientFlow's key features. Each scenario includes expected prompts, responses, and system behavior to help your demo team deliver confident presentations without requiring technical knowledge.

## 🎯 Pre-Demo Checklist

Before running any demo scenario, verify:

- [ ] Railway deployment is healthy (`/health` endpoint returns 200)
- [ ] Database migrations are complete
- [ ] Twilio phone number is configured and active
- [ ] WhatsApp sandbox is connected (or production number approved)
- [ ] Google Cloud TTS is enabled and credentials are valid
- [ ] OpenAI API key has sufficient credits
- [ ] Demo doctors and schedules are seeded in database
- [ ] Your demo phone has Twilio sandbox WhatsApp number saved

## 🎬 Demo Environment Setup

### Quick Setup Commands

```bash
# Check system health
curl https://your-railway-app.railway.app/health

# Verify database has demo data
railway run npx prisma studio

# Test Twilio connectivity
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json" \
  -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}"
```

### Demo Phone Numbers

For demos, use these test numbers:
- **Known Patient**: +1-555-0100 (pre-seeded in database)
- **Unknown Caller**: +1-555-0999 (not in database)
- **Emergency Test**: +1-555-0911 (for testing error handling)

---

## 📞 Scenario 1: Unknown Caller Books First Appointment (Voice IVR)

**Duration**: 3-5 minutes  
**Channel**: Voice Call  
**Objective**: Demonstrate new patient onboarding via phone

### Setup

1. Clear any existing patient with test phone number:
```bash
railway run npx prisma client
# In Prisma Studio, delete patient with phone +15550999
```

2. Have demo phone ready with Twilio number displayed

### Demo Script

**Step 1: Initiate Call**

```
Demo Action: Call Twilio number from +1-555-0999
```

**Expected Response (AI Voice):**
```
"Welcome to Demo Healthcare Clinic. 
Thank you for calling. 

I don't have your information in our system yet. 
May I have your first name, please?"
```

---

**Step 2: Provide First Name**

```
Demo Response: "My name is John"
```

**Expected Response:**
```
"Thank you, John. And your last name?"
```

---

**Step 3: Provide Last Name**

```
Demo Response: "Smith"
```

**Expected Response:**
```
"Great, John Smith. Can you please provide your date of birth 
in month, day, year format? For example, January 15th, 1990."
```

---

**Step 4: Provide Date of Birth**

```
Demo Response: "March 20th, 1985"
```

**Expected Response:**
```
"Thank you. And what is your email address for appointment confirmations?"
```

---

**Step 5: Provide Email**

```
Demo Response: "john.smith@email.com"
```

**Expected Response:**
```
"Perfect. Let me check available appointments for you.

We have the following doctors available:
- Doctor Sarah Smith, General Practice
- Doctor Michael Johnson, Cardiology

Which doctor would you prefer, or would you like the 
first available appointment?"
```

---

**Step 6: Select Doctor**

```
Demo Response: "Doctor Sarah Smith"
```

**Expected Response:**
```
"Doctor Sarah Smith, excellent choice.

Available time slots for this week:
- Tomorrow at 10:00 AM
- Tomorrow at 2:30 PM
- Thursday at 9:00 AM
- Friday at 11:30 AM

Which time works best for you?"
```

---

**Step 7: Select Time Slot**

```
Demo Response: "Tomorrow at 10 AM"
```

**Expected Response:**
```
"Perfect! I've booked your appointment with Doctor Sarah Smith 
for tomorrow at 10:00 AM at our Main Branch Downtown location.

You will receive a confirmation via SMS and email.

Your appointment reference number is APT-2024-001.

Is there anything else I can help you with today?"
```

---

**Step 8: End Call**

```
Demo Response: "No, that's all. Thank you!"
```

**Expected Response:**
```
"You're welcome, John! We look forward to seeing you tomorrow 
at 10:00 AM. Have a great day!"

[Call ends]
```

### Verification Steps

After the call:

```bash
# 1. Check patient was created
curl https://your-railway-app.railway.app/api/patients?phone=+15550999

# 2. Check appointment was booked
curl https://your-railway-app.railway.app/api/appointments?patientPhone=+15550999

# 3. Check call log
curl https://your-railway-app.railway.app/api/call-logs?phone=+15550999
```

**Expected Results:**
- Patient record created with name, DOB, email, phone
- Appointment created with status "BOOKED"
- Call log created with transcription
- SMS confirmation sent to patient phone
- Email confirmation sent to patient email

---

## 💬 Scenario 2: Known Patient Books via WhatsApp

**Duration**: 2-3 minutes  
**Channel**: WhatsApp  
**Objective**: Demonstrate returning patient self-service booking

### Setup

1. Ensure test patient exists in database:
```bash
# Patient: Jane Doe, +1-555-0100
# Has preference for morning appointments
# Preferred language: English
```

2. Open WhatsApp on demo phone
3. Ensure Twilio sandbox number is saved

### Demo Script

**Step 1: Initiate Conversation**

```
Demo Action: Send WhatsApp message to Twilio number
Message: "Hi, I need to book an appointment"
```

**Expected Response (AI via WhatsApp):**
```
Hi Jane! 👋

Welcome back to Demo Healthcare Clinic.

I can help you book an appointment. 

Based on your preferences, I have these morning slots available:

1️⃣ Dr. Sarah Smith - Tomorrow at 9:00 AM
2️⃣ Dr. Sarah Smith - Wednesday at 9:30 AM  
3️⃣ Dr. Johnson - Tuesday at 10:00 AM

Reply with the number of your preferred time slot.
```

---

**Step 2: Select Appointment**

```
Demo Response: "1"
```

**Expected Response:**
```
✅ Perfect! Your appointment is confirmed.

📅 Date: Tomorrow
🕐 Time: 9:00 AM
👨‍⚕️ Doctor: Dr. Sarah Smith
🏥 Location: Main Branch - Downtown
📍 123 Healthcare Ave, San Francisco, CA

You'll receive a reminder 24 hours before your appointment.

Anything else I can help with?
```

---

**Step 3: Ask About Location**

```
Demo Response: "Where exactly is the clinic?"
```

**Expected Response:**
```
📍 Demo Healthcare Clinic - Main Branch

Address:
123 Healthcare Ave
San Francisco, CA 94102

📞 Phone: +1-415-555-1234
📧 Email: main@democlinic.com

🕐 Hours:
Mon-Fri: 9:00 AM - 5:00 PM
Saturday: 10:00 AM - 2:00 PM
Sunday: Closed

Google Maps: [Link to maps]

Need directions or parking information?
```

---

**Step 4: End Conversation**

```
Demo Response: "No, that's all. Thanks!"
```

**Expected Response:**
```
You're very welcome, Jane! 😊

See you tomorrow at 9:00 AM!

If you need to cancel or reschedule, just message me here.

Take care! 👋
```

### Verification Steps

```bash
# Check appointment was created
curl https://your-railway-app.railway.app/api/appointments?patientId=JANE_DOE_ID

# Check WhatsApp message log
curl https://your-railway-app.railway.app/api/message-logs?patientId=JANE_DOE_ID&channel=WHATSAPP

# Check patient preferences were applied
curl https://your-railway-app.railway.app/api/patients/JANE_DOE_ID/preferences
```

**Expected Results:**
- Morning time slots offered (respecting patient preference)
- Appointment created with source "WHATSAPP"
- Message exchange logged with timestamps
- Appointment reminder scheduled for 24 hours before

---

## 🔄 Scenario 3: Patient Reschedules Appointment (WhatsApp)

**Duration**: 2 minutes  
**Channel**: WhatsApp  
**Objective**: Demonstrate easy rescheduling

### Setup

Patient Jane Doe has existing appointment for tomorrow at 9:00 AM

### Demo Script

**Step 1: Request Reschedule**

```
Demo Action: Send WhatsApp message
Message: "I need to reschedule my appointment tomorrow"
```

**Expected Response:**
```
Hi Jane! 

I see you have an appointment tomorrow at 9:00 AM 
with Dr. Sarah Smith.

No problem, let me help you reschedule.

Available alternative times:

1️⃣ Tomorrow at 2:30 PM
2️⃣ Wednesday at 9:00 AM
3️⃣ Thursday at 10:30 AM
4️⃣ Friday at 11:00 AM

Which works better for you?
```

---

**Step 2: Select New Time**

```
Demo Response: "3"
```

**Expected Response:**
```
✅ Rescheduled successfully!

❌ Cancelled: Tomorrow at 9:00 AM
✅ New appointment: Thursday at 10:30 AM

👨‍⚕️ Doctor: Dr. Sarah Smith (same doctor)
🏥 Location: Main Branch - Downtown

Confirmation sent via email.

Anything else?
```

---

**Step 3: Confirm**

```
Demo Response: "No, thanks"
```

**Expected Response:**
```
Perfect! See you Thursday at 10:30 AM! 👍

Your updated appointment reference: APT-2024-002
```

### Verification Steps

```bash
# Check old appointment was cancelled
curl https://your-railway-app.railway.app/api/appointments/APT-2024-001

# Expected: status = "CANCELLED"

# Check new appointment was created
curl https://your-railway-app.railway.app/api/appointments/APT-2024-002

# Expected: status = "BOOKED", startTime = Thursday 10:30 AM
```

---

## 📱 Scenario 4: Multi-Turn WhatsApp Conversation

**Duration**: 3-4 minutes  
**Channel**: WhatsApp  
**Objective**: Demonstrate natural conversation flow and context retention

### Demo Script

**Turn 1: General Inquiry**

```
Demo Message: "What are your hours?"
```

**Expected Response:**
```
Hi there! 👋

Our clinic hours are:

🕐 Monday - Friday: 9:00 AM - 5:00 PM
🕐 Saturday: 10:00 AM - 2:00 PM
🕐 Sunday: Closed

We also have extended hours on Thursdays until 7:00 PM 
for working patients.

Need to book an appointment?
```

---

**Turn 2: Follow-up Question (Context Retained)**

```
Demo Message: "Yes, can I see a cardiologist?"
```

**Expected Response:**
```
Great! We have Dr. Michael Johnson, our cardiologist.

Dr. Johnson is available on:
- Tuesdays: 10:00 AM - 2:00 PM
- Thursdays: 10:00 AM - 2:00 PM  
- Saturdays: 10:00 AM - 2:00 PM

His next available appointments are:

1️⃣ Tuesday at 11:15 AM
2️⃣ Thursday at 1:00 PM
3️⃣ Saturday at 10:45 AM

Which would you prefer?
```

---

**Turn 3: Book Appointment**

```
Demo Message: "Tuesday at 11:15"
```

**Expected Response:**
```
I'll need a bit more information to book that for you.

May I have your name?
```

---

**Turn 4: Provide Name**

```
Demo Message: "Robert Chen"
```

**Expected Response:**
```
Thank you, Robert!

And your phone number for appointment reminders?
```

---

**Turn 5: Provide Phone**

```
Demo Message: "555-0200"
```

**Expected Response:**
```
Perfect! And your email address?
```

---

**Turn 6: Provide Email**

```
Demo Message: "robert.chen@email.com"
```

**Expected Response:**
```
✅ All set, Robert!

Your appointment with Dr. Michael Johnson:

📅 Tuesday at 11:15 AM
🏥 Main Branch - Downtown
📧 Confirmation sent to robert.chen@email.com
📱 Reminder will be sent 24 hours before

Reference: APT-2024-003

See you Tuesday! 👨‍⚕️
```

### Key Points to Highlight

- 🧠 **Context Retention**: System remembers conversation context across multiple messages
- 💬 **Natural Language**: Understands various phrasings ("Yes", "Tuesday at 11:15", etc.)
- 📝 **Progressive Information Gathering**: Collects required info step-by-step
- ✅ **Confirmation**: Always confirms booking with full details

---

## 🎙️ Scenario 5: Voice IVR with Multiple Options

**Duration**: 3-4 minutes  
**Channel**: Voice Call  
**Objective**: Demonstrate IVR menu navigation and intent recognition

### Demo Script

**Step 1: Initial IVR Menu**

```
Demo Action: Call Twilio number
```

**Expected Response (AI Voice):**
```
"Welcome to Demo Healthcare Clinic.

Please select from the following options:

Press 1 or say 'Book Appointment' to schedule a new appointment
Press 2 or say 'Cancel Appointment' to cancel an existing appointment  
Press 3 or say 'Speak to Reception' to talk to our front desk
Press 4 or say 'Clinic Information' for hours and location

What would you like to do?"
```

---

**Step 2: Navigate to Booking**

```
Demo Response: "Book appointment" (or press 1)
```

**Expected Response:**
```
"I'll help you book an appointment.

Are you a new patient or returning patient?

Say 'New Patient' if this is your first visit, or
'Returning Patient' if you've been here before."
```

---

**Step 3: Returning Patient Flow**

```
Demo Response: "Returning patient"
```

**Expected Response:**
```
"Great! Can you please provide your phone number or 
patient ID so I can look up your information?"
```

---

**Step 4: Provide Phone Number**

```
Demo Response: "555-0100"
```

**Expected Response:**
```
"Thank you. I found your record, Jane Doe.

What type of appointment do you need?

Say 'General Checkup', 'Specialist', or 'Follow-up'."
```

---

**Step 5: Select Appointment Type**

```
Demo Response: "General checkup"
```

**Expected Response:**
```
"I recommend Dr. Sarah Smith for your general checkup.

She has availability:
- Today at 3:00 PM
- Tomorrow at 10:00 AM
- Wednesday at 2:30 PM

Which time works for you?"
```

---

**Step 6: Book Appointment**

```
Demo Response: "Tomorrow at 10 AM"
```

**Expected Response:**
```
"Perfect! Your general checkup with Dr. Sarah Smith is 
booked for tomorrow at 10:00 AM at our Main Branch.

You'll receive a confirmation text message shortly.

Is there anything else I can help you with?"
```

---

**Step 7: End Call**

```
Demo Response: "No, that's all"
```

**Expected Response:**
```
"Thank you for calling Demo Healthcare Clinic. 
We look forward to seeing you tomorrow. Goodbye!"

[Call ends]
```

---

## 🚨 Scenario 6: Error Handling Demo

**Duration**: 2 minutes  
**Channel**: WhatsApp or Voice  
**Objective**: Demonstrate graceful error handling

### Demo Script: No Available Appointments

**Step 1:**
```
Demo Message: "I need an appointment with Dr. Johnson this Saturday"
```

**Expected Response:**
```
I checked Dr. Johnson's schedule for this Saturday, 
but unfortunately all time slots are fully booked. 😔

However, I have availability:

1️⃣ Next Tuesday at 10:30 AM
2️⃣ Next Thursday at 1:15 PM
3️⃣ Saturday (next week) at 11:00 AM

Would any of these work for you?

Alternatively, I can add you to our waitlist if someone 
cancels their Saturday appointment.
```

### Demo Script: Outside Business Hours

**Step 1:**
```
Demo Message: "Can I come in at 8 PM tonight?"
```

**Expected Response:**
```
Our clinic is open until 5:00 PM on weekdays 
(7:00 PM on Thursdays).

I have these evening options available:

1️⃣ Thursday at 5:30 PM (extended hours)
2️⃣ Thursday at 6:15 PM (extended hours)

Or would you prefer a regular morning/afternoon slot?
```

### Demo Script: Invalid Input

**Step 1:**
```
Demo Message: "asdfghjkl"
```

**Expected Response:**
```
I'm sorry, I didn't quite understand that. 😅

I can help you with:
- 📅 Book an appointment
- ❌ Cancel an appointment
- 🔄 Reschedule an appointment
- 📍 Get clinic information
- 👨‍⚕️ Learn about our doctors

What would you like to do?
```

---

## 📊 Demo Success Metrics

After each demo scenario, show these metrics:

```bash
# Dashboard URL
https://your-railway-app.railway.app/admin/dashboard

# Quick stats query
curl https://your-railway-app.railway.app/api/stats/demo
```

**Expected Metrics Display:**

```json
{
  "appointments_today": 5,
  "appointments_booked_last_hour": 2,
  "whatsapp_conversations": 8,
  "voice_calls": 4,
  "average_booking_time": "2m 30s",
  "patient_satisfaction": "98%",
  "automation_rate": "95%"
}
```

---

## 🎭 Demo Tips & Best Practices

### Before the Demo

1. ✅ **Test the full flow** 24 hours before demo
2. ✅ **Have backup scenarios** ready if one fails
3. ✅ **Prepare demo data** with realistic names/scenarios
4. ✅ **Test on actual phones** (not simulators)
5. ✅ **Clear conversation state** between demo runs

### During the Demo

1. 🎯 **Speak clearly** when doing voice demos
2. ⏱️ **Allow 2-3 seconds** for AI to process responses
3. 📱 **Show the phone screen** when doing WhatsApp demos
4. 💬 **Narrate what's happening** while AI processes
5. 🔄 **Have a reset button** ready for quick recovery

### After the Demo

1. 📝 **Ask for feedback** on conversation flow
2. 📊 **Show analytics** and success metrics
3. 💰 **Discuss cost savings** vs. manual booking
4. 🚀 **Highlight scalability** (24/7 availability)
5. 🔐 **Address security/HIPAA** concerns proactively

---

## 🛟 Demo Troubleshooting

### Issue: AI Response is Slow

**Cause**: OpenAI API latency or cold start  
**Fix**: 
```bash
# Pre-warm the system before demo
curl https://your-railway-app.railway.app/api/health/warm-up
```

### Issue: Twilio Webhook Not Responding

**Cause**: Railway service sleeping (hobby plan)  
**Fix**: Upgrade to paid plan or send warmup request 5 minutes before demo

### Issue: WhatsApp Message Not Received

**Cause**: Sandbox disconnected or rate limit  
**Fix**:
1. Check Twilio console for errors
2. Rejoin sandbox if needed
3. Wait 1 minute between messages during demo

### Issue: Wrong Doctor Suggested

**Cause**: Doctor schedule not seeded correctly  
**Fix**:
```bash
railway run npx tsx prisma/seed-patientflow.ts --reset
```

### Emergency Demo Reset

```bash
# Nuclear option: reset entire demo environment
railway run npm run demo:reset

# This will:
# - Clear all test appointments
# - Reset conversation sessions
# - Restore demo doctors/schedules
# - Clear message/call logs
```

---

## 📞 Demo Support Contacts

**During Demo Issues:**
- **Tech Support Hotline**: +1-555-HELP-NOW
- **Slack Channel**: #patientflow-demo-support
- **Emergency Reset Code**: Type "RESET-DEMO-2024" in admin panel

---

## 🎉 Advanced Demo Scenarios

For experienced demo teams or technical audiences:

### Show Admin Dashboard
- Real-time appointment calendar
- Live conversation monitoring
- Analytics and reporting
- Doctor schedule management

### API Integration Demo
- Show REST API calls with curl
- Demonstrate webhook payloads
- Explain multi-tenant architecture
- Show database schema in Prisma Studio

### Customization Demo
- Change AI voice/personality
- Modify clinic business rules
- Add new appointment types
- Configure custom workflows

---

**🎬 Ready to Demo!** Follow these scenarios to deliver confident, impressive PatientFlow demonstrations.
