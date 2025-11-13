const AppointmentService = require('../../src/patientflow/AppointmentService');
const { createMockPrisma } = require('./utils/mockPrisma');

describe('AppointmentService', () => {
  let appointmentService;
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    appointmentService = new AppointmentService(mockPrisma);
  });

  describe('generateAvailableSlots', () => {
    it('should generate available slots for a doctor', async () => {
      const mockDoctor = {
        id: 'doctor-1',
        firstName: 'John',
        schedules: [
          {
            id: 'schedule-1',
            doctorId: 'doctor-1',
            dayOfWeek: 1,
            timeSlots: JSON.stringify([{ start: '09:00', end: '12:00' }]),
            slotDurationMinutes: 30,
            isActive: true,
          },
        ],
      };

      mockPrisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const startDate = new Date('2025-01-06');
      const endDate = new Date('2025-01-06');

      const result = await appointmentService.generateAvailableSlots(
        'doctor-1',
        startDate,
        endDate,
        'org-1'
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('doctorId');
      expect(result[0]).toHaveProperty('start');
      expect(result[0]).toHaveProperty('end');
      expect(result[0]).toHaveProperty('duration');
    });

    it('should exclude conflicting appointments', async () => {
      const mockDoctor = {
        id: 'doctor-1',
        schedules: [
          {
            dayOfWeek: 1,
            timeSlots: JSON.stringify([{ start: '09:00', end: '12:00' }]),
            slotDurationMinutes: 30,
            isActive: true,
          },
        ],
      };

      const conflictingAppointment = {
        id: 'apt-1',
        doctorId: 'doctor-1',
        startTime: new Date('2025-01-06T09:00:00'),
        endTime: new Date('2025-01-06T09:30:00'),
      };

      mockPrisma.doctor.findUnique.mockResolvedValue(mockDoctor);
      mockPrisma.appointment.findMany.mockResolvedValue([conflictingAppointment]);

      const startDate = new Date('2025-01-06');
      const endDate = new Date('2025-01-06');

      const result = await appointmentService.generateAvailableSlots(
        'doctor-1',
        startDate,
        endDate,
        'org-1'
      );

      const conflictingSlots = result.filter(
        (slot) =>
          slot.start.getTime() === conflictingAppointment.startTime.getTime()
      );

      expect(conflictingSlots.length).toBe(0);
    });

    it('should throw error if doctorId is missing', async () => {
      const startDate = new Date();
      const endDate = new Date();

      await expect(
        appointmentService.generateAvailableSlots(null, startDate, endDate, 'org-1')
      ).rejects.toThrow('doctorId, startDate, and endDate are required');
    });
  });

  describe('bookAppointment', () => {
    it('should book an appointment successfully', async () => {
      const mockAppointment = {
        id: 'apt-1',
        organizationId: 'org-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        status: 'BOOKED',
        source: 'WHATSAPP',
        channel: 'VOICE',
        startTime: new Date('2025-01-07T10:00:00'),
        endTime: new Date('2025-01-07T10:30:00'),
        reason: 'Regular checkup',
        patient: { id: 'patient-1', firstName: 'Alice' },
        doctor: { id: 'doctor-1', firstName: 'John' },
      };

      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      mockPrisma.appointment.create.mockResolvedValue(mockAppointment);

      const appointmentData = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: '2025-01-07T10:00:00',
        endTime: '2025-01-07T10:30:00',
        reason: 'Regular checkup',
      };

      const result = await appointmentService.bookAppointment('org-1', appointmentData);

      expect(result).toEqual(mockAppointment);
      expect(result.status).toBe('BOOKED');
      expect(mockPrisma.appointment.create).toHaveBeenCalled();
    });

    it('should throw error on time slot conflict', async () => {
      const conflictingAppointment = {
        id: 'apt-existing',
        doctorId: 'doctor-1',
        startTime: new Date('2025-01-07T10:00:00'),
        endTime: new Date('2025-01-07T10:30:00'),
      };

      mockPrisma.appointment.findFirst.mockResolvedValue(conflictingAppointment);

      const appointmentData = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        startTime: '2025-01-07T10:00:00',
        endTime: '2025-01-07T10:30:00',
      };

      await expect(
        appointmentService.bookAppointment('org-1', appointmentData)
      ).rejects.toThrow('Time slot conflict with existing appointment');
    });

    it('should throw error if required fields are missing', async () => {
      const incompleteData = {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
      };

      await expect(
        appointmentService.bookAppointment('org-1', incompleteData)
      ).rejects.toThrow('patientId, doctorId, startTime, and endTime are required');
    });
  });

  describe('rescheduleAppointment', () => {
    it('should reschedule an appointment', async () => {
      const existingAppointment = {
        id: 'apt-1',
        doctorId: 'doctor-1',
        status: 'BOOKED',
        startTime: new Date('2025-01-07T10:00:00'),
        endTime: new Date('2025-01-07T10:30:00'),
      };

      const rescheduledAppointment = {
        ...existingAppointment,
        startTime: new Date('2025-01-08T14:00:00'),
        endTime: new Date('2025-01-08T14:30:00'),
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      mockPrisma.appointment.update.mockResolvedValue(rescheduledAppointment);

      const result = await appointmentService.rescheduleAppointment(
        'apt-1',
        '2025-01-08T14:00:00',
        '2025-01-08T14:30:00'
      );

      expect(result.startTime).toEqual(rescheduledAppointment.startTime);
      expect(mockPrisma.appointment.update).toHaveBeenCalled();
    });

    it('should throw error if appointment is cancelled', async () => {
      const cancelledAppointment = {
        id: 'apt-1',
        status: 'CANCELLED',
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(cancelledAppointment);

      await expect(
        appointmentService.rescheduleAppointment('apt-1', '2025-01-08T14:00:00', '2025-01-08T14:30:00')
      ).rejects.toThrow('Cannot reschedule a cancelled appointment');
    });

    it('should detect conflict when rescheduling', async () => {
      const existingAppointment = {
        id: 'apt-1',
        doctorId: 'doctor-1',
        status: 'BOOKED',
      };

      const conflictingAppointment = {
        id: 'apt-other',
        doctorId: 'doctor-1',
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      mockPrisma.appointment.findFirst.mockResolvedValue(conflictingAppointment);

      await expect(
        appointmentService.rescheduleAppointment('apt-1', '2025-01-08T14:00:00', '2025-01-08T14:30:00')
      ).rejects.toThrow('Time slot conflict with existing appointment');
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel an appointment', async () => {
      const appointment = {
        id: 'apt-1',
        status: 'BOOKED',
        reason: 'Regular checkup',
      };

      const cancelledAppointment = {
        ...appointment,
        status: 'CANCELLED',
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(appointment);
      mockPrisma.appointment.update.mockResolvedValue(cancelledAppointment);

      const result = await appointmentService.cancelAppointment('apt-1', 'Patient requested cancellation');

      expect(result.status).toBe('CANCELLED');
      expect(mockPrisma.appointment.update).toHaveBeenCalled();
    });

    it('should throw error if already cancelled', async () => {
      const cancelledAppointment = {
        id: 'apt-1',
        status: 'CANCELLED',
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(cancelledAppointment);

      await expect(
        appointmentService.cancelAppointment('apt-1')
      ).rejects.toThrow('Appointment is already cancelled');
    });

    it('should throw error if appointment not found', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        appointmentService.cancelAppointment('apt-999')
      ).rejects.toThrow('Appointment not found: apt-999');
    });
  });

  describe('getAppointmentsByDoctor', () => {
    it('should return appointments for a doctor', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          doctorId: 'doctor-1',
          status: 'BOOKED',
          startTime: new Date('2025-01-07T10:00:00'),
        },
        {
          id: 'apt-2',
          doctorId: 'doctor-1',
          status: 'CONFIRMED',
          startTime: new Date('2025-01-07T11:00:00'),
        },
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await appointmentService.getAppointmentsByDoctor('doctor-1');

      expect(result).toEqual(mockAppointments);
      expect(result.length).toBe(2);
    });

    it('should filter appointments by date range', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const startDate = new Date('2025-01-07');
      const endDate = new Date('2025-01-08');

      await appointmentService.getAppointmentsByDoctor('doctor-1', startDate, endDate);

      const callArg = mockPrisma.appointment.findMany.mock.calls[0][0];
      expect(callArg.where.AND).toBeDefined();
    });
  });

  describe('getAppointmentsByPatient', () => {
    it('should return appointments for a patient', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          patientId: 'patient-1',
          status: 'BOOKED',
          doctor: { id: 'doctor-1', firstName: 'John' },
        },
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments);

      const result = await appointmentService.getAppointmentsByPatient('patient-1');

      expect(result).toEqual(mockAppointments);
      expect(mockPrisma.appointment.findMany).toHaveBeenCalled();
    });

    it('should throw error if patientId is missing', async () => {
      await expect(
        appointmentService.getAppointmentsByPatient(null)
      ).rejects.toThrow('patientId is required');
    });
  });

  describe('confirmAppointment', () => {
    it('should confirm an appointment', async () => {
      const appointment = {
        id: 'apt-1',
        status: 'BOOKED',
      };

      const confirmedAppointment = {
        ...appointment,
        status: 'CONFIRMED',
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(appointment);
      mockPrisma.appointment.update.mockResolvedValue(confirmedAppointment);

      const result = await appointmentService.confirmAppointment('apt-1');

      expect(result.status).toBe('CONFIRMED');
      expect(mockPrisma.appointment.update).toHaveBeenCalled();
    });
  });

  describe('sendReminder', () => {
    it('should mark reminder as sent', async () => {
      const appointment = {
        id: 'apt-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        reminderSent: false,
      };

      const reminderSentAppointment = {
        ...appointment,
        reminderSent: true,
        reminderSentAt: new Date(),
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(appointment);
      mockPrisma.appointment.update.mockResolvedValue(reminderSentAppointment);

      const result = await appointmentService.sendReminder('apt-1');

      expect(result.reminderSent).toBe(true);
      expect(mockPrisma.appointment.update).toHaveBeenCalled();
    });
  });
});
