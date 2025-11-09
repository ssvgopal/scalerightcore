// tests/patientflow/fixtures.js - Test fixtures for PatientFlow tests

// Organization fixture
const organization = {
  id: 'org_12345678901234567890123456789012',
  name: 'Test Clinic',
  slug: 'test-clinic',
  tier: 'professional',
  status: 'active',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Clinic branch fixture
const clinicBranch = {
  id: 'clinic_12345678901234567890123456789012',
  organizationId: organization.id,
  name: 'Main Clinic',
  address: '123 Main St, City, State 12345',
  phone: '+1234567890',
  email: 'contact@testclinic.com',
  operatingHours: {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '09:00', close: '13:00' },
    sunday: { open: null, close: null }
  },
  timezone: 'America/New_York',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Doctor fixture
const doctor = {
  id: 'doctor_12345678901234567890123456789012',
  organizationId: organization.id,
  clinicBranchId: clinicBranch.id,
  firstName: 'John',
  lastName: 'Smith',
  specialization: 'General Practice',
  phone: '+1234567891',
  email: 'dr.smith@testclinic.com',
  licenseNumber: 'MD123456',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Doctor schedule fixture
const doctorSchedule = {
  id: 'schedule_12345678901234567890123456789012',
  doctorId: doctor.id,
  organizationId: organization.id,
  dayOfWeek: 1, // Monday
  isAvailable: true,
  operatingHours: {
    start: '09:00',
    end: '17:00'
  },
  slotDuration: 30,
  maxPatientsPerDay: 20,
  breakTimes: [
    { start: '12:00', end: '13:00' }
  ],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Patient fixture
const patient = {
  id: 'patient_12345678901234567890123456789012',
  organizationId: organization.id,
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+12345678900',
  email: 'jane.doe@email.com',
  dateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
  address: '456 Oak St, City, State 12345',
  emergencyContact: {
    name: 'John Doe',
    phone: '+12345678901',
    relationship: 'Spouse'
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Patient preferences fixture
const patientPreferences = {
  id: 'pref_12345678901234567890123456789012',
  patientId: patient.id,
  organizationId: organization.id,
  preferredLanguage: 'english',
  preferredCommunicationChannel: 'whatsapp',
  appointmentReminders: true,
  workingHours: {
    start: '08:00',
    end: '18:00'
  },
  metadata: {
    timezone: 'America/New_York',
    notificationPreferences: {
      email: true,
      sms: true,
      whatsapp: true
    }
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Appointment fixture
const appointment = {
  id: 'apt_12345678901234567890123456789012',
  organizationId: organization.id,
  patientId: patient.id,
  doctorId: doctor.id,
  status: 'BOOKED',
  source: 'WHATSAPP',
  channel: 'whatsapp',
  startTime: new Date('2024-12-15T10:00:00.000Z'),
  endTime: new Date('2024-12-15T10:30:00.000Z'),
  notes: 'Regular checkup',
  metadata: {
    bookingSource: 'conversation',
    originalRequest: 'I want to book an appointment'
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Conversation session fixture
const conversationSession = {
  id: 'session_12345678901234567890123456789012',
  organizationId: organization.id,
  patientId: patient.id,
  channel: 'whatsapp',
  status: 'active',
  stateJson: {
    lastIntent: 'book_appointment',
    step: 'collecting_preferences'
  },
  metadata: {
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    lastActivity: new Date('2024-01-01T00:05:00.000Z'),
    messageCount: 3
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:05:00.000Z')
};

// Message log fixture
const messageLog = {
  id: 'msg_12345678901234567890123456789012',
  organizationId: organization.id,
  patientId: patient.id,
  channel: 'whatsapp',
  direction: 'inbound',
  content: 'I want to book an appointment for tomorrow',
  externalMessageId: 'whatsapp_msg_123',
  status: 'processed',
  metadata: {
    intent: {
      type: 'book_appointment',
      confidence: 0.95,
      parameters: {
        preferredDate: '2024-12-16'
      }
    },
    response: 'Appointment confirmed for tomorrow at 10:00 AM'
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Call log fixture
const callLog = {
  id: 'call_12345678901234567890123456789012',
  organizationId: organization.id,
  patientId: patient.id,
  callSid: 'CA12345678901234567890123456789012',
  status: 'completed',
  direction: 'inbound',
  duration: 180,
  recordingUrl: 'https://api.twilio.com/recording.mp3',
  transcription: 'I want to reschedule my appointment',
  metadata: {
    intent: 'reschedule_appointment',
    confidence: 0.88
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
};

// Available slots fixture
const availableSlots = [
  {
    startTime: new Date('2024-12-16T09:00:00.000Z'),
    endTime: new Date('2024-12-16T09:30:00.000Z'),
    available: true
  },
  {
    startTime: new Date('2024-12-16T09:30:00.000Z'),
    endTime: new Date('2024-12-16T10:00:00.000Z'),
    available: true
  },
  {
    startTime: new Date('2024-12-16T10:30:00.000Z'),
    endTime: new Date('2024-12-16T10:30:00.000Z'),
    available: true
  },
  {
    startTime: new Date('2024-12-16T11:00:00.000Z'),
    endTime: new Date('2024-12-16T11:30:00.000Z'),
    available: true
  }
];

// WhatsApp webhook payload fixture
const whatsappWebhookPayload = {
  From: '+12345678900',
  To: '+12345678999',
  Body: 'I want to book an appointment for tomorrow',
  MessageSid: 'WA_TEST_MESSAGE_SID_12345',
  NumMedia: 0,
  AccountSid: 'AC_TEST_ACCOUNT_SID_12345',
  ApiVersion: '2010-04-01'
};

// Voice webhook payload fixture
const voiceWebhookPayload = {
  From: '+12345678900',
  To: '+12345678999',
  CallSid: 'CA_TEST_CALL_SID_12345',
  CallStatus: 'ringing',
  AccountSid: 'AC_TEST_ACCOUNT_SID_12345',
  ApiVersion: '2010-04-01',
  Direction: 'inbound'
};

// Voice speech result payload fixture
const voiceSpeechPayload = {
  From: '+12345678900',
  To: '+12345678999',
  CallSid: 'CA_TEST_CALL_SID_SPEECH_123',
  SpeechResult: 'I want to cancel my appointment',
  Confidence: 0.92,
  AccountSid: 'AC_TEST_ACCOUNT_SID_12345',
  ApiVersion: '2010-04-01'
};

// Test scenarios
const testScenarios = {
  newPatientBooking: {
    description: 'New patient booking appointment via WhatsApp',
    input: {
      message: 'Hi, I want to book my first appointment',
      phone: '+12345678900',
      isNewPatient: true
    },
    expectedIntent: 'book_appointment',
    expectedActions: ['create_patient', 'create_appointment', 'send_confirmation']
  },
  existingPatientReschedule: {
    description: 'Existing patient rescheduling appointment',
    input: {
      message: 'I need to move my appointment to tomorrow',
      phone: '+12345678900',
      isNewPatient: false
    },
    expectedIntent: 'reschedule_appointment',
    expectedActions: ['find_appointment', 'generate_slots', 'reschedule_appointment', 'send_confirmation']
  },
  cancelAppointment: {
    description: 'Patient cancelling appointment',
    input: {
      message: 'Cancel my appointment',
      phone: '+12345678900',
      isNewPatient: false
    },
    expectedIntent: 'cancel_appointment',
    expectedActions: ['find_appointment', 'cancel_appointment', 'send_cancellation_notice']
  },
  checkAppointments: {
    description: 'Patient checking their appointments',
    input: {
      message: 'When are my appointments?',
      phone: '+12345678900',
      isNewPatient: false
    },
    expectedIntent: 'check_appointments',
    expectedActions: ['fetch_appointments', 'format_appointment_list']
  }
};

module.exports = {
  organization,
  clinicBranch,
  doctor,
  doctorSchedule,
  patient,
  patientPreferences,
  appointment,
  conversationSession,
  messageLog,
  callLog,
  availableSlots,
  whatsappWebhookPayload,
  voiceWebhookPayload,
  voiceSpeechPayload,
  testScenarios
};