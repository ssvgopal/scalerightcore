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
    // Check if agent already exists by name and organization
    const existingAgent = await prisma.agent.findFirst({
      where: {
        name: agentData.name,
        organizationId: organization.id
      }
    });

    let agent;
    if (existingAgent) {
      // Update existing agent
      agent = await prisma.agent.update({
        where: { id: existingAgent.id },
        data: agentData
      });
    } else {
      // Create new agent
      agent = await prisma.agent.create({
        data: agentData
      });
    }
    console.log(`✅ ${existingAgent ? 'Updated' : 'Created'} agent: ${agent.name}`);
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
    // Check if workflow already exists by name and organization
    const existingWorkflow = await prisma.workflow.findFirst({
      where: {
        name: workflowData.name,
        organizationId: organization.id
      }
    });

    let workflow;
    if (existingWorkflow) {
      // Update existing workflow
      workflow = await prisma.workflow.update({
        where: { id: existingWorkflow.id },
        data: workflowData
      });
    } else {
      // Create new workflow
      workflow = await prisma.workflow.create({
        data: workflowData
      });
    }
    console.log(`✅ ${existingWorkflow ? 'Updated' : 'Created'} workflow: ${workflow.name}`);
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

  // ===== PATIENT FLOW SEEDING =====
  console.log('🏥 Starting PatientFlow seeding...');

  // Helper utilities for random data generation
  const helpers = {
    randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)],
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomFloat: (min, max) => Math.random() * (max - min) + min,
    randomDate: (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())),
    randomPhone: () => `+1${Math.floor(Math.random() * 8000000000) + 2000000000}`,
    randomEmail: (firstName, lastName) => `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 999) + 1}@example.com`,
  };

  // Clinic branches data
  const clinicBranchesData = [
    {
      name: 'Downtown Medical Center',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA',
      latitude: 40.7589,
      longitude: -73.9851,
      operatingHours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: { closed: true }
      },
      phone: '+1-212-555-0101',
      email: 'downtown@medical.com'
    },
    {
      name: 'Westside Family Clinic',
      address: '456 Oak Avenue',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
      operatingHours: {
        monday: { open: '07:00', close: '19:00' },
        tuesday: { open: '07:00', close: '19:00' },
        wednesday: { open: '07:00', close: '19:00' },
        thursday: { open: '07:00', close: '19:00' },
        friday: { open: '07:00', close: '19:00' },
        saturday: { open: '08:00', close: '16:00' },
        sunday: { closed: true }
      },
      phone: '+1-310-555-0202',
      email: 'westside@familyclinic.com'
    },
    {
      name: 'Chicago Health Partners',
      address: '789 Michigan Avenue',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'USA',
      latitude: 41.8781,
      longitude: -87.6298,
      operatingHours: {
        monday: { open: '08:30', close: '17:30' },
        tuesday: { open: '08:30', close: '17:30' },
        wednesday: { open: '08:30', close: '17:30' },
        thursday: { open: '08:30', close: '17:30' },
        friday: { open: '08:30', close: '17:30' },
        saturday: { open: '10:00', close: '15:00' },
        sunday: { closed: true }
      },
      phone: '+1-312-555-0303',
      email: 'chicago@healthpartners.com'
    },
    {
      name: 'Houston Medical Plaza',
      address: '321 Smith Street',
      city: 'Houston',
      state: 'TX',
      postalCode: '77001',
      country: 'USA',
      latitude: 29.7604,
      longitude: -95.3698,
      operatingHours: {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '20:00' },
        saturday: { open: '09:00', close: '17:00' },
        sunday: { closed: true }
      },
      phone: '+1-713-555-0404',
      email: 'houston@medicalplaza.com'
    },
    {
      name: 'Phoenix Specialty Center',
      address: '654 Camelback Road',
      city: 'Phoenix',
      state: 'AZ',
      postalCode: '85001',
      country: 'USA',
      latitude: 33.4484,
      longitude: -112.0740,
      operatingHours: {
        monday: { open: '07:30', close: '18:30' },
        tuesday: { open: '07:30', close: '18:30' },
        wednesday: { open: '07:30', close: '18:30' },
        thursday: { open: '07:30', close: '18:30' },
        friday: { open: '07:30', close: '18:30' },
        saturday: { open: '08:00', close: '14:00' },
        sunday: { closed: true }
      },
      phone: '+1-602-555-0505',
      email: 'phoenix@specialtycenter.com'
    },
    {
      name: 'Philadelphia General Hospital',
      address: '987 Market Street',
      city: 'Philadelphia',
      state: 'PA',
      postalCode: '19101',
      country: 'USA',
      latitude: 39.9526,
      longitude: -75.1652,
      operatingHours: {
        monday: { open: '06:00', close: '22:00' },
        tuesday: { open: '06:00', close: '22:00' },
        wednesday: { open: '06:00', close: '22:00' },
        thursday: { open: '06:00', close: '22:00' },
        friday: { open: '06:00', close: '22:00' },
        saturday: { open: '07:00', close: '20:00' },
        sunday: { open: '08:00', close: '18:00' }
      },
      phone: '+1-215-555-0606',
      email: 'philly@generalhospital.com'
    },
    {
      name: 'San Diego Wellness Clinic',
      address: '147 Pacific Highway',
      city: 'San Diego',
      state: 'CA',
      postalCode: '92101',
      country: 'USA',
      latitude: 32.7157,
      longitude: -117.1611,
      operatingHours: {
        monday: { open: '08:00', close: '17:00' },
        tuesday: { open: '08:00', close: '17:00' },
        wednesday: { open: '08:00', close: '17:00' },
        thursday: { open: '08:00', close: '17:00' },
        friday: { open: '08:00', close: '17:00' },
        saturday: { open: '09:00', close: '13:00' },
        sunday: { closed: true }
      },
      phone: '+1-619-555-0707',
      email: 'sandiego@wellnessclinic.com'
    },
    {
      name: 'Miami Beach Medical Center',
      address: '25 Ocean Drive',
      city: 'Miami Beach',
      state: 'FL',
      postalCode: '33139',
      country: 'USA',
      latitude: 25.7907,
      longitude: -80.1300,
      operatingHours: {
        monday: { open: '09:00', close: '19:00' },
        tuesday: { open: '09:00', close: '19:00' },
        wednesday: { open: '09:00', close: '19:00' },
        thursday: { open: '09:00', close: '19:00' },
        friday: { open: '09:00', close: '19:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { open: '11:00', close: '15:00' }
      },
      phone: '+1-305-555-0808',
      email: 'miami@medicalcenter.com'
    }
  ];

  // Create clinic branches
  const clinicBranches = [];
  for (const branchData of clinicBranchesData) {
    // Check if branch already exists by name and organization
    const existingBranch = await prisma.clinicBranch.findFirst({
      where: {
        name: branchData.name,
        organizationId: organization.id
      }
    });

    let branch;
    if (existingBranch) {
      // Update existing branch
      branch = await prisma.clinicBranch.update({
        where: { id: existingBranch.id },
        data: {
          ...branchData,
          operatingHours: branchData.operatingHours
        }
      });
    } else {
      // Create new branch
      branch = await prisma.clinicBranch.create({
        data: {
          ...branchData,
          organizationId: organization.id,
          operatingHours: branchData.operatingHours
        }
      });
    }
    clinicBranches.push(branch);
    console.log(`✅ ${existingBranch ? 'Updated' : 'Created'} clinic branch: ${branch.name}`);
  }

  // Doctors data
  const doctorsData = [
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@medical.com', specialty: 'Cardiology', languages: ['en', 'es'] },
    { firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@medical.com', specialty: 'Internal Medicine', languages: ['en', 'zh'] },
    { firstName: 'Emily', lastName: 'Rodriguez', email: 'emily.rodriguez@medical.com', specialty: 'Pediatrics', languages: ['en', 'es'] },
    { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@medical.com', specialty: 'Orthopedics', languages: ['en'] },
    { firstName: 'Lisa', lastName: 'Thompson', email: 'lisa.thompson@medical.com', specialty: 'Dermatology', languages: ['en', 'fr'] },
    { firstName: 'Robert', lastName: 'Garcia', email: 'robert.garcia@medical.com', specialty: 'General Practice', languages: ['en', 'es'] },
    { firstName: 'Maria', lastName: 'Martinez', email: 'maria.martinez@medical.com', specialty: 'Neurology', languages: ['en', 'es'] },
    { firstName: 'David', lastName: 'Lee', email: 'david.lee@medical.com', specialty: 'Family Medicine', languages: ['en', 'zh', 'es'] }
  ];

  // Create doctors
  const doctors = [];
  for (let i = 0; i < doctorsData.length; i++) {
    const doctorData = doctorsData[i];
    const doctor = await prisma.doctor.upsert({
      where: { email: doctorData.email },
      update: {},
      create: {
        ...doctorData,
        organizationId: organization.id,
        branchId: clinicBranches[i].id,
        phone: helpers.randomPhone(),
        licenseNumber: `MD${helpers.randomInt(10000, 99999)}`,
        qualifications: [`MD from ${helpers.randomChoice(['Harvard', 'Johns Hopkins', 'Mayo Clinic', 'Cleveland Clinic'])}`],
        languages: doctorData.languages
      }
    });
    doctors.push(doctor);
    console.log(`✅ Created doctor: ${doctor.firstName} ${doctor.lastName} (${doctor.specialty})`);
  }

  // Create doctor schedules (weekly for each doctor)
  for (const doctor of doctors) {
    const daysOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
    for (const dayOfWeek of daysOfWeek) {
      const timeSlots = [];
      const startHour = helpers.randomChoice([8, 9, 10]);
      const endHour = helpers.randomChoice([16, 17, 18]);
      
      // Generate time slots
      for (let hour = startHour; hour < endHour; hour++) {
        timeSlots.push({
          start: `${hour.toString().padStart(2, '0')}:00`,
          end: `${hour.toString().padStart(2, '0')}:30`
        });
        timeSlots.push({
          start: `${hour.toString().padStart(2, '0')}:30`,
          end: `${(hour + 1).toString().padStart(2, '0')}:00`
        });
      }

      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek: {
            doctorId: doctor.id,
            dayOfWeek: dayOfWeek
          }
        },
        update: {},
        create: {
          doctorId: doctor.id,
          dayOfWeek: dayOfWeek,
          timeSlots: { slots: timeSlots },
          slotDurationMinutes: 30,
          isActive: true
        }
      });
    }
    console.log(`✅ Created weekly schedule for Dr. ${doctor.firstName} ${doctor.lastName}`);
  }

  // Patient data
  const firstNames = ['John', 'Jane', 'Robert', 'Mary', 'William', 'Patricia', 'James', 'Jennifer', 'Charles', 'Linda', 'Joseph', 'Elizabeth', 'Thomas', 'Barbara', 'Christopher', 'Susan', 'Daniel', 'Jessica', 'Matthew', 'Sarah', 'Anthony', 'Karen', 'Mark', 'Nancy', 'Donald', 'Lisa', 'Steven', 'Betty', 'Paul', 'Dorothy'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'];
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA'];
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const allergies = ['Penicillin', 'Pollen', 'Dust', 'Peanuts', 'Shellfish', 'Latex', 'None'];
  const chronicConditions = ['Hypertension', 'Diabetes', 'Asthma', 'Arthritis', 'None'];

  // Create patients (only if we don't have enough)
  const existingPatientCount = await prisma.patient.count({
    where: { organizationId: organization.id }
  });
  
  const patients = [];
  const patientsToCreate = Math.max(0, 50 - existingPatientCount);
  
  for (let i = 0; i < patientsToCreate; i++) {
    const firstName = helpers.randomChoice(firstNames);
    const lastName = helpers.randomChoice(lastNames);
    const phone = helpers.randomPhone();
    const email = helpers.randomEmail(firstName, lastName);
    
    const patient = await prisma.patient.upsert({
      where: {
        organizationId_phone: {
          organizationId: organization.id,
          phone: phone
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        dateOfBirth: helpers.randomDate(new Date(1940, 0, 1), new Date(2005, 11, 31)),
        gender: helpers.randomChoice(['M', 'F', 'Other']),
        address: `${helpers.randomInt(100, 9999)} ${helpers.randomChoice(['Main St', 'Oak Ave', 'Elm St', 'Park Ave'])}`,
        city: helpers.randomChoice(cities),
        state: helpers.randomChoice(states),
        postalCode: helpers.randomInt(10000, 99999).toString(),
        country: 'USA',
        emergencyContact: `${helpers.randomChoice(firstNames)} ${helpers.randomChoice(lastNames)}`,
        emergencyPhone: helpers.randomPhone(),
        bloodType: helpers.randomChoice(bloodTypes),
        allergies: [helpers.randomChoice(allergies)],
        chronicConditions: [helpers.randomChoice(chronicConditions)],
        phoneOptIn: true,
        emailOptIn: helpers.randomChoice([true, false]),
        smsOptIn: true,
        whatsappOptIn: helpers.randomChoice([true, false]),
        status: 'active'
      }
    });
    patients.push(patient);
  }
  console.log(`✅ ${patientsToCreate > 0 ? 'Created' : 'Already have'} ${Math.max(50, existingPatientCount)} patients`);

  // Create patient preferences
  for (const patient of patients) {
    await prisma.patientPreference.upsert({
      where: { patientId: patient.id },
      update: {},
      create: {
        patientId: patient.id,
        preferredLanguage: helpers.randomChoice(['en', 'es', 'zh', 'fr']),
        preferredTimeSlots: [helpers.randomChoice(['morning', 'afternoon', 'evening'])],
        reminderPreference: helpers.randomChoice(['24h', '48h', '1week']),
        preferredChannels: [helpers.randomChoice(['phone', 'email', 'sms', 'whatsapp'])],
        doNotCallBefore: helpers.randomChoice(['08:00', '09:00', null]),
        doNotCallAfter: helpers.randomChoice(['17:00', '18:00', '20:00', null])
      }
    });
  }
  console.log(`✅ Created patient preferences`);

  // Create patient notes
  for (const patient of patients) {
    const noteCount = helpers.randomInt(1, 4);
    for (let i = 0; i < noteCount; i++) {
      await prisma.patientNote.create({
        data: {
          patientId: patient.id,
          noteType: helpers.randomChoice(['clinical', 'administrative', 'follow_up', 'reminder']),
          content: helpers.randomChoice([
            'Patient reports feeling better after last visit.',
            'Follow-up appointment scheduled for next month.',
            'Patient prefers morning appointments.',
            'Reminder sent for medication refill.',
            'Patient has history of seasonal allergies.',
            'New insurance information updated.',
            'Patient requested telehealth options.'
          ]),
          createdBy: adminUser.id,
          isPrivate: helpers.randomChoice([true, false])
        }
      });
    }
  }
  console.log(`✅ Created patient notes`);

  // Create appointments (mix of future and past)
  const appointmentStatuses = ['BOOKED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
  const appointmentSources = ['WHATSAPP', 'VOICE', 'MANUAL'];
  const communicationChannels = ['WHATSAPP', 'VOICE'];
  const appointmentReasons = [
    'Annual checkup',
    'Follow-up consultation',
    'New patient visit',
    'Specialist referral',
    'Urgent care visit',
    'Medication review',
    'Test results discussion',
    'Vaccination',
    'Minor injury',
    'Chronic condition management'
  ];

  const appointments = [];
  const now = new Date();

  // Check existing appointment count
  const existingAppointmentCount = await prisma.appointment.count({
    where: { organizationId: organization.id }
  });

  // Create 30 future appointments (only if needed)
  const futureAppointmentsToCreate = Math.max(0, 30 - Math.floor(existingAppointmentCount * 0.75));
  for (let i = 0; i < futureAppointmentsToCreate; i++) {
    const patient = helpers.randomChoice(patients);
    const doctor = helpers.randomChoice(doctors);
    const startTime = helpers.randomDate(
      new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    );
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    const appointment = await prisma.appointment.create({
      data: {
        organizationId: organization.id,
        patientId: patient.id,
        doctorId: doctor.id,
        status: helpers.randomChoice(['BOOKED', 'CONFIRMED']),
        source: helpers.randomChoice(appointmentSources),
        channel: helpers.randomChoice(communicationChannels),
        startTime: startTime,
        endTime: endTime,
        reason: helpers.randomChoice(appointmentReasons),
        internalNotes: helpers.randomChoice(['', 'Patient prefers video call', 'First time visitor', 'Bring insurance card']),
        reminderSent: helpers.randomChoice([true, false]),
        reminderSentAt: helpers.randomChoice([true, false]) ? new Date(startTime.getTime() - 24 * 60 * 60 * 1000) : null
      }
    });
    appointments.push(appointment);
  }

  // Create some past appointments for reschedule scenarios (only if needed)
  const pastAppointmentsToCreate = Math.max(0, 10 - Math.floor(existingAppointmentCount * 0.25));
  for (let i = 0; i < pastAppointmentsToCreate; i++) {
    const patient = helpers.randomChoice(patients);
    const doctor = helpers.randomChoice(doctors);
    const startTime = helpers.randomDate(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      new Date(now.getTime() - 24 * 60 * 60 * 1000) // Yesterday
    );
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    await prisma.appointment.create({
      data: {
        organizationId: organization.id,
        patientId: patient.id,
        doctorId: doctor.id,
        status: helpers.randomChoice(['COMPLETED', 'CANCELLED', 'NO_SHOW']),
        source: helpers.randomChoice(appointmentSources),
        channel: helpers.randomChoice(communicationChannels),
        startTime: startTime,
        endTime: endTime,
        reason: helpers.randomChoice(appointmentReasons),
        internalNotes: helpers.randomChoice(['', 'Patient arrived late', 'Rescheduled from previous date', 'No-show, follow-up required']),
        reminderSent: true,
        reminderSentAt: new Date(startTime.getTime() - 24 * 60 * 60 * 1000)
      }
    });
  }
  console.log(`✅ ${futureAppointmentsToCreate > 0 || pastAppointmentsToCreate > 0 ? 'Created' : 'Already have'} appointments (${Math.max(30, Math.floor(existingAppointmentCount * 0.75))} future, ${Math.max(10, Math.floor(existingAppointmentCount * 0.25))} past)`);

  // Create patient message logs
  const messageTemplates = {
    inbound: [
      'Hi, I need to schedule an appointment',
      'Can I reschedule my appointment for next week?',
      'What are your office hours?',
      'I need to refill my prescription',
      'Is Dr. Smith available tomorrow?',
      'I need to cancel my appointment',
      'Do you accept my insurance?',
      'Can I get a copy of my medical records?'
    ],
    outbound: [
      'Your appointment is confirmed for tomorrow at 10:00 AM',
      'Please arrive 15 minutes early for your appointment',
      'Your prescription refill is ready',
      'We need to reschedule your appointment',
      'Thank you for choosing our clinic',
      'Your test results are available',
      'Please update your insurance information',
      'Reminder: Your appointment is in 2 hours'
    ]
  };

  // Check existing message log count
  const existingMessageCount = await prisma.patientMessageLog.count({
    where: { organizationId: organization.id }
  });

  const messagesToCreate = Math.max(0, 20 - existingMessageCount);
  for (let i = 0; i < messagesToCreate; i++) {
    const patient = helpers.randomChoice(patients);
    const direction = helpers.randomChoice(['INBOUND', 'OUTBOUND']);
    const channel = helpers.randomChoice(['WHATSAPP', 'VOICE']);
    
    await prisma.patientMessageLog.create({
      data: {
        organizationId: organization.id,
        patientId: patient.id,
        channel: channel,
        direction: direction,
        payload: {
          message: helpers.randomChoice(messageTemplates[direction.toLowerCase()]),
          timestamp: new Date().toISOString(),
          source: channel
        },
        externalMessageId: `msg_${helpers.randomInt(100000, 999999)}`
      }
    });
  }
  console.log(`✅ ${messagesToCreate > 0 ? 'Created' : 'Already have'} ${Math.max(20, existingMessageCount)} patient message logs`);

  // Create patient call logs
  const callSummaries = [
    'Patient called to schedule appointment',
    'Patient confirmed appointment time',
    'Patient requested prescription refill',
    'Patient cancelled due to emergency',
    'Patient inquiring about insurance coverage',
    'Patient called with medical question',
    'Patient rescheduled appointment',
    'Patient called for test results'
  ];

  // Check existing call log count
  const existingCallCount = await prisma.patientCallLog.count({
    where: { organizationId: organization.id }
  });

  const callsToCreate = Math.max(0, 15 - existingCallCount);
  for (let i = 0; i < callsToCreate; i++) {
    const patient = helpers.randomChoice(patients);
    const startTime = helpers.randomDate(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      new Date()
    );
    const duration = helpers.randomInt(60, 600); // 1 to 10 minutes
    const endTime = new Date(startTime.getTime() + duration * 1000);

    await prisma.patientCallLog.create({
      data: {
        organizationId: organization.id,
        patientId: patient.id,
        callSid: `call_${helpers.randomInt(1000000, 9999999)}`,
        status: helpers.randomChoice(['COMPLETED', 'MISSED', 'FAILED']),
        startTime: startTime,
        endTime: endTime,
        durationSeconds: duration,
        transcription: helpers.randomChoice(['', 'Call connected successfully', 'Patient left voicemail']),
        summary: helpers.randomChoice(callSummaries),
        callMetadata: {
          direction: helpers.randomChoice(['inbound', 'outbound']),
          cost: helpers.randomFloat(0.05, 0.25)
        }
      }
    });
  }
  console.log(`✅ ${callsToCreate > 0 ? 'Created' : 'Already have'} ${Math.max(15, existingCallCount)} patient call logs`);

  console.log('🏥 PatientFlow seeding completed successfully!');
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
