// src/seed-patientflow.js - Seed script for PatientFlow demo data
const { PrismaClient } = require('@prisma/client');
const faker = require('@faker-js/faker').default;

const prisma = new PrismaClient();

// Demo organization ID (you can change this)
const DEMO_ORGANIZATION_ID = 'demo-org-123';

// Demo data
const demoClinics = [
  {
    id: 'clinic-1',
    name: 'City Medical Center',
    address: '123 Main St, City, State 12345',
    phone: '+1-555-0123',
    email: 'info@citymedical.com',
    operatingHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '18:00' },
      saturday: { open: '09:00', close: '14:00' },
      sunday: { closed: true }
    }
  },
  {
    id: 'clinic-2',
    name: 'Downtown Health Clinic',
    address: '456 Oak Ave, City, State 12345',
    phone: '+1-555-0456',
    email: 'contact@downtownhealth.com',
    operatingHours: {
      monday: { open: '07:00', close: '20:00' },
      tuesday: { open: '07:00', close: '20:00' },
      wednesday: { open: '07:00', close: '20:00' },
      thursday: { open: '07:00', close: '20:00' },
      friday: { open: '07:00', close: '20:00' },
      saturday: { open: '08:00', close: '16:00' },
      sunday: { closed: true }
    }
  }
];

const demoDoctors = [
  {
    id: 'doctor-1',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@clinic.com',
    phone: '+1-555-0101',
    specialization: 'General Practice',
    licenseNumber: 'MD123456',
    organizationId: DEMO_ORGANIZATION_ID
  },
  {
    id: 'doctor-2',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@clinic.com',
    phone: '+1-555-0102',
    specialization: 'Cardiology',
    licenseNumber: 'MD789012',
    organizationId: DEMO_ORGANIZATION_ID
  },
  {
    id: 'doctor-3',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.rodriguez@clinic.com',
    phone: '+1-555-0103',
    specialization: 'Pediatrics',
    licenseNumber: 'MD345678',
    organizationId: DEMO_ORGANIZATION_ID
  }
];

const demoPatients = Array.from({ length: 20 }, (_, i) => ({
  id: `patient-${i + 1}`,
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  phone: faker.phone.number(),
  email: faker.internet.email(),
  dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }).toISOString(),
  address: faker.location.streetAddress(),
  emergencyContact: {
    name: faker.person.fullName(),
    phone: faker.phone.number(),
    relationship: faker.helpers.arrayElement(['Spouse', 'Parent', 'Sibling', 'Friend'])
  },
  organizationId: DEMO_ORGANIZATION_ID
}));

const messageTemplates = [
  'Hi, I need to schedule an appointment',
  'Can I reschedule my appointment for tomorrow?',
  'What are your clinic hours?',
  'I need a refill for my prescription',
  'Is Dr. {doctor} available this week?',
  'I have some questions about my test results',
  'Do you accept my insurance?',
  'I need to cancel my appointment',
  'Can I get a copy of my medical records?',
  'What should I bring for my first visit?'
];

const callSummaries = [
  'Patient called to schedule a routine checkup',
  'Inquiry about insurance coverage for specific procedure',
  'Patient requesting prescription refill',
  'Call to confirm upcoming appointment',
  'Patient reporting symptoms and seeking advice',
  'Follow-up call after recent visit',
  'Billing and payment related inquiry',
  'Emergency consultation - patient advised to visit ER'
];

async function seedPatientFlow() {
  console.log('🌱 Starting PatientFlow demo data seeding...');

  try {
    // Clear existing demo data
    console.log('🧹 Clearing existing demo data...');
    await prisma.patientMessageLog.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.patientCallLog.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.appointment.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.patientPreference.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.patientNote.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.patient.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.doctorSchedule.deleteMany({
      where: { doctorId: { in: demoDoctors.map(d => d.id) } }
    });
    await prisma.doctor.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });
    await prisma.clinicBranch.deleteMany({
      where: { organizationId: DEMO_ORGANIZATION_ID }
    });

    // Create clinics
    console.log('🏥 Creating clinics...');
    for (const clinic of demoClinics) {
      await prisma.clinicBranch.create({
        data: {
          ...clinic,
          organizationId: DEMO_ORGANIZATION_ID
        }
      });
    }

    // Create doctors
    console.log('👨‍⚕️ Creating doctors...');
    for (const doctor of demoDoctors) {
      await prisma.doctor.create({
        data: doctor
      });
    }

    // Create doctor schedules
    console.log('📅 Creating doctor schedules...');
    for (const doctor of demoDoctors) {
      const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      for (const day of daysOfWeek) {
        await prisma.doctorSchedule.create({
          data: {
            doctorId: doctor.id,
            dayOfWeek,
            startTime: '09:00',
            endTime: '17:00',
            isAvailable: Math.random() > 0.2, // 80% availability
            maxAppointments: Math.floor(Math.random() * 10) + 15,
            organizationId: DEMO_ORGANIZATION_ID
          }
        });
      }
    }

    // Create patients
    console.log('👥 Creating patients...');
    for (const patient of demoPatients) {
      await prisma.patient.create({
        data: patient
      });
    }

    // Create patient preferences
    console.log('⚙️ Creating patient preferences...');
    for (const patient of demoPatients) {
      await prisma.patientPreference.create({
        data: {
          patientId: patient.id,
          preferredCommunicationChannel: faker.helpers.arrayElement(['WHATSAPP', 'SMS', 'EMAIL']),
          preferredLanguage: 'ENGLISH',
          appointmentReminders: true,
          marketingConsent: Math.random() > 0.5,
          organizationId: DEMO_ORGANIZATION_ID
        }
      });
    }

    // Create appointments
    console.log('📆 Creating appointments...');
    const appointmentStatuses = ['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
    const appointmentSources = ['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL'];
    
    for (let i = 0; i < 50; i++) {
      const scheduledStart = faker.date.between({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)  // 14 days from now
      });
      
      const scheduledEnd = new Date(scheduledStart.getTime() + (30 + Math.random() * 60) * 60 * 1000); // 30-90 minutes
      
      await prisma.appointment.create({
        data: {
          patientId: faker.helpers.arrayElement(demoPatients).id,
          doctorId: faker.helpers.arrayElement(demoDoctors).id,
          status: faker.helpers.arrayElement(appointmentStatuses),
          source: faker.helpers.arrayElement(appointmentSources),
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          notes: faker.lorem.sentences(1),
          organizationId: DEMO_ORGANIZATION_ID
        }
      });
    }

    // Create messages
    console.log('💬 Creating messages...');
    const channels = ['WHATSAPP', 'SMS', 'EMAIL'];
    const directions = ['INBOUND', 'OUTBOUND'];
    
    for (let i = 0; i < 100; i++) {
      const createdAt = faker.date.between({
        from: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        to: new Date()
      });
      
      await prisma.patientMessageLog.create({
        data: {
          patientId: faker.helpers.arrayElement(demoPatients).id,
          content: faker.helpers.arrayElement(messageTemplates).replace('{doctor}', faker.helpers.arrayElement(demoDoctors).firstName),
          direction: faker.helpers.arrayElement(directions),
          channel: faker.helpers.arrayElement(channels),
          createdAt: createdAt.toISOString(),
          channelMetadata: {
            messageId: faker.string.uuid(),
            delivered: Math.random() > 0.1,
            read: Math.random() > 0.3
          },
          organizationId: DEMO_ORGANIZATION_ID
        }
      });
    }

    // Create call logs
    console.log('📞 Creating call logs...');
    const callStatuses = ['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];
    
    for (let i = 0; i < 60; i++) {
      const createdAt = faker.date.between({
        from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        to: new Date()
      });
      
      const duration = Math.floor(Math.random() * 1800); // 0-30 minutes in seconds
      
      await prisma.patientCallLog.create({
        data: {
          patientId: faker.helpers.arrayElement(demoPatients).id,
          direction: faker.helpers.arrayElement(directions),
          status: faker.helpers.arrayElement(callStatuses),
          duration: duration > 0 ? duration : undefined,
          summary: faker.helpers.arrayElement(callSummaries),
          transcript: duration > 60 ? faker.lorem.paragraphs(2) : undefined,
          createdAt: createdAt.toISOString(),
          organizationId: DEMO_ORGANIZATION_ID
        }
      });
    }

    // Create some patient notes
    console.log('📝 Creating patient notes...');
    for (let i = 0; i < 30; i++) {
      await prisma.patientNote.create({
        data: {
          patientId: faker.helpers.arrayElement(demoPatients).id,
          note: faker.lorem.sentences(2),
          type: 'GENERAL',
          createdAt: faker.date.between({
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            to: new Date()
          }).toISOString(),
          organizationId: DEMO_ORGANIZATION_ID
        }
      });
    }

    console.log('✅ PatientFlow demo data seeding completed successfully!');
    console.log(`📊 Created:
    - ${demoClinics.length} clinics
    - ${demoDoctors.length} doctors
    - ${demoPatients.length} patients
    - 50 appointments
    - 100 messages
    - 60 call logs
    - 30 patient notes`);

  } catch (error) {
    console.error('❌ Error seeding PatientFlow data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedPatientFlow()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedPatientFlow, DEMO_ORGANIZATION_ID };