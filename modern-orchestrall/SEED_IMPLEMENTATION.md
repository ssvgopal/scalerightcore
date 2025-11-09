# PatientFlow Seed Implementation

## Overview
The Prisma seed script has been expanded to populate comprehensive PatientFlow demo data with realistic clinic operations, patient management, and appointment scheduling scenarios.

## Seed Data Structure

### 1. Clinic Branches (8 records)
- **Location**: Major US cities (New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Diego, Miami Beach)
- **Data Includes**:
  - Full addresses with postal codes
  - Realistic operating hours (JSON format)
  - Phone and email contact information
  - Geographic coordinates (latitude/longitude)

### 2. Doctors (8 records)
- **Specialties**: Cardiology, Internal Medicine, Pediatrics, Orthopedics, Dermatology, General Practice, Neurology, Family Medicine
- **Data Includes**:
  - Unique email addresses
  - Phone numbers
  - License numbers
  - Medical qualifications
  - Language capabilities (multilingual support)
  - Tied to clinic branches

### 3. Doctor Schedules (40 records - 5 per doctor)
- **Schedule**: Monday through Friday availability
- **Data Includes**:
  - 30-minute appointment slots
  - Operating hours (8am-6pm range)
  - Slot configuration for scheduling

### 4. Patients (50 records)
- **Demographics**:
  - Diverse first/last names
  - Random birthdates (1940-2005)
  - Gender distribution
  - Contact information (phone, email)
  
- **Medical History**:
  - Blood types
  - Known allergies
  - Chronic conditions
  - Emergency contact information

- **Communication Preferences**:
  - Phone, email, SMS, WhatsApp opt-ins
  - Preferred languages
  - Communication channel preferences

### 5. Patient Preferences (50 records - one per patient)
- **Data Includes**:
  - Preferred time slots (morning/afternoon/evening)
  - Reminder preferences (24h/48h/1 week)
  - Communication channel preferences
  - Do-not-call times

### 6. Patient Notes (varied - 1-4 per patient)
- **Types**: Clinical, administrative, follow-up, reminder
- **Content**: Realistic clinical and administrative notes
- **Privacy**: Mix of private and public notes

### 7. Appointments (40 total records)
- **Future Appointments**: 30 records (1-30 days from now)
  - Status: BOOKED or CONFIRMED
  - Reasons: Checkups, consultations, referrals, urgent care, etc.
  - Mix of communication channels (Voice, WhatsApp)
  
- **Past Appointments**: 10 records (1-30 days ago)
  - Status: COMPLETED, CANCELLED, NO_SHOW
  - Demonstrates reschedule scenarios
  - Notes about previous interactions

### 8. Patient Message Logs (20 records)
- **Channels**: WhatsApp, Voice
- **Direction**: Inbound/Outbound
- **Scenarios**:
  - New patient booking requests
  - Appointment confirmations
  - Insurance questions
  - Medication refills
  - Medical records requests

### 9. Patient Call Logs (15 records)
- **Status**: COMPLETED, MISSED, FAILED
- **Scenarios**:
  - Appointment scheduling calls
  - Prescription refill requests
  - Test result discussions
  - Rescheduling coordination
  - Insurance coverage inquiries

## Idempotency Strategy

The seed script is fully idempotent using the following patterns:

### Pattern 1: Upsert with Unique Constraints
- **Patients**: Uses `(organizationId, phone)` unique constraint
- **DoctorSchedule**: Uses `(doctorId, dayOfWeek)` unique constraint
- **PatientPreference**: Uses `patientId` unique constraint

### Pattern 2: Find-First + Create-or-Update
- **ClinicBranch**: Checks existence by name+organization
- **Doctor**: Checks existence by email
- **Agent & Workflow**: Checks existence by name+organization

### Pattern 3: Count-Based Append
- **Appointments**: Counts existing records before creating
- **MessageLogs**: Counts existing records before creating
- **CallLogs**: Counts existing records before creating

## Helper Utilities

All utilities are embedded in the seed file with no external dependencies:

```javascript
const helpers = {
  randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  randomFloat: (min, max) => Math.random() * (max - min) + min,
  randomDate: (start, end) => new Date(...),
  randomPhone: () => '+1${...}',
  randomEmail: (firstName, lastName) => '${...}@example.com',
};
```

## Running the Seed

### First Time Setup
```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Execute seed
npm run db:seed
```

### Re-running Seed (Idempotent)
```bash
# Simply re-run - no duplicates will be created
npm run db:seed
```

### Reset Database
```bash
# Reset all data and re-migrate
npx prisma migrate reset --force

# Then seed again
npm run db:seed
```

## Expected Output

First run:
```
✅ Created clinic branch: Downtown Medical Center
...
✅ Created doctor: Sarah Johnson (Cardiology)
...
✅ Created 50 patients
✅ Created patient preferences
✅ Created patient notes
✅ Created appointments (30 future, 10 past)
✅ Created 20 patient message logs
✅ Created 15 patient call logs
```

Subsequent runs:
```
✅ Updated clinic branch: Downtown Medical Center
...
✅ Already have 50 patients
✅ Already have appointments (30 future, 10 past)
✅ Already have 20 patient message logs
✅ Already have 15 patient call logs
```

## Acceptance Criteria Met

✅ 8 ClinicBranch records with realistic addresses/timezones/operating hours
✅ 8 Doctors tied to branches with specialties
✅ Weekly DoctorSchedule rows per doctor (5 days × 8 doctors = 40 records)
✅ 50 Patients with varied preferences/notes
✅ 30 future Appointment records with BOOKED/CONFIRMED statuses
✅ 10 past Appointment records for reschedule narratives
✅ 20 PatientMessageLog records demonstrating demo flows
✅ 15 PatientCallLog records with call scenarios
✅ Seed logic is idempotent - re-runnable without duplication
✅ Sample logs reference seeded patients/doctors
✅ Demo flow paths demonstrated (booking, preferences, reschedule)
✅ Lightweight helper utilities (no external dependencies)
