const seedTestData = async (prisma) => {
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Clinic',
      slug: 'test-clinic',
      tier: 'professional',
      status: 'active',
    },
  });

  const branch = await prisma.clinicBranch.create({
    data: {
      organizationId: organization.id,
      name: 'Main Branch',
      address: '123 Medical Street',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'USA',
      phone: '+1-555-0100',
      email: 'main@clinic.test',
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

  const doctor1 = await prisma.doctor.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@clinic.test',
      phone: '+1-555-0101',
      specialty: 'General Practice',
      licenseNumber: 'GP-12345',
      qualifications: ['MD', 'Board Certified'],
      languages: ['en', 'es'],
      isAvailable: true,
      isActive: true,
    },
  });

  const doctor2 = await prisma.doctor.create({
    data: {
      organizationId: organization.id,
      branchId: branch.id,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@clinic.test',
      phone: '+1-555-0102',
      specialty: 'Cardiology',
      licenseNumber: 'CA-67890',
      qualifications: ['MD', 'Board Certified', 'Fellowship'],
      languages: ['en', 'fr'],
      isAvailable: true,
      isActive: true,
    },
  });

  const schedule1Monday = await prisma.doctorSchedule.create({
    data: {
      doctorId: doctor1.id,
      dayOfWeek: 1,
      timeSlots: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      slotDurationMinutes: 30,
      isActive: true,
    },
  });

  const schedule1Tuesday = await prisma.doctorSchedule.create({
    data: {
      doctorId: doctor1.id,
      dayOfWeek: 2,
      timeSlots: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      slotDurationMinutes: 30,
      isActive: true,
    },
  });

  const patient1 = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      phone: '+1-555-1000',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'F',
      address: '456 Oak Avenue',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94103',
      country: 'USA',
      emergencyContact: 'Bob Johnson',
      emergencyPhone: '+1-555-1001',
      bloodType: 'O+',
      allergies: ['Penicillin', 'Latex'],
      chronicConditions: ['Hypertension'],
      phoneOptIn: true,
      emailOptIn: true,
      smsOptIn: true,
      whatsappOptIn: true,
      status: 'active',
    },
  });

  const patient2 = await prisma.patient.create({
    data: {
      organizationId: organization.id,
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      phone: '+1-555-1002',
      dateOfBirth: new Date('1990-03-22'),
      gender: 'M',
      address: '789 Pine Road',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94104',
      country: 'USA',
      phoneOptIn: true,
      emailOptIn: false,
      smsOptIn: true,
      whatsappOptIn: false,
      status: 'active',
    },
  });

  const preference1 = await prisma.patientPreference.create({
    data: {
      patientId: patient1.id,
      preferredLanguage: 'en',
      preferredTimeSlots: ['morning', 'afternoon'],
      reminderPreference: '24h',
      preferredChannels: ['phone', 'whatsapp'],
      doNotCallBefore: '09:00',
      doNotCallAfter: '18:00',
    },
  });

  const preference2 = await prisma.patientPreference.create({
    data: {
      patientId: patient2.id,
      preferredLanguage: 'en',
      preferredTimeSlots: ['afternoon'],
      reminderPreference: '48h',
      preferredChannels: ['phone'],
    },
  });

  const note1 = await prisma.patientNote.create({
    data: {
      patientId: patient1.id,
      noteType: 'clinical',
      content: 'Patient reports mild hypertension symptoms',
      createdBy: 'user-123',
      isPrivate: false,
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const appointmentEnd = new Date(tomorrow);
  appointmentEnd.setMinutes(appointmentEnd.getMinutes() + 30);

  const appointment1 = await prisma.appointment.create({
    data: {
      organizationId: organization.id,
      patientId: patient1.id,
      doctorId: doctor1.id,
      status: 'BOOKED',
      source: 'WHATSAPP',
      channel: 'VOICE',
      startTime: tomorrow,
      endTime: appointmentEnd,
      reason: 'Regular checkup',
      channelMetadata: {
        whatsappId: 'msg-123',
        timestamp: new Date().toISOString(),
      },
    },
  });

  const session1 = await prisma.conversationSession.create({
    data: {
      organizationId: organization.id,
      patientPhone: '+1-555-1000',
      sessionKey: `${organization.id}:+1-555-1000`,
      isActive: true,
      stateJson: {
        messages: [
          {
            role: 'user',
            content: 'I need to book an appointment',
            timestamp: new Date().toISOString(),
          },
        ],
        context: 'booking_request',
        toolsCalled: [],
      },
    },
  });

  return {
    organization,
    branch,
    doctors: [doctor1, doctor2],
    patients: [patient1, patient2],
    preferences: [preference1, preference2],
    schedules: [schedule1Monday, schedule1Tuesday],
    notes: [note1],
    appointments: [appointment1],
    sessions: [session1],
  };
};

const cleanupTestData = async (prisma) => {
  await prisma.conversationSession.deleteMany({});
  await prisma.patientCallLog.deleteMany({});
  await prisma.patientMessageLog.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.patientNote.deleteMany({});
  await prisma.patientPreference.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.doctorSchedule.deleteMany({});
  await prisma.doctor.deleteMany({});
  await prisma.clinicBranch.deleteMany({});
  await prisma.organization.deleteMany({});
};

module.exports = {
  seedTestData,
  cleanupTestData,
};
