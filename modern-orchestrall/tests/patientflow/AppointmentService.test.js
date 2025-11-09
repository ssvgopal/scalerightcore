// tests/patientflow/AppointmentService.test.js - AppointmentService Unit Tests
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const AppointmentService = require('../../src/patientflow/AppointmentService');
const { createMockPrisma, createMockDatabase, createMockLogger, mockDate, resetAllMocks } = require('./mocks');
const { organization, doctor, doctorSchedule, patient, appointment, availableSlots } = require('./fixtures');

describe('AppointmentService', () => {
  let appointmentService;
  let mockPrisma;
  let mockDatabase;
  let mockLogger;
  let restoreDate;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPrisma = createMockPrisma();
    mockDatabase = createMockDatabase();
    mockLogger = createMockLogger();
    
    // Mock the database module
    jest.doMock('../../src/database', () => mockDatabase);
    jest.doMock('../../src/utils/logger', () => mockLogger);
    
    appointmentService = new AppointmentService();
    appointmentService.prisma = mockPrisma;
    
    // Mock date
    restoreDate = mockDate('2024-12-15T10:00:00.000Z');
  });

  afterEach(() => {
    resetAllMocks();
    restoreDate();
    jest.resetModules();
  });

  describe('generateAvailableSlots', () => {
    test('should generate available slots for available doctor', async () => {
      const doctorId = doctor.id;
      const date = '2024-12-16'; // Monday
      
      const mockSchedule = {
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: {
          start: '09:00',
          end: '17:00'
        }
      };

      mockPrisma.doctorSchedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrisma.appointment.findMany.mockResolvedValue([]); // No existing appointments

      const result = await appointmentService.generateAvailableSlots(doctorId, date, 30);

      expect(mockPrisma.doctorSchedule.findUnique).toHaveBeenCalledWith({
        where: {
          doctorId_dayOfWeek: {
            doctorId,
            dayOfWeek: 1 // Monday
          }
        },
        include: {
          doctor: true
        }
      });

      expect(result.slots).toBeDefined();
      expect(result.slots.length).toBeGreaterThan(0);
      
      // Check first slot
      expect(result.slots[0].startTime).toBeInstanceOf(Date);
      expect(result.slots[0].endTime).toBeInstanceOf(Date);
      expect(result.slots[0].available).toBe(true);
    });

    test('should return empty slots when doctor not available', async () => {
      const doctorId = doctor.id;
      const date = '2024-12-16';
      
      mockPrisma.doctorSchedule.findUnique.mockResolvedValue(null);

      const result = await appointmentService.generateAvailableSlots(doctorId, date);

      expect(result.slots).toEqual([]);
      expect(result.message).toBe('Doctor not available on this day');
    });

    test('should exclude slots with existing appointments', async () => {
      const doctorId = doctor.id;
      const date = '2024-12-16';
      
      const mockSchedule = {
        ...doctorSchedule,
        doctor,
        isAvailable: true,
        operatingHours: {
          start: '09:00',
          end: '11:00'
        }
      };

      const existingAppointments = [
        {
          startTime: new Date('2024-12-16T09:00:00.000Z'),
          endTime: new Date('2024-12-16T09:30:00.000Z')
        }
      ];

      mockPrisma.doctorSchedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrisma.appointment.findMany.mockResolvedValue(existingAppointments);

      const result = await appointmentService.generateAvailableSlots(doctorId, date, 30);

      // Should skip the 9:00-9:30 slot
      const conflictingSlot = result.slots.find(slot => 
        slot.startTime.getHours() === 9 && slot.startTime.getMinutes() === 0
      );
      expect(conflictingSlot).toBeUndefined();

      // Should include the 9:30-10:00 slot
      const availableSlot = result.slots.find(slot => 
        slot.startTime.getHours() === 9 && slot.startTime.getMinutes() === 30
      );
      expect(availableSlot).toBeDefined();
    });

    test('should handle doctor schedule not available', async () => {
      const doctorId = doctor.id;
      const date = '2024-12-16';
      
      const mockSchedule = {
        ...doctorSchedule,
        doctor,
        isAvailable: false // Not available
      };

      mockPrisma.doctorSchedule.findUnique.mockResolvedValue(mockSchedule);

      const result = await appointmentService.generateAvailableSlots(doctorId, date);

      expect(result.slots).toEqual([]);
    });
  });

  describe('checkSlotAvailability', () => {
    test('should return true when slot is available', async () => {
      const doctorId = doctor.id;
      const startTime = new Date('2024-12-16T10:00:00.000Z');
      const endTime = new Date('2024-12-16T10:30:00.000Z');

      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      const result = await appointmentService.checkSlotAvailability(doctorId, startTime, endTime);

      expect(result).toBe(true);
      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          doctorId,
          startTime: {
            lt: endTime
          },
          endTime: {
            gt: startTime
          },
          status: {
            not: 'CANCELLED'
          }
        }
      });
    });

    test('should return false when slot is not available', async () => {
      const doctorId = doctor.id;
      const startTime = new Date('2024-12-16T10:00:00.000Z');
      const endTime = new Date('2024-12-16T10:30:00.000Z');

      const conflictingAppointment = {
        id: 'apt-conflict',
        startTime: new Date('2024-12-16T10:15:00.000Z'),
        endTime: new Date('2024-12-16T10:45:00.000Z')
      };

      mockPrisma.appointment.findFirst.mockResolvedValue(conflictingAppointment);

      const result = await appointmentService.checkSlotAvailability(doctorId, startTime, endTime);

      expect(result).toBe(false);
    });
  });

  describe('createAppointment', () => {
    test('should create appointment when slot is available', async () => {
      const appointmentData = {
        organizationId: organization.id,
        patientId: patient.id,
        doctorId: doctor.id,
        startTime: '2024-12-16T10:00:00.000Z',
        endTime: '2024-12-16T10:30:00.000Z',
        source: 'WHATSAPP',
        channel: 'whatsapp',
        notes: 'Test appointment'
      };

      const expectedAppointment = {
        ...appointment,
        ...appointmentData,
        startTime: new Date(appointmentData.startTime),
        endTime: new Date(appointmentData.endTime)
      };

      // Mock slot availability check
      jest.spyOn(appointmentService, 'checkSlotAvailability')
        .mockResolvedValue(true);

      mockPrisma.appointment.create.mockResolvedValue(expectedAppointment);

      const result = await appointmentService.createAppointment(appointmentData);

      expect(appointmentService.checkSlotAvailability).toHaveBeenCalledWith(
        doctor.id,
        new Date('2024-12-16T10:00:00.000Z'),
        new Date('2024-12-16T10:30:00.000Z')
      );

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
        data: {
          organizationId: organization.id,
          patientId: patient.id,
          doctorId: doctor.id,
          startTime: new Date('2024-12-16T10:00:00.000Z'),
          endTime: new Date('2024-12-16T10:30:00.000Z'),
          status: 'BOOKED',
          source: 'WHATSAPP',
          channel: 'whatsapp',
          notes: 'Test appointment',
          metadata: {}
        },
        include: {
          patient: true,
          doctor: true
        }
      });

      expect(result).toEqual(expectedAppointment);
    });

    test('should throw error when slot is not available', async () => {
      const appointmentData = {
        organizationId: organization.id,
        patientId: patient.id,
        doctorId: doctor.id,
        startTime: '2024-12-16T10:00:00.000Z',
        endTime: '2024-12-16T10:30:00.000Z'
      };

      // Mock slot availability check to return false
      jest.spyOn(appointmentService, 'checkSlotAvailability')
        .mockResolvedValue(false);

      await expect(appointmentService.createAppointment(appointmentData))
        .rejects.toThrow('Appointment slot is not available');
    });

    test('should use default values', async () => {
      const appointmentData = {
        organizationId: organization.id,
        patientId: patient.id,
        doctorId: doctor.id,
        startTime: '2024-12-16T10:00:00.000Z',
        endTime: '2024-12-16T10:30:00.000Z'
      };

      jest.spyOn(appointmentService, 'checkSlotAvailability')
        .mockResolvedValue(true);

      mockPrisma.appointment.create.mockResolvedValue(appointment);

      await appointmentService.createAppointment(appointmentData);

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith({
        data: {
          organizationId: organization.id,
          patientId: patient.id,
          doctorId: doctor.id,
          startTime: new Date('2024-12-16T10:00:00.000Z'),
          endTime: new Date('2024-12-16T10:30:00.000Z'),
          status: 'BOOKED', // default
          source: 'MANUAL', // default
          channel: 'voice', // default
          notes: undefined,
          metadata: {} // default
        },
        include: {
          patient: true,
          doctor: true
        }
      });
    });
  });

  describe('rescheduleAppointment', () => {
    test('should reschedule appointment to new available slot', async () => {
      const appointmentId = appointment.id;
      const rescheduleData = {
        newStartTime: '2024-12-16T14:00:00.000Z',
        newEndTime: '2024-12-16T14:30:00.000Z',
        reason: 'Patient requested change'
      };

      const mockAppointment = {
        ...appointment,
        doctor
      };

      jest.spyOn(appointmentService, 'checkSlotAvailability')
        .mockResolvedValue(true);

      mockPrisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      
      const mockTransaction = {
        appointment: {
          update: jest.fn().mockResolvedValue({
            ...mockAppointment,
            startTime: new Date(rescheduleData.newStartTime),
            endTime: new Date(rescheduleData.newEndTime)
          })
        },
        patientNote: {
          create: jest.fn().mockResolvedValue({ id: 'note-123' })
        }
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTransaction);
      });

      const result = await appointmentService.rescheduleAppointment(appointmentId, rescheduleData);

      expect(mockTransaction.appointment.update).toHaveBeenCalledWith({
        where: { id: appointmentId },
        data: {
          startTime: new Date(rescheduleData.newStartTime),
          endTime: new Date(rescheduleData.newEndTime),
          metadata: expect.objectContaining({
            rescheduleHistory: expect.arrayContaining([
              expect.objectContaining({
                originalStartTime: appointment.startTime,
                originalEndTime: appointment.endTime,
                newStartTime: new Date(rescheduleData.newStartTime),
                newEndTime: new Date(rescheduleData.newEndTime),
                reason: 'Patient requested change',
                rescheduledAt: expect.any(Date)
              })
            ])
          })
        },
        include: {
          patient: true,
          doctor: true
        }
      });

      expect(mockTransaction.patientNote.create).toHaveBeenCalledWith({
        data: {
          patientId: patient.id,
          noteType: 'administrative',
          content: expect.stringContaining('Appointment rescheduled'),
          createdBy: undefined
        }
      });
    });

    test('should throw error when appointment not found', async () => {
      const appointmentId = 'nonexistent-appointment';
      const rescheduleData = {
        newStartTime: '2024-12-16T14:00:00.000Z',
        newEndTime: '2024-12-16T14:30:00.000Z'
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(appointmentService.rescheduleAppointment(appointmentId, rescheduleData))
        .rejects.toThrow('Appointment not found');
    });

    test('should throw error when appointment is completed', async () => {
      const appointmentId = appointment.id;
      const rescheduleData = {
        newStartTime: '2024-12-16T14:00:00.000Z',
        newEndTime: '2024-12-16T14:30:00.000Z'
      };

      const completedAppointment = {
        ...appointment,
        status: 'COMPLETED'
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(completedAppointment);

      await expect(appointmentService.rescheduleAppointment(appointmentId, rescheduleData))
        .rejects.toThrow('Cannot reschedule appointment with status: COMPLETED');
    });
  });

  describe('cancelAppointment', () => {
    test('should cancel appointment successfully', async () => {
      const appointmentId = appointment.id;
      const cancelData = {
        reason: 'Patient request',
        cancelledBy: 'user-123'
      };

      const mockAppointment = {
        ...appointment,
        patient,
        doctor
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      const mockTransaction = {
        appointment: {
          update: jest.fn().mockResolvedValue({
            ...mockAppointment,
            status: 'CANCELLED'
          })
        },
        patientNote: {
          create: jest.fn().mockResolvedValue({ id: 'note-456' })
        }
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTransaction);
      });

      const result = await appointmentService.cancelAppointment(appointmentId, cancelData);

      expect(mockTransaction.appointment.update).toHaveBeenCalledWith({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          metadata: expect.objectContaining({
            cancellationInfo: {
              cancelledAt: expect.any(Date),
              cancelledBy: 'user-123',
              reason: 'Patient request'
            }
          })
        },
        include: {
          patient: true,
          doctor: true
        }
      });

      expect(result.status).toBe('CANCELLED');
    });

    test('should throw error when appointment not found', async () => {
      const appointmentId = 'nonexistent-appointment';
      const cancelData = { reason: 'Test' };

      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(appointmentService.cancelAppointment(appointmentId, cancelData))
        .rejects.toThrow('Appointment not found');
    });

    test('should throw error when appointment already cancelled', async () => {
      const appointmentId = appointment.id;
      const cancelData = { reason: 'Test' };

      const cancelledAppointment = {
        ...appointment,
        status: 'CANCELLED'
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(cancelledAppointment);

      await expect(appointmentService.cancelAppointment(appointmentId, cancelData))
        .rejects.toThrow('Appointment is already cancelled');
    });
  });

  describe('getPatientAppointments', () => {
    test('should return patient appointments with filters', async () => {
      const patientId = patient.id;
      const options = {
        status: 'BOOKED',
        startDate: '2024-12-01',
        endDate: '2024-12-31',
        limit: 10,
        offset: 0
      };

      const mockAppointments = [
        {
          ...appointment,
          doctor: { firstName: 'John', lastName: 'Doe' }
        }
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await appointmentService.getPatientAppointments(patientId, options);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          patientId,
          status: 'BOOKED',
          startTime: {
            gte: new Date('2024-12-01T00:00:00.000Z'),
            lte: new Date('2024-12-31T00:00:00.000Z')
          }
        },
        orderBy: { startTime: 'desc' },
        take: 10,
        skip: 0,
        include: {
          doctor: true
        }
      });

      expect(result).toEqual(mockAppointments);
    });

    test('should use default options when none provided', async () => {
      const patientId = patient.id;

      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await appointmentService.getPatientAppointments(patientId);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: { patientId },
        orderBy: { startTime: 'desc' },
        take: 50, // default
        skip: 0,  // default
        include: {
          doctor: true
        }
      });
    });
  });

  describe('getDoctorAppointments', () => {
    test('should return doctor appointments for specific date', async () => {
      const doctorId = doctor.id;
      const date = '2024-12-16';

      const mockAppointments = [
        {
          ...appointment,
          patient: { firstName: 'Jane', lastName: 'Doe' }
        }
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await appointmentService.getDoctorAppointments(doctorId, date);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          doctorId,
          startTime: {
            gte: new Date('2024-12-16T00:00:00.000Z'),
            lte: new Date('2024-12-16T23:59:59.999Z')
          }
        },
        orderBy: { startTime: 'asc' },
        include: {
          patient: true
        }
      });

      expect(result).toEqual(mockAppointments);
    });
  });

  describe('parseTime', () => {
    test('should parse time string correctly', () => {
      const time1 = appointmentService.parseTime('09:30');
      expect(time1.hours).toBe(9);
      expect(time1.minutes).toBe(30);

      const time2 = appointmentService.parseTime('14:45');
      expect(time2.hours).toBe(14);
      expect(time2.minutes).toBe(45);

      const time3 = appointmentService.parseTime('23:59');
      expect(time3.hours).toBe(23);
      expect(time3.minutes).toBe(59);
    });
  });
});