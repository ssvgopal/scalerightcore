const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default organization
  const organization = await prisma.organization.upsert({
    where: { slug: 'orchestrall-demo' },
    update: {},
    create: {
      name: 'Orchestrall Demo Organization',
      slug: 'orchestrall-demo',
      tier: 'enterprise',
      status: 'active',
    },
  });

  console.log('✅ Created organization:', organization.name);

  // Create default admin user
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@orchestrall.com' },
    update: {},
    create: {
      email: 'admin@orchestrall.com',
      name: 'Admin User',
      password: hashedPassword,
      organizationId: organization.id,
      status: 'active',
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create default agents
  const agents = [
    {
      name: 'Text Processor',
      description: 'Content analysis, reading time estimation, and text processing',
      type: 'specialist',
      framework: 'openai',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['content_analysis', 'reading_time', 'text_summarization', 'sentiment_analysis'],
        model: 'gpt-4',
        temperature: 0.3,
      },
      capabilities: ['content_analysis', 'reading_time', 'text_summarization', 'sentiment_analysis'],
      status: 'active',
    },
    {
      name: 'Calculator',
      description: 'Safe mathematical operations and calculations',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['arithmetic', 'algebra', 'statistics', 'geometry'],
        safeMode: true,
      },
      capabilities: ['arithmetic', 'algebra', 'statistics', 'geometry'],
      status: 'active',
    },
    {
      name: 'Data Validator',
      description: 'Multi-format validation (email, phone, URL, JSON)',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['email_validation', 'phone_validation', 'url_validation', 'json_validation'],
        strictMode: true,
      },
      capabilities: ['email_validation', 'phone_validation', 'url_validation', 'json_validation'],
      status: 'active',
    },
    {
      name: 'File Analyzer',
      description: 'File type detection, content statistics, and analysis',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['file_type_detection', 'content_stats', 'metadata_extraction'],
        maxFileSize: '10MB',
      },
      capabilities: ['file_type_detection', 'content_stats', 'metadata_extraction'],
      status: 'active',
    },
    {
      name: 'JSON Validator',
      description: 'JSON parsing, formatting, and structure analysis',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['json_parsing', 'json_formatting', 'schema_validation'],
        prettyPrint: true,
      },
      capabilities: ['json_parsing', 'json_formatting', 'schema_validation'],
      status: 'active',
    },
    {
      name: 'URL Analyzer',
      description: 'URL parsing, component extraction, and validation',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['url_parsing', 'component_extraction', 'url_validation'],
        followRedirects: false,
      },
      capabilities: ['url_parsing', 'component_extraction', 'url_validation'],
      status: 'active',
    },
    {
      name: 'DateTime Processor',
      description: 'Date parsing, time calculations, and timezone handling',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['date_parsing', 'time_calculations', 'timezone_conversion'],
        defaultTimezone: 'UTC',
      },
      capabilities: ['date_parsing', 'time_calculations', 'timezone_conversion'],
      status: 'active',
    },
    {
      name: 'String Manipulator',
      description: 'Text transformation, case conversion, and string operations',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['text_transformation', 'case_conversion', 'string_operations'],
        preserveWhitespace: false,
      },
      capabilities: ['text_transformation', 'case_conversion', 'string_operations'],
      status: 'active',
    },
    {
      name: 'Number Analyzer',
      description: 'Mathematical properties, prime detection, and number analysis',
      type: 'specialist',
      framework: 'custom',
      organizationId: organization.id,
      createdById: adminUser.id,
      config: {
        capabilities: ['mathematical_properties', 'prime_detection', 'number_analysis'],
        precision: 10,
      },
      capabilities: ['mathematical_properties', 'prime_detection', 'number_analysis'],
      status: 'active',
    },
  ];

  for (const agentData of agents) {
    const agent = await prisma.agent.upsert({
      where: { 
        name_organizationId: {
          name: agentData.name,
          organizationId: organization.id,
        }
      },
      update: {},
      create: agentData,
    });
    console.log(`✅ Created agent: ${agent.name}`);
  }

  // Create default workflows
  const workflows = [
    {
      name: 'Customer Onboarding',
      description: 'Automated customer onboarding workflow',
      organizationId: organization.id,
      createdById: adminUser.id,
      definition: {
        nodes: [
          { id: 'start', type: 'start', next: 'validate' },
          { id: 'validate', type: 'agent', agent: 'Data Validator', next: 'process' },
          { id: 'process', type: 'agent', agent: 'Text Processor', next: 'end' },
          { id: 'end', type: 'end' }
        ],
        edges: [
          { from: 'start', to: 'validate' },
          { from: 'validate', to: 'process' },
          { from: 'process', to: 'end' }
        ]
      },
      status: 'active',
      tags: ['onboarding', 'automation'],
    },
    {
      name: 'Data Processing Pipeline',
      description: 'Multi-step data processing and validation',
      organizationId: organization.id,
      createdById: adminUser.id,
      definition: {
        nodes: [
          { id: 'start', type: 'start', next: 'validate' },
          { id: 'validate', type: 'agent', agent: 'Data Validator', next: 'analyze' },
          { id: 'analyze', type: 'agent', agent: 'Number Analyzer', next: 'format' },
          { id: 'format', type: 'agent', agent: 'JSON Validator', next: 'end' },
          { id: 'end', type: 'end' }
        ],
        edges: [
          { from: 'start', to: 'validate' },
          { from: 'validate', to: 'analyze' },
          { from: 'analyze', to: 'format' },
          { from: 'format', to: 'end' }
        ]
      },
      status: 'active',
      tags: ['data', 'processing', 'pipeline'],
    },
  ];

  for (const workflowData of workflows) {
    const workflow = await prisma.workflow.upsert({
      where: {
        name_organizationId: {
          name: workflowData.name,
          organizationId: organization.id,
        }
      },
      update: {},
      create: workflowData,
    });
    console.log(`✅ Created workflow: ${workflow.name}`);
  }

  // Create feature flags
  const featureFlags = [
    {
      name: 'Agent Runtime',
      key: 'agent-runtime',
      description: 'Enable AI agent execution engine',
      enabled: true,
      organizationId: organization.id,
      config: { runtime: 'openai', model: 'gpt-4' },
    },
    {
      name: 'Workflow Engine',
      key: 'workflow-engine',
      description: 'Enable workflow orchestration',
      enabled: true,
      organizationId: organization.id,
      config: { engine: 'langgraph', async: true },
    },
    {
      name: 'Plugin System',
      key: 'plugin-system',
      description: 'Enable plugin architecture',
      enabled: true,
      organizationId: organization.id,
      config: { registry: 'local', autoUpdate: false },
    },
  ];

  for (const flagData of featureFlags) {
    const flag = await prisma.featureFlag.upsert({
      where: { key: flagData.key },
      update: {},
      create: flagData,
    });
    console.log(`✅ Created feature flag: ${flag.name}`);
  }

  // ===== PatientFlow Seeding =====
  console.log('\n🏥 Seeding PatientFlow data...');

  // Create clinic branches
  const branch = await prisma.clinicBranch.create({
    data: {
      name: 'Main Clinic Branch',
      organizationId: organization.id,
      address: '123 Healthcare Ave',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'USA',
      phone: '+1-503-555-0100',
      email: 'main@clinic.example.com',
      operatingHours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '14:00' },
        sunday: null,
      },
    },
  });
  console.log('✅ Created clinic branch:', branch.name);

  // Create doctors
  const doctor1 = await prisma.doctor.create({
    data: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@clinic.example.com',
      phone: '+1-503-555-0101',
      organizationId: organization.id,
      branchId: branch.id,
      specialty: 'Cardiology',
      licenseNumber: 'MD-12345',
      qualifications: [
        'MD from Harvard Medical School',
        'Board Certified - Cardiology',
      ],
      languages: ['en', 'es'],
      isAvailable: true,
      isActive: true,
    },
  });

  const doctor2 = await prisma.doctor.create({
    data: {
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@clinic.example.com',
      phone: '+1-503-555-0102',
      organizationId: organization.id,
      branchId: branch.id,
      specialty: 'General Practice',
      licenseNumber: 'MD-12346',
      qualifications: ['MD from Stanford University'],
      languages: ['en', 'zh', 'es'],
      isAvailable: true,
      isActive: true,
    },
  });

  console.log('✅ Created doctors: Dr. Johnson, Dr. Chen');

  // Create doctor schedules
  for (let dayOfWeek = 0; dayOfWeek < 6; dayOfWeek++) {
    if (dayOfWeek !== 6) { // Skip Sunday
      await prisma.doctorSchedule.create({
        data: {
          doctorId: doctor1.id,
          dayOfWeek,
          timeSlots: [
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '17:00' },
          ],
          slotDurationMinutes: 30,
          isActive: true,
        },
      });

      await prisma.doctorSchedule.create({
        data: {
          doctorId: doctor2.id,
          dayOfWeek,
          timeSlots: [
            { start: '09:00', end: '12:00' },
            { start: '14:00', end: '18:00' },
          ],
          slotDurationMinutes: 30,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Created doctor schedules');

  // Create patients
  const patient1 = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      firstName: 'John',
      lastName: 'Smith',
      phone: '+1-503-555-1001',
      email: 'john.smith@example.com',
      dateOfBirth: new Date('1975-03-15'),
      gender: 'M',
      address: '456 Main St',
      city: 'Portland',
      state: 'OR',
      postalCode: '97201',
      country: 'USA',
      emergencyContact: 'Jane Smith',
      emergencyPhone: '+1-503-555-1002',
      bloodType: 'O+',
      allergies: ['Penicillin'],
      phoneOptIn: true,
      emailOptIn: true,
      smsOptIn: true,
    },
  });

  const patient2 = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      firstName: 'Mary',
      lastName: 'Johnson',
      phone: '+1-503-555-1003',
      email: 'mary.johnson@example.com',
      dateOfBirth: new Date('1982-07-22'),
      gender: 'F',
      address: '789 Oak Ave',
      city: 'Portland',
      state: 'OR',
      postalCode: '97202',
      country: 'USA',
      emergencyContact: 'Robert Johnson',
      emergencyPhone: '+1-503-555-1004',
      bloodType: 'A-',
      phoneOptIn: true,
      emailOptIn: true,
      smsOptIn: false,
    },
  });

  console.log('✅ Created patients: John Smith, Mary Johnson');

  // Create patient preferences
  await prisma.patientPreference.create({
    data: {
      patientId: patient1.id,
      preferredLanguage: 'en',
      preferredTimeSlots: ['morning', 'afternoon'],
      reminderPreference: '24h',
      preferredChannels: ['phone', 'sms'],
    },
  });

  await prisma.patientPreference.create({
    data: {
      patientId: patient2.id,
      preferredLanguage: 'en',
      preferredTimeSlots: ['afternoon', 'evening'],
      reminderPreference: '48h',
      preferredChannels: ['phone', 'email'],
    },
  });

  console.log('✅ Created patient preferences');

  // Create appointments
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  futureDate.setHours(10, 0, 0, 0);

  const appointment1 = await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      patientId: patient1.id,
      doctorId: doctor1.id,
      startTime: futureDate,
      endTime: new Date(futureDate.getTime() + 30 * 60000),
      status: 'BOOKED',
      source: 'MANUAL',
      channel: 'VOICE',
      reason: 'Regular checkup',
    },
  });

  console.log('✅ Created appointment');

  // Create patient notes
  await prisma.patientNote.create({
    data: {
      patientId: patient1.id,
      noteType: 'clinical',
      content: 'Patient reports mild chest discomfort. Scheduled for EKG.',
      createdBy: adminUser.id,
      isPrivate: false,
    },
  });

  console.log('✅ Created patient notes');

  // Create message logs
  await prisma.patientMessageLog.create({
    data: {
      organizationId: organization.id,
      patientId: patient1.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      payload: {
        messageId: 'wa-msg-001',
        text: 'Hi, I would like to book an appointment',
        timestamp: new Date(),
      },
    },
  });

  await prisma.patientMessageLog.create({
    data: {
      organizationId: organization.id,
      patientId: patient1.id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      payload: {
        messageId: 'wa-msg-002',
        text: 'Thank you! We have an appointment available on Dec 20 at 10:00 AM.',
        timestamp: new Date(),
      },
    },
  });

  console.log('✅ Created message logs');

  // Create call logs
  await prisma.patientCallLog.create({
    data: {
      organizationId: organization.id,
      patientId: patient1.id,
      callSid: 'call-twilio-001',
      status: 'COMPLETED',
      startTime: new Date(),
      endTime: new Date(Date.now() + 12 * 60000),
      durationSeconds: 720,
      transcription: 'Patient called to confirm appointment. Confirmed for next week.',
      summary: 'Appointment confirmation call',
    },
  });

  console.log('✅ Created call logs');

  // Create conversation session
  await prisma.conversationSession.create({
    data: {
      organizationId: organization.id,
      patientPhone: patient1.phone,
      sessionKey: `${organization.id}:5035551001`,
      stateJson: {
        stage: 'appointment_booking',
        selectedDoctor: doctor1.id,
        selectedDate: '2024-12-20',
        confirmed: true,
      },
    },
  });

  console.log('✅ Created conversation session');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
