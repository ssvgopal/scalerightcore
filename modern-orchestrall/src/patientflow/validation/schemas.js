const { z } = require('zod');

// Phone number validation
const phoneSchema = z.string()
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, 'Invalid phone number format');

// Patient creation/update schema
const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: phoneSchema,
  email: z.string().email('Invalid email format').optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'Other']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: phoneSchema.optional(),
  bloodType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  phoneOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
});

// Patient lookup by phone
const patientLookupSchema = z.object({
  phone: phoneSchema,
});

// Patient preference schema
const patientPreferenceSchema = z.object({
  preferredLanguage: z.string().optional(),
  preferredTimeSlots: z.array(z.string()).optional(),
  reminderPreference: z.enum(['24h', '48h', '1week', 'none']).optional(),
  preferredChannels: z.array(z.enum(['phone', 'email', 'sms', 'whatsapp'])).optional(),
  doNotCallBefore: z.string().optional(),
  doNotCallAfter: z.string().optional(),
});

// Appointment booking schema
const appointmentBookingSchema = z.object({
  patientId: z.string().cuid('Invalid patient ID'),
  doctorId: z.string().cuid('Invalid doctor ID'),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format'),
  source: z.enum(['WHATSAPP', 'VOICE', 'MANUAL']).optional(),
  channel: z.enum(['WHATSAPP', 'VOICE']).optional(),
  reason: z.string().optional(),
  internalNotes: z.string().optional(),
});

// Appointment reschedule schema
const appointmentRescheduleSchema = z.object({
  appointmentId: z.string().cuid('Invalid appointment ID'),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format'),
  reason: z.string().optional(),
});

// Appointment cancellation schema
const appointmentCancellationSchema = z.object({
  appointmentId: z.string().cuid('Invalid appointment ID'),
  reason: z.string().optional(),
  notifyPatient: z.boolean().optional(),
});

// Availability query schema
const availabilityQuerySchema = z.object({
  doctorId: z.string().cuid('Invalid doctor ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  durationMinutes: z.number().int().positive().optional(),
});

// Doctor search schema
const doctorSearchSchema = z.object({
  branchId: z.string().cuid('Invalid branch ID').optional(),
  specialty: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

// Message log schema
const messageLogSchema = z.object({
  patientId: z.string().cuid('Invalid patient ID'),
  channel: z.enum(['WHATSAPP', 'VOICE']),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  payload: z.record(z.any()),
  externalMessageId: z.string().optional(),
});

// Call log schema
const callLogSchema = z.object({
  patientId: z.string().cuid('Invalid patient ID'),
  callSid: z.string(),
  status: z.enum(['INITIATED', 'RINGING', 'ANSWERED', 'COMPLETED', 'FAILED', 'MISSED']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  transcription: z.string().optional(),
  summary: z.string().optional(),
});

// Conversation session schema
const conversationSessionSchema = z.object({
  patientPhone: phoneSchema,
  sessionKey: z.string(),
  stateJson: z.record(z.any()).optional(),
});

module.exports = {
  phoneSchema,
  patientSchema,
  patientLookupSchema,
  patientPreferenceSchema,
  appointmentBookingSchema,
  appointmentRescheduleSchema,
  appointmentCancellationSchema,
  availabilityQuerySchema,
  doctorSearchSchema,
  messageLogSchema,
  callLogSchema,
  conversationSessionSchema,
};
