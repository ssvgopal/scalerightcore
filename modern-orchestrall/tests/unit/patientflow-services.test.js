const { PrismaClient } = require('@prisma/client');
const PatientService = require('../../src/patientflow/services/patient-service');
const DoctorService = require('../../src/patientflow/services/doctor-service');
const AppointmentService = require('../../src/patientflow/services/appointment-service');
const InteractionLogger = require('../../src/patientflow/services/interaction-logger');

// Mock Prisma Client
jest.mock('@prisma/client');

describe('PatientFlow Services', () => {
  let prisma;
  let patientService;
  let doctorService;
  let appointmentService;
  let interactionLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Prisma instance
    prisma = {
      patient: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      doctor: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      appointment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      patientPreference: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      patientNote: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      patientMessageLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      patientCallLog: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      clinicBranch: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };

    // Initialize services
    patientService = new PatientService(prisma);
    doctorService = new DoctorService(prisma);
    appointmentService = new AppointmentService(prisma);
    interactionLogger = new InteractionLogger(prisma);
  });

  describe('PatientService', () => {
    test('should lookup patient by phone', async () => {
      const mockPatient = {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        organizationId: 'org-1',
      };

      prisma.patient.findUnique.mockResolvedValue(mockPatient);

      const patient = await patientService.lookupByPhone('org-1', '+1234567890');

      expect(patient).toEqual(mockPatient);
      expect(prisma.patient.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_phone: {
            organizationId: 'org-1',
            phone: '+1234567890',
          },
        },
        include: expect.any(Object),
      });
    });

    test('should create a new patient', async () => {
      const mockPatient = {
        id: 'patient-2',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1987654321',
        organizationId: 'org-1',
      };

      prisma.patient.create.mockResolvedValue(mockPatient);

      const patient = await patientService.createPatient('org-1', {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1987654321',
      });

      expect(patient).toEqual(mockPatient);
    });
  });

  describe('DoctorService', () => {
    test('should get all branches for organization', async () => {
      const mockBranches = [
        {
          id: 'branch-1',
          name: 'Main Clinic',
          organizationId: 'org-1',
          doctors: [],
        },
      ];

      prisma.clinicBranch.findMany.mockResolvedValue(mockBranches);

      const branches = await doctorService.getAllBranches('org-1');

      expect(branches).toEqual(mockBranches);
    });

    test('should generate time slots correctly', () => {
      const slots = doctorService.generateSlots(
        '2024-12-15',
        [{ start: '09:00', end: '10:00' }],
        30
      );

      expect(slots.length).toBe(2); // 09:00-09:30 and 09:30-10:00
      expect(slots[0].start).toBeDefined();
      expect(slots[0].end).toBeDefined();
    });

    test('should detect slot overlaps', () => {
      const slot1 = {
        start: new Date('2024-12-15T09:00:00'),
        end: new Date('2024-12-15T10:00:00'),
      };

      const slot2 = {
        start: new Date('2024-12-15T09:30:00'),
        end: new Date('2024-12-15T10:30:00'),
      };

      const overlap = doctorService.slotsOverlap(slot1, slot2);
      expect(overlap).toBe(true);
    });

    test('should not detect overlap for non-overlapping slots', () => {
      const slot1 = {
        start: new Date('2024-12-15T09:00:00'),
        end: new Date('2024-12-15T10:00:00'),
      };

      const slot2 = {
        start: new Date('2024-12-15T10:00:00'),
        end: new Date('2024-12-15T11:00:00'),
      };

      const overlap = doctorService.slotsOverlap(slot1, slot2);
      expect(overlap).toBe(false);
    });
  });

  describe('AppointmentService', () => {
    test('should detect scheduling conflicts', async () => {
      const existingAppointment = {
        id: 'apt-1',
        doctorId: 'doctor-1',
        startTime: new Date('2024-12-15T09:00:00'),
        endTime: new Date('2024-12-15T10:00:00'),
        status: 'BOOKED',
      };

      prisma.appointment.findMany.mockResolvedValue([existingAppointment]);

      const hasConflict = await appointmentService.checkConflicts(
        'doctor-1',
        '2024-12-15T09:30:00',
        '2024-12-15T10:30:00'
      );

      expect(hasConflict).toBe(true);
    });

    test('should not detect conflict for non-overlapping times', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const hasConflict = await appointmentService.checkConflicts(
        'doctor-1',
        '2024-12-15T10:00:00',
        '2024-12-15T11:00:00'
      );

      expect(hasConflict).toBe(false);
    });

    test('should book appointment with transaction', async () => {
      const mockPatient = { id: 'patient-1' };
      const mockDoctor = { id: 'doctor-1' };
      const mockAppointment = {
        id: 'apt-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: new Date('2024-12-15T09:00:00'),
        endTime: new Date('2024-12-15T10:00:00'),
        status: 'BOOKED',
      };

      // Setup transaction mock
      prisma.$transaction.mockImplementation(async (callback) => {
        // Mock findMany to return no conflicts
        const txMock = {
          appointment: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          patient: {
            findUnique: jest.fn().mockResolvedValue(mockPatient),
          },
          doctor: {
            findUnique: jest.fn().mockResolvedValue(mockDoctor),
          },
        };

        // Mock create
        txMock.appointment.create = jest.fn().mockResolvedValue({
          ...mockAppointment,
          patient: mockPatient,
          doctor: { ...mockDoctor, branch: {} },
        });

        return callback(txMock);
      });

      const appointment = await appointmentService.bookAppointment('org-1', {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: '2024-12-15T09:00:00',
        endTime: '2024-12-15T10:00:00',
      });

      expect(appointment.id).toBe('apt-1');
      expect(appointment.status).toBe('BOOKED');
    });

    test('should throw error when booking conflicting appointment', async () => {
      const existingAppointment = {
        id: 'apt-1',
        status: 'BOOKED',
      };

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

    test('should reschedule appointment', async () => {
      const mockAppointment = {
        id: 'apt-1',
        doctorId: 'doctor-1',
        startTime: new Date('2024-12-15T09:00:00'),
        endTime: new Date('2024-12-15T10:00:00'),
      };

      prisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      prisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          appointment: {
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({
              ...mockAppointment,
              startTime: new Date('2024-12-15T11:00:00'),
              endTime: new Date('2024-12-15T12:00:00'),
              patient: {},
              doctor: { branch: {} },
            }),
          },
        };

        return callback(txMock);
      });

      const appointment = await appointmentService.rescheduleAppointment(
        'apt-1',
        '2024-12-15T11:00:00',
        '2024-12-15T12:00:00',
        'Rescheduled by patient'
      );

      expect(appointment.startTime).toEqual(new Date('2024-12-15T11:00:00'));
    });

    test('should cancel appointment', async () => {
      const mockAppointment = {
        id: 'apt-1',
        status: 'CANCELLED',
      };

      prisma.appointment.update.mockResolvedValue({
        ...mockAppointment,
        patient: {},
        doctor: { branch: {} },
      });

      const result = await appointmentService.cancelAppointment('apt-1', 'Patient requested');

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('InteractionLogger', () => {
    test('should log a message', async () => {
      const mockMessage = {
        id: 'msg-1',
        patientId: 'patient-1',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
      };

      prisma.patientMessageLog.create.mockResolvedValue(mockMessage);

      const message = await interactionLogger.logMessage(
        'org-1',
        'patient-1',
        'WHATSAPP',
        'INBOUND',
        { text: 'Hello' }
      );

      expect(message.id).toBe('msg-1');
    });

    test('should log a call', async () => {
      const mockCall = {
        id: 'call-1',
        patientId: 'patient-1',
        callSid: 'twilio-123',
        status: 'COMPLETED',
      };

      prisma.patientCallLog.create.mockResolvedValue(mockCall);

      const call = await interactionLogger.logCall(
        'org-1',
        'patient-1',
        'twilio-123',
        'COMPLETED',
        new Date()
      );

      expect(call.id).toBe('call-1');
    });

    test('should get recent messages for patient', async () => {
      const mockMessages = [
        { id: 'msg-1', patientId: 'patient-1', channel: 'WHATSAPP' },
        { id: 'msg-2', patientId: 'patient-1', channel: 'VOICE' },
      ];

      prisma.patientMessageLog.findMany.mockResolvedValue(mockMessages);

      const messages = await interactionLogger.getRecentMessages('patient-1', 20);

      expect(messages).toHaveLength(2);
    });

    test('should get recent calls for patient', async () => {
      const mockCalls = [
        { id: 'call-1', patientId: 'patient-1', status: 'COMPLETED', durationSeconds: 300 },
        { id: 'call-2', patientId: 'patient-1', status: 'MISSED', durationSeconds: 0 },
      ];

      prisma.patientCallLog.findMany.mockResolvedValue(mockCalls);

      const calls = await interactionLogger.getRecentCalls('patient-1', 20);

      expect(calls).toHaveLength(2);
    });
  });
});
