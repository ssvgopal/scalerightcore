const { PrismaClient } = require('@prisma/client');

class AppointmentService {
  constructor(prisma = null) {
    this.prisma = prisma || new PrismaClient();
  }

  async generateAvailableSlots(doctorId, startDate, endDate, organizationId) {
    if (!doctorId || !startDate || !endDate) {
      throw new Error('doctorId, startDate, and endDate are required');
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { schedules: true },
    });

    if (!doctor) {
      throw new Error(`Doctor not found: ${doctorId}`);
    }

    const slots = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      const schedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);

      if (!schedule) continue;

      const timeSlots = JSON.parse(schedule.timeSlots || '[]');
      const bookedAppointments = await this._getBookedAppointmentsForDay(
        doctorId,
        new Date(date)
      );

      for (const timeSlot of timeSlots) {
        const slotStart = this._parseTimeToDateTime(timeSlot.start, date);
        const slotEnd = new Date(slotStart.getTime() + schedule.slotDurationMinutes * 60000);

        const isConflict = bookedAppointments.some(
          (apt) =>
            (apt.startTime < slotEnd && apt.endTime > slotStart)
        );

        if (!isConflict) {
          slots.push({
            doctorId,
            start: slotStart,
            end: slotEnd,
            duration: schedule.slotDurationMinutes,
          });
        }
      }
    }

    return slots;
  }

  async bookAppointment(organizationId, appointmentData) {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    const { patientId, doctorId, startTime, endTime, source, channel, reason } = appointmentData;

    if (!patientId || !doctorId || !startTime || !endTime) {
      throw new Error('patientId, doctorId, startTime, and endTime are required');
    }

    const conflict = await this._checkTimeConflict(doctorId, startTime, endTime);
    if (conflict) {
      throw new Error('Time slot conflict with existing appointment');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        organizationId,
        patientId,
        doctorId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'BOOKED',
        source: source || 'MANUAL',
        channel: channel || 'VOICE',
        reason,
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    return appointment;
  }

  async rescheduleAppointment(appointmentId, newStartTime, newEndTime) {
    if (!appointmentId) {
      throw new Error('appointmentId is required');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    if (appointment.status === 'CANCELLED') {
      throw new Error('Cannot reschedule a cancelled appointment');
    }

    const conflict = await this._checkTimeConflict(
      appointment.doctorId,
      newStartTime,
      newEndTime,
      appointmentId
    );

    if (conflict) {
      throw new Error('Time slot conflict with existing appointment');
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        updatedAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });
  }

  async cancelAppointment(appointmentId, reason = null) {
    if (!appointmentId) {
      throw new Error('appointmentId is required');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    if (appointment.status === 'CANCELLED') {
      throw new Error('Appointment is already cancelled');
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        internalNotes: reason,
        updatedAt: new Date(),
      },
    });
  }

  async getAppointmentsByDoctor(doctorId, startDate, endDate) {
    if (!doctorId) {
      throw new Error('doctorId is required');
    }

    const query = {
      where: { doctorId },
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { startTime: 'asc' },
    };

    if (startDate && endDate) {
      query.where.AND = [
        { startTime: { gte: new Date(startDate) } },
        { endTime: { lte: new Date(endDate) } },
      ];
    }

    return this.prisma.appointment.findMany(query);
  }

  async getAppointmentsByPatient(patientId) {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    return this.prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: true,
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async confirmAppointment(appointmentId) {
    if (!appointmentId) {
      throw new Error('appointmentId is required');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CONFIRMED',
        updatedAt: new Date(),
      },
    });
  }

  async sendReminder(appointmentId) {
    if (!appointmentId) {
      throw new Error('appointmentId is required');
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        reminderSent: true,
        reminderSentAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });
  }

  async _checkTimeConflict(doctorId, startTime, endTime, excludeAppointmentId = null) {
    const query = {
      doctorId,
      status: { not: 'CANCELLED' },
      AND: [
        { startTime: { lt: new Date(endTime) } },
        { endTime: { gt: new Date(startTime) } },
      ],
    };

    if (excludeAppointmentId) {
      query.NOT = { id: excludeAppointmentId };
    }

    const conflict = await this.prisma.appointment.findFirst({
      where: query,
    });

    return !!conflict;
  }

  async _getBookedAppointmentsForDay(doctorId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { not: 'CANCELLED' },
        startTime: { gte: startOfDay },
        endTime: { lte: endOfDay },
      },
    });
  }

  _parseTimeToDateTime(timeString, date) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }
}

module.exports = AppointmentService;
