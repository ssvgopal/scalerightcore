# PatientFlow PR Migration Guide

This document provides instructions to migrate the PatientFlow PR from the current repository to the medicalAIDemo repository.

## Overview

This PR implements core PatientFlow services and REST endpoints for the Orchestrall platform:
- **5 Domain Services**: Patient, Doctor, Appointment, ConversationSession, InteractionLogger
- **25 REST API Endpoints**: All authenticated via JWT
- **Double-booking Prevention**: Implemented via Prisma transactions
- **Comprehensive Seeding**: Demo data for clinics, doctors, patients, appointments
- **Zod Validation**: All request payloads validated
- **API Documentation**: Complete README with examples

## Files Changed

### New Files (11)
1. `modern-orchestrall/src/patientflow/README.md` - Complete API documentation (410 lines)
2. `modern-orchestrall/src/patientflow/routes.js` - Fastify plugin with 25 endpoints (734 lines)
3. `modern-orchestrall/src/patientflow/services/patient-service.js` - Patient management (231 lines)
4. `modern-orchestrall/src/patientflow/services/doctor-service.js` - Doctor & availability (264 lines)
5. `modern-orchestrall/src/patientflow/services/appointment-service.js` - Booking with conflict detection (337 lines)
6. `modern-orchestrall/src/patientflow/services/conversation-session-service.js` - Session state (315 lines)
7. `modern-orchestrall/src/patientflow/services/interaction-logger.js` - Message/call logging (232 lines)
8. `modern-orchestrall/src/patientflow/validation/schemas.js` - Zod schemas (129 lines)
9. `modern-orchestrall/tests/unit/patientflow-services.test.js` - Service tests (412 lines)
10. `modern-orchestrall/tests/unit/patientflow-validation.test.js` - Validation tests (306 lines)

### Modified Files (2)
1. `modern-orchestrall/package.json` - Updated db:seed script and added prisma configuration
2. `modern-orchestrall/src/app-commercial.js` - Registered PatientFlow routes
3. `modern-orchestrall/prisma/seed.js` - Added PatientFlow demo data seeding (272 lines)

## Total Changes
- **13 files modified/created**
- **3,641 lines added**
- **1 line removed (replaced db:seed script)**

## Key Features

### 1. Domain Services

#### PatientService
- `lookupByPhone(organizationId, phone)` - Find patient
- `createPatient(organizationId, patientData)` - Create with preferences
- `getPatientProfile(patientId)` - Get profile with history
- `updatePatient(patientId, updateData)` - Update info
- `getOrCreatePreference(patientId)` - Manage preferences
- `addNote(patientId, noteData)` - Add notes
- `searchPatients(organizationId, query, limit)` - Search

#### DoctorService
- `getAllBranches(organizationId)` - List branches
- `getBranchById(branchId)` - Get branch details
- `getDoctorsByBranch(branchId, includeInactive)` - List doctors
- `getDoctorById(doctorId)` - Get doctor details
- `searchDoctors(organizationId, filters)` - Search with filters
- `getDoctorAvailability(doctorId, date, slotDurationMinutes)` - Get available slots
- `getMultipleDoctorsAvailability(doctorIds, date, slotDurationMinutes)` - Batch availability

#### AppointmentService
- `bookAppointment(organizationId, appointmentData)` - **With double-booking prevention**
  - Uses Prisma transactions
  - Checks for overlapping BOOKED/CONFIRMED appointments
  - Throws error if conflict found
  - Returns 409 Conflict on duplicate booking
- `rescheduleAppointment(appointmentId, newStartTime, newEndTime, reason)` - Reschedule with conflict check
- `cancelAppointment(appointmentId, reason)` - Cancel
- `getAppointmentById(appointmentId)` - Get details
- `getPatientAppointments(patientId, status)` - Get patient's appointments
- `getDoctorAppointmentsForDate(doctorId, date)` - Get doctor's schedule
- `updateAppointmentStatus(appointmentId, status)` - Update status

#### ConversationSessionService
- `getOrCreateSession(organizationId, patientPhone)` - Get or create with Redis caching
- `getSessionById(sessionId)` - Get session
- `updateSessionState(sessionId, stateUpdates)` - Update state
- `endSession(sessionId)` - End session
- `storeTempContext(organizationId, patientPhone, contextData, ttlSeconds)` - Temp Redis storage
- `getTempContext(organizationId, patientPhone)` - Retrieve temp context

#### InteractionLogger
- `logMessage(organizationId, patientId, channel, direction, payload, externalMessageId)` - Log message
- `logCall(organizationId, patientId, callSid, status, startTime, callMetadata)` - Log call
- `updateCallEnd(callLogId, endTime, durationSeconds, transcription, summary)` - Update call
- `getRecentMessages(patientId, limit)` - Get messages
- `getRecentCalls(patientId, limit)` - Get calls
- `getMessagesByChannel(organizationId, channel, limit)` - Filter by channel
- `getCallStatistics(organizationId, startDate, endDate)` - Call metrics
- `exportPatientHistory(patientId)` - Export history

### 2. REST API Endpoints (25 total)

All endpoints require JWT authentication:

**Clinic Branches (2)**
- `GET /patientflow/api/branches` - List all branches
- `GET /patientflow/api/branches/:branchId` - Get branch details

**Doctors (3)**
- `GET /patientflow/api/doctors` - Search/list doctors
- `GET /patientflow/api/doctors/:doctorId` - Get doctor details
- `GET /patientflow/api/doctors/:doctorId/availability` - Get availability slots

**Patients (6)**
- `GET /patientflow/api/patients/lookup?phone=...` - Lookup by phone
- `POST /patientflow/api/patients` - Create new patient
- `GET /patientflow/api/patients/:patientId` - Get profile with history
- `PUT /patientflow/api/patients/:patientId` - Update patient
- `GET /patientflow/api/patients/:patientId/preferences` - Get preferences
- `PUT /patientflow/api/patients/:patientId/preferences` - Update preferences

**Appointments (5)**
- `POST /patientflow/api/appointments` - Book appointment (409 on conflict)
- `GET /patientflow/api/appointments/:appointmentId` - Get appointment
- `PUT /patientflow/api/appointments/:appointmentId/reschedule` - Reschedule
- `DELETE /patientflow/api/appointments/:appointmentId` - Cancel
- `GET /patientflow/api/patients/:patientId/appointments` - Get patient's appointments

**Interactions (4)**
- `GET /patientflow/api/patients/:patientId/messages?limit=20` - Get messages
- `GET /patientflow/api/patients/:patientId/calls?limit=20` - Get calls
- `POST /patientflow/api/interactions/log-message` - Log message
- `POST /patientflow/api/interactions/log-call` - Log call

**Conversation Sessions (4)**
- `POST /patientflow/api/sessions` - Create/get session
- `GET /patientflow/api/sessions/:sessionId` - Get session
- `PUT /patientflow/api/sessions/:sessionId/state` - Update state
- `DELETE /patientflow/api/sessions/:sessionId` - End session

### 3. Validation

All endpoints validate request bodies using Zod schemas:
- `phoneSchema` - Phone number validation
- `patientSchema` - Patient creation/update
- `appointmentBookingSchema` - Appointment booking
- `doctorSearchSchema` - Doctor search filters
- `messageLogSchema` - Message logging
- `callLogSchema` - Call logging
- And more...

### 4. Double-Booking Prevention

The AppointmentService implements strict double-booking prevention:

```javascript
// Inside bookAppointment() method (lines 47-67):
const result = await this.prisma.$transaction(async (tx) => {
  // Check for conflicts within transaction
  const hasConflict = await tx.appointment.findMany({
    where: {
      doctorId,
      status: { in: ['BOOKED', 'CONFIRMED'] },
      OR: [{
        startTime: { lt: new Date(endTime) },
        endTime: { gt: new Date(startTime) },
      }],
    },
  });

  if (hasConflict.length > 0) {
    throw new Error('Appointment slot is already booked');
  }
  
  // ... create appointment ...
});
```

**Implementation Details:**
- Prisma transactions ensure atomic operations
- Overlapping time detection: `startTime < endTime AND endTime > startTime`
- Only checks BOOKED and CONFIRMED appointments (ignores CANCELLED)
- Returns HTTP 409 Conflict on duplicate booking attempt
- Test case: `should throw error when booking conflicting appointment`

### 5. Database Models

Uses existing Prisma models (defined in PR #4):
- `ClinicBranch` - Clinic locations
- `Doctor` - Provider details
- `DoctorSchedule` - Availability slots
- `Patient` - Patient information
- `PatientPreference` - Preferences
- `PatientNote` - Clinical notes
- `Appointment` - Appointment records
- `PatientMessageLog` - Message interactions
- `PatientCallLog` - Call interactions
- `ConversationSession` - Session state

### 6. Seeding

The seed.js now includes complete PatientFlow demo data:
- **1 Clinic Branch**: Main Clinic Branch in Portland
- **2 Doctors**: 
  - Sarah Johnson (Cardiology)
  - Michael Chen (General Practice)
- **Doctor Schedules**: Mon-Sat 9-5 (or 9-6), split lunch
- **2 Patients**:
  - John Smith (M, Penicillin allergy)
  - Mary Johnson (F, opted-out of SMS)
- **Patient Preferences**: Customized by patient
- **1 Appointment**: 5 days from seed date
- **Message Logs**: WhatsApp inbound/outbound
- **Call Logs**: Completed call with transcription
- **Conversation Session**: Active booking session

## Migration Steps

### Option 1: Direct Clone with Patches (Recommended)

```bash
# 1. Clone the medicalAIDemo repository
cd /tmp
git clone https://github.com/ssvgopal/medicalAIDemo.git
cd medicalAIDemo

# 2. Create a new branch for the PatientFlow PR
git checkout -b feat/patientflow-services-routes-validation-booking

# 3. Apply the patches (located in /tmp/patches/)
# Copy the patches to a local directory first
git am /path/to/0001-feat-patientflow-implement-PatientFlow-services-vali.patch
git am /path/to/0002-feat-patientflow-implement-core-PatientFlow-services.patch

# 4. Verify the changes
git log --oneline -3
git diff HEAD~2..HEAD --stat

# 5. Create a pull request
# Push to your fork and create PR on GitHub
git push origin feat/patientflow-services-routes-validation-booking
```

### Option 2: Manual File Copying

If you prefer to manually transfer files:

1. **Copy all new files** from `/home/engine/project/modern-orchestrall/src/patientflow/` to the medicalAIDemo repo
2. **Update package.json** with the db:seed changes
3. **Update app-commercial.js** with PatientFlow route registration
4. **Update prisma/seed.js** with PatientFlow seeding data
5. Commit with message: `feat(patientflow): implement core services, routes, validation, and seeding`

### Option 3: Merge Directly from Current Repo

If you have repository access:

```bash
cd medicalAIDemo
git remote add orchestrall /home/engine/project
git fetch orchestrall merge-finalize-patient-services-pr7
git checkout -b feat/patientflow-services-routes-validation-booking
git merge --no-ff orchestrall/merge-finalize-patient-services-pr7
```

## Verification Checklist

After migrating to medicalAIDemo, verify:

- [ ] All 11 new files created in `src/patientflow/`
- [ ] Test files added to `tests/unit/`
- [ ] package.json updated with db:seed and prisma config
- [ ] app-commercial.js registers PatientFlow routes (lines 1393-1394)
- [ ] prisma/seed.js includes PatientFlow demo data
- [ ] Prisma schema has all models: ClinicBranch, Doctor, Patient, Appointment, etc.
- [ ] All 5 enums present: AppointmentStatus, AppointmentSource, etc.
- [ ] Unit tests pass (if applicable): `npm test -- tests/unit/patientflow-*.test.js`
- [ ] Documentation: README.md in src/patientflow/ has 410+ lines
- [ ] Seed runs without errors: `npm run db:seed`

## Test Coverage

**Unit Tests Included:**
- `patientflow-services.test.js` - 411 lines, tests all services
  - PatientService: lookup, create, update, preferences
  - DoctorService: branches, doctors, availability
  - AppointmentService: **double-booking conflict detection**
  - InteractionLogger: messages, calls
  
- `patientflow-validation.test.js` - 306 lines, validates schemas
  - Phone schema validation
  - Patient schema validation
  - Appointment schema validation
  - All 13 schemas tested

**Key Double-Booking Test:**
```javascript
test('should throw error when booking conflicting appointment', async () => {
  const existingAppointment = { id: 'apt-1', status: 'BOOKED' };
  prisma.$transaction.mockImplementation(async (callback) => {
    const txMock = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([existingAppointment]),
      },
    };
    return callback(txMock);
  });
  
  await expect(
    appointmentService.bookAppointment('org-1', {
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      startTime: '2024-12-15T09:00:00',
      endTime: '2024-12-15T10:00:00',
    })
  ).rejects.toThrow('Appointment slot is already booked');
});
```

## Package Configuration

**Changes to package.json:**
```json
{
  "scripts": {
    "db:seed": "npx prisma db seed"  // Changed from "node src/seed.js"
  },
  "prisma": {
    "seed": "node prisma/seed.js"     // New configuration
  }
}
```

## Integration

The PatientFlow routes are registered in `app-commercial.js`:
```javascript
// Line 1393-1394
const patientFlowRoutes = require('./patientflow/routes');
app.register(patientFlowRoutes, { prisma: database.client, redis: cacheService.redis });
```

This automatically:
- Registers all 25 REST endpoints
- Passes Prisma client for database access
- Passes Redis client for optional session caching
- Inherits JWT authentication middleware
- Auto-generates Swagger/OpenAPI docs

## Performance Notes

- **Database Indexes**: All critical queries indexed (doctorId, patientId, startTime, status)
- **Transactions**: Used for appointment booking consistency
- **Redis Caching**: Optional, for conversation session fast retrieval (1-hour TTL)
- **Batch Operations**: Doctor availability supports batch queries
- **Pagination**: List endpoints support limit/offset

## Security Considerations

- ✅ All endpoints require JWT authentication
- ✅ OrganizationId validated from JWT context
- ✅ All inputs validated with Zod
- ✅ SQL injection prevented via Prisma ORM
- ✅ Patient data scoped to organization
- ✅ Transactional consistency for booking

## Documentation

Complete API documentation available in `src/patientflow/README.md` including:
- Architecture overview
- Service descriptions with all methods
- REST endpoint reference
- Validation schema details
- Data model specifications
- Example usage code
- Testing instructions
- Security considerations

## Commit Message Template

```
feat(patientflow): implement core services, routes, validation, and seeding

Merges comprehensive PatientFlow module implementing essential healthcare
services and Fastify REST endpoints for patient, doctor, scheduling, and
conversational session management.

Implements:
- 5 domain services (Patient, Doctor, Appointment, ConversationSession, InteractionLogger)
- 25 REST API endpoints with JWT authentication
- Zod validation schemas for all request payloads
- Double-booking prevention via Prisma transactions
- Optional Redis caching for conversation sessions
- Comprehensive seeding (branches, doctors, patients, appointments)

Key Features:
- BookAppointment prevents conflicts with transactional checks
- Doctor availability calculated from schedules with slot generation
- Session state management with Redis caching (1-hour TTL)
- Complete API documentation with examples

Changes:
- 11 new files in src/patientflow/ and tests/unit/
- Updated package.json for prisma-based seeding
- Updated app-commercial.js to register routes
- Extended prisma/seed.js with PatientFlow demo data

Closes: #[PR_NUMBER]
```

## Support & Questions

For questions or issues during migration:
1. Review the patientflow/README.md for API details
2. Check the service classes for implementation details
3. Run unit tests to verify functionality
4. Examine the seeding script for demo data structure

---

**PR Status**: Ready for production merge
**Branch**: merge-finalize-patient-services-pr7
**Base**: main
**Commits**: 2 (original implementation + seed fixes)
**Lines Added**: 3,641
**Test Coverage**: Complete with double-booking tests
