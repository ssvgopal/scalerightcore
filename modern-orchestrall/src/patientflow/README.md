# PatientFlow Module

A comprehensive healthcare patient flow management system for the Orchestrall platform. This module provides domain services, REST APIs, and data models for managing clinics, doctors, patients, appointments, and interactions.

## Architecture Overview

The PatientFlow module is organized into the following components:

```
src/patientflow/
├── services/                      # Domain services
│   ├── patient-service.js        # Patient management
│   ├── doctor-service.js         # Doctor and branch management
│   ├── appointment-service.js    # Appointment booking & scheduling
│   ├── conversation-session-service.js  # Session state management
│   └── interaction-logger.js     # Message/call logging
├── validation/
│   └── schemas.js                # Zod validation schemas
├── routes.js                      # Fastify plugin with REST endpoints
└── README.md                      # This file
```

## Services

### PatientService

Manages patient data, profiles, and preferences.

**Key Methods:**
- `lookupByPhone(organizationId, phone)` - Find patient by phone number
- `createPatient(organizationId, patientData)` - Create new patient
- `updatePatient(patientId, updateData)` - Update patient information
- `getPatientProfile(patientId)` - Get complete patient profile with history
- `getOrCreatePreference(patientId)` - Get or create patient preferences
- `updatePreference(patientId, preferenceData)` - Update patient preferences
- `addNote(patientId, noteData)` - Add clinical/administrative notes
- `getPatientHistory(patientId, limit, offset)` - Get appointment/message/call history
- `searchPatients(organizationId, query, limit)` - Search patients by name/phone/email

### DoctorService

Manages doctors, clinic branches, and availability scheduling.

**Key Methods:**
- `getAllBranches(organizationId)` - List all clinic branches
- `getBranchById(branchId)` - Get branch details with doctors
- `getDoctorsByBranch(branchId, includeInactive)` - List doctors in a branch
- `getDoctorById(doctorId)` - Get doctor details
- `searchDoctors(organizationId, filters)` - Search doctors by specialty/branch
- `getDoctorAvailability(doctorId, date, slotDurationMinutes)` - Get available slots
- `getMultipleDoctorsAvailability(doctorIds, date, slotDurationMinutes)` - Batch availability
- `getProviderMetadata(doctorId)` - Get doctor metadata for display

### AppointmentService

Handles appointment booking, rescheduling, and cancellation with conflict detection.

**Key Methods:**
- `bookAppointment(organizationId, appointmentData)` - Book appointment with transaction
  - ✅ **Prevents double-booking** via database transaction and conflict checking
  - Validates patient and doctor exist
  - Checks for overlapping appointments
  - Throws error if slot is already booked
- `rescheduleAppointment(appointmentId, newStartTime, newEndTime, reason)` - Reschedule with conflict check
- `cancelAppointment(appointmentId, reason)` - Cancel appointment
- `getAppointmentById(appointmentId)` - Get appointment details
- `getPatientAppointments(patientId, status)` - List patient appointments
- `getDoctorAppointmentsForDate(doctorId, date)` - Get doctor's daily schedule
- `getUpcomingAppointments(limit)` - Get upcoming appointments across all doctors
- `updateAppointmentStatus(appointmentId, status)` - Update appointment status
- `markReminderSent(appointmentId)` - Mark reminder as sent
- `getAppointmentsRequiringReminders(hoursUntilAppointment)` - Get appointments needing reminders

**Conflict Detection Strategy:**
The service uses Prisma transactions to ensure atomic operations:
1. Within a transaction, check for existing BOOKED/CONFIRMED appointments
2. Verify requested time slot doesn't overlap with any existing appointments
3. If conflict found, transaction is rolled back with descriptive error
4. If no conflict, appointment is created

```javascript
// Example: Booking prevents double-booking
try {
  const appointment = await appointmentService.bookAppointment('org-1', {
    patientId: 'patient-1',
    doctorId: 'doctor-1',
    startTime: '2024-12-20T09:00:00',
    endTime: '2024-12-20T09:30:00',
  });
} catch (error) {
  if (error.message.includes('already booked')) {
    // Handle conflict - suggest alternative times
  }
}
```

### InteractionLogger

Logs patient interactions including messages and calls.

**Key Methods:**
- `logMessage(organizationId, patientId, channel, direction, payload, externalMessageId)` - Log message
- `logCall(organizationId, patientId, callSid, status, startTime, callMetadata)` - Log call
- `updateCallEnd(callLogId, endTime, durationSeconds, transcription, summary)` - Update call
- `getRecentMessages(patientId, limit)` - Get recent messages for patient
- `getRecentCalls(patientId, limit)` - Get recent calls for patient
- `getMessagesByChannel(organizationId, channel, limit)` - Filter messages by channel
- `getCallStatistics(organizationId, startDate, endDate)` - Get call metrics
- `getMessageStatistics(organizationId, startDate, endDate)` - Get message metrics
- `exportPatientHistory(patientId)` - Export complete interaction history
- `deleteOldLogs(organizationId, daysOld)` - Clean up old logs

### ConversationSessionService

Manages conversation session state with optional Redis caching.

**Key Methods:**
- `getOrCreateSession(organizationId, patientPhone)` - Get or create session
- `getSessionById(sessionId)` - Get session by ID
- `getSessionByKey(sessionKey)` - Get session by unique key
- `updateSessionState(sessionId, stateUpdates)` - Update session state
- `getSessionState(sessionId)` - Get current session state
- `endSession(sessionId)` - End active session
- `endPatientSessions(organizationId, patientPhone)` - End all sessions for patient
- `getActiveSessions(organizationId)` - Get active sessions
- `cleanupExpiredSessions(maxInactiveHours)` - Clean up old sessions
- `storeTempContext(organizationId, patientPhone, contextData, ttlSeconds)` - Store temp context in Redis
- `getTempContext(organizationId, patientPhone)` - Retrieve temp context
- `clearTempContext(organizationId, patientPhone)` - Clear temp context

**Caching Strategy:**
- Sessions are stored in Prisma for persistence
- Optional Redis caching for fast retrieval (default TTL: 1 hour)
- Graceful fallback if Redis is unavailable
- Temporary context stored in Redis for transient conversation state

## REST API Endpoints

All endpoints are authenticated via JWT token (Authorization: Bearer <token>).

### Clinic Branches
- `GET /patientflow/api/branches` - List all branches
- `GET /patientflow/api/branches/:branchId` - Get branch details

### Doctors
- `GET /patientflow/api/doctors` - Search/list doctors (supports filters: branchId, specialty, isAvailable)
- `GET /patientflow/api/doctors/:doctorId` - Get doctor details
- `GET /patientflow/api/doctors/:doctorId/availability?date=YYYY-MM-DD&durationMinutes=30` - Get availability slots

### Patients
- `GET /patientflow/api/patients/lookup?phone=+1234567890` - Lookup patient by phone
- `POST /patientflow/api/patients` - Create new patient
- `GET /patientflow/api/patients/:patientId` - Get patient profile with history
- `PUT /patientflow/api/patients/:patientId` - Update patient information
- `GET /patientflow/api/patients/:patientId/preferences` - Get patient preferences
- `PUT /patientflow/api/patients/:patientId/preferences` - Update patient preferences

### Appointments
- `POST /patientflow/api/appointments` - Book appointment
- `GET /patientflow/api/appointments/:appointmentId` - Get appointment details
- `PUT /patientflow/api/appointments/:appointmentId/reschedule` - Reschedule appointment
- `DELETE /patientflow/api/appointments/:appointmentId` - Cancel appointment
- `GET /patientflow/api/patients/:patientId/appointments?status=BOOKED` - Get patient appointments

### Interactions (Messages & Calls)
- `GET /patientflow/api/patients/:patientId/messages?limit=20` - Get recent messages
- `GET /patientflow/api/patients/:patientId/calls?limit=20` - Get recent calls
- `POST /patientflow/api/interactions/log-message` - Log message interaction
- `POST /patientflow/api/interactions/log-call` - Log call interaction

### Conversation Sessions
- `POST /patientflow/api/sessions` - Create/get conversation session
- `GET /patientflow/api/sessions/:sessionId` - Get session details
- `PUT /patientflow/api/sessions/:sessionId/state` - Update session state
- `DELETE /patientflow/api/sessions/:sessionId` - End session

## Validation Schemas

All request bodies are validated using Zod schemas. See `validation/schemas.js` for detailed validation rules.

**Key Schemas:**
- `phoneSchema` - Phone number validation
- `patientSchema` - Patient creation/update
- `appointmentBookingSchema` - Appointment booking
- `appointmentRescheduleSchema` - Reschedule request
- `appointmentCancellationSchema` - Cancellation request
- `availabilityQuerySchema` - Availability query
- `doctorSearchSchema` - Doctor search filters
- `messageLogSchema` - Message log entry
- `callLogSchema` - Call log entry
- `conversationSessionSchema` - Session data

## Data Models

### Clinic Branch
- `id`, `organizationId`, `name`, `address`, `city`, `state`, `postalCode`, `country`
- `phone`, `email`, `alternatePhone`
- `operatingHours` (JSON: day → {open, close})
- Relations: `doctors[]`

### Doctor
- `id`, `organizationId`, `branchId`
- `firstName`, `lastName`, `email`, `phone`, `specialty`
- `licenseNumber`, `qualifications[]`, `languages[]`
- `isAvailable`, `isActive`
- Relations: `schedules[]`, `appointments[]`

### DoctorSchedule
- `id`, `doctorId`, `dayOfWeek` (0-6)
- `timeSlots` (JSON: [{start, end}])
- `slotDurationMinutes`, `isActive`
- Unique constraint: (doctorId, dayOfWeek)

### Patient
- `id`, `organizationId`
- `firstName`, `lastName`, `phone`, `email`, `dateOfBirth`, `gender`
- `address`, `city`, `state`, `postalCode`, `country`
- `emergencyContact`, `emergencyPhone`
- `bloodType`, `allergies[]`, `chronicConditions[]`
- `phoneOptIn`, `emailOptIn`, `smsOptIn`, `whatsappOptIn`
- `status` (active, inactive, archived)
- Unique constraint: (organizationId, phone)
- Relations: `preferences?`, `notes[]`, `appointments[]`, `messageLogs[]`, `callLogs[]`

### PatientPreference
- `id`, `patientId` (unique)
- `preferredLanguage`, `preferredTimeSlots[]`, `reminderPreference`
- `preferredChannels[]`, `doNotCallBefore`, `doNotCallAfter`

### Appointment
- `id`, `organizationId`, `patientId`, `doctorId`
- `status` (BOOKED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW)
- `source` (WHATSAPP, VOICE, MANUAL), `channel` (WHATSAPP, VOICE)
- `startTime`, `endTime`
- `reason`, `internalNotes`, `channelMetadata` (JSON)
- `reminderSent`, `reminderSentAt`
- Indexes: patientId, doctorId, organizationId, startTime, status

### PatientMessageLog
- `id`, `organizationId`, `patientId`
- `channel` (WHATSAPP, VOICE), `direction` (INBOUND, OUTBOUND)
- `payload` (JSON), `externalMessageId`
- Indexes: patientId, organizationId, createdAt, channel

### PatientCallLog
- `id`, `organizationId`, `patientId`
- `callSid`, `status` (INITIATED, RINGING, ANSWERED, COMPLETED, FAILED, MISSED)
- `startTime`, `endTime`, `durationSeconds`
- `transcription`, `summary`, `callMetadata` (JSON)
- Indexes: patientId, organizationId, callSid

### ConversationSession
- `id`, `organizationId`, `patientPhone`
- `sessionKey` (unique: org:phone)
- `stateJson` (JSON conversation state)
- `isActive`, `startedAt`, `lastActivityAt`, `endedAt`

## Example Usage

### Book an Appointment
```javascript
const appointmentService = new AppointmentService(prisma);

try {
  const appointment = await appointmentService.bookAppointment('org-1', {
    patientId: 'patient-123',
    doctorId: 'doctor-456',
    startTime: '2024-12-20T10:00:00Z',
    endTime: '2024-12-20T10:30:00Z',
    source: 'VOICE',
    reason: 'Regular checkup',
  });
  
  console.log('Appointment booked:', appointment.id);
} catch (error) {
  if (error.message.includes('already booked')) {
    // Suggest alternative times
    const availability = await doctorService.getDoctorAvailability(
      'doctor-456',
      '2024-12-20'
    );
  }
}
```

### Get Doctor Availability
```javascript
const doctorService = new DoctorService(prisma);

const availability = await doctorService.getDoctorAvailability(
  'doctor-456',
  '2024-12-20',
  30 // 30-minute slots
);

console.log('Available slots:', availability.availableSlots);
```

### Log Patient Interaction
```javascript
const interactionLogger = new InteractionLogger(prisma);

await interactionLogger.logMessage(
  'org-1',
  'patient-123',
  'WHATSAPP',
  'INBOUND',
  {
    messageId: 'wa-msg-001',
    text: 'I would like to book an appointment',
    timestamp: new Date(),
  }
);
```

### Manage Conversation Session
```javascript
const conversationService = new ConversationSessionService(prisma, redis);

// Get or create session
const session = await conversationService.getOrCreateSession(
  'org-1',
  '+1-503-555-0100'
);

// Update session state
await conversationService.updateSessionState(session.id, {
  stage: 'appointment_booking',
  selectedDoctor: 'doctor-456',
  selectedDate: '2024-12-20',
});

// Store temporary context in Redis
await conversationService.storeTempContext(
  'org-1',
  '+1-503-555-0100',
  { conversationHistory: [...] },
  3600 // 1 hour TTL
);
```

## Testing

Run unit tests for PatientFlow services:
```bash
npm test -- tests/unit/patientflow-services.test.js
npm test -- tests/unit/patientflow-validation.test.js
```

## Seeding Test Data

The database seed includes sample PatientFlow data:
- 1 Clinic Branch
- 2 Doctors (Cardiology, General Practice)
- 2 Patients
- 1 Appointment
- Message & call logs
- Conversation session

Run seed:
```bash
npm run db:seed
```

## Integration with Orchestrall

The PatientFlow module is registered as a Fastify plugin in `src/app-commercial.js`:

```javascript
const patientFlowRoutes = require('./patientflow/routes');
app.register(patientFlowRoutes, { 
  prisma: database.client, 
  redis: cacheService.redis 
});
```

All routes are:
- ✅ Authenticated via JWT
- ✅ Documented in Swagger (auto-discovered via Fastify schemas)
- ✅ Error-handled with consistent response format
- ✅ Multi-tenant aware (organizationId from JWT)

## Performance Considerations

1. **Database Indexes**: All critical queries have indexes on (organizationId, createdAt, doctorId, patientId, etc.)
2. **Transactions**: Appointment booking uses Prisma transactions for data consistency
3. **Redis Caching**: Session state optionally cached in Redis for fast retrieval
4. **Batch Queries**: Doctor availability supports batch queries for multiple doctors
5. **Pagination**: List endpoints support limit/offset for performance

## Security

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: organizationId checked from JWT context
3. **Input Validation**: All payloads validated with Zod schemas
4. **SQL Injection Prevention**: Prisma ORM handles parameterization
5. **Data Privacy**: Patient data limited to organization scope

## Future Enhancements

- [ ] Video consultation integration
- [ ] Automated appointment reminders (SMS/Email/WhatsApp)
- [ ] Patient rating system
- [ ] Prescription management
- [ ] Medical records storage
- [ ] Analytics dashboard
- [ ] Appointment confirmation workflow
- [ ] Cancellation/reschedule notifications
- [ ] Doctor availability synchronization with calendar systems
- [ ] Multi-language support for patient communications
