const PatientService = require('./services/patient-service');
const DoctorService = require('./services/doctor-service');
const AppointmentService = require('./services/appointment-service');
const ConversationSessionService = require('./services/conversation-session-service');
const InteractionLogger = require('./services/interaction-logger');
const schemas = require('./validation/schemas');

/**
 * PatientFlow Fastify Plugin
 * Exposes REST endpoints for patient flow management
 */
async function patientFlowRoutes(fastify, options) {
  const { prisma, redis } = options;

  // Initialize services
  const patientService = new PatientService(prisma);
  const doctorService = new DoctorService(prisma);
  const appointmentService = new AppointmentService(prisma);
  const conversationSessionService = new ConversationSessionService(prisma, redis);
  const interactionLogger = new InteractionLogger(prisma);

  // Authentication middleware hook
  const authenticate = async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  };

  // ===== CLINIC BRANCH ENDPOINTS =====

  /**
   * GET /patientflow/api/branches
   * List all clinic branches for organization
   */
  fastify.get(
    '/patientflow/api/branches',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const branches = await doctorService.getAllBranches(request.user.organizationId);
        reply.send({
          success: true,
          data: branches,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/branches/:branchId
   * Get a specific clinic branch
   */
  fastify.get(
    '/patientflow/api/branches/:branchId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { branchId } = request.params;
        const branch = await doctorService.getBranchById(branchId);

        if (!branch) {
          return reply.code(404).send({ error: 'Branch not found' });
        }

        reply.send({
          success: true,
          data: branch,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // ===== DOCTOR ENDPOINTS =====

  /**
   * GET /patientflow/api/doctors
   * Search and list doctors
   */
  fastify.get(
    '/patientflow/api/doctors',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { branchId, specialty, isAvailable } = request.query;
        const filters = {};

        if (branchId) filters.branchId = branchId;
        if (specialty) filters.specialty = specialty;
        if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';

        const doctors = await doctorService.searchDoctors(
          request.user.organizationId,
          filters
        );

        reply.send({
          success: true,
          data: doctors,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/doctors/:doctorId
   * Get doctor details
   */
  fastify.get(
    '/patientflow/api/doctors/:doctorId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { doctorId } = request.params;
        const doctor = await doctorService.getDoctorById(doctorId);

        if (!doctor) {
          return reply.code(404).send({ error: 'Doctor not found' });
        }

        reply.send({
          success: true,
          data: doctor,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/doctors/:doctorId/availability
   * Get doctor availability for a specific date
   */
  fastify.get(
    '/patientflow/api/doctors/:doctorId/availability',
    {
      preHandler: authenticate,
      schema: {
        querystring: availabilityQuerySchema,
      },
    },
    async (request, reply) => {
      try {
        const { doctorId } = request.params;
        const { date, durationMinutes = 30 } = request.query;

        const availability = await doctorService.getDoctorAvailability(
          doctorId,
          date,
          parseInt(durationMinutes)
        );

        reply.send({
          success: true,
          data: availability,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // ===== PATIENT ENDPOINTS =====

  /**
   * GET /patientflow/api/patients/lookup
   * Lookup patient by phone
   */
  fastify.get(
    '/patientflow/api/patients/lookup',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { phone } = request.query;

        if (!phone) {
          return reply.code(400).send({ error: 'Phone number is required' });
        }

        const patient = await patientService.lookupByPhone(
          request.user.organizationId,
          phone
        );

        reply.send({
          success: true,
          data: patient,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /patientflow/api/patients
   * Create new patient
   */
  fastify.post(
    '/patientflow/api/patients',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const validationResult = schemas.patientSchema.safeParse(request.body);

        if (!validationResult.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: validationResult.error.errors,
          });
        }

        const patient = await patientService.createPatient(
          request.user.organizationId,
          validationResult.data
        );

        reply.code(201).send({
          success: true,
          data: patient,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/patients/:patientId
   * Get patient profile with history
   */
  fastify.get(
    '/patientflow/api/patients/:patientId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const patient = await patientService.getPatientProfile(patientId);

        reply.send({
          success: true,
          data: patient,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * PUT /patientflow/api/patients/:patientId
   * Update patient information
   */
  fastify.put(
    '/patientflow/api/patients/:patientId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const patient = await patientService.updatePatient(patientId, request.body);

        reply.send({
          success: true,
          data: patient,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/patients/:patientId/preferences
   * Get patient preferences
   */
  fastify.get(
    '/patientflow/api/patients/:patientId/preferences',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const preference = await patientService.getOrCreatePreference(patientId);

        reply.send({
          success: true,
          data: preference,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * PUT /patientflow/api/patients/:patientId/preferences
   * Update patient preferences
   */
  fastify.put(
    '/patientflow/api/patients/:patientId/preferences',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const preference = await patientService.updatePreference(patientId, request.body);

        reply.send({
          success: true,
          data: preference,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // ===== APPOINTMENT ENDPOINTS =====

  /**
   * POST /patientflow/api/appointments
   * Book an appointment
   */
  fastify.post(
    '/patientflow/api/appointments',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const validationResult = schemas.appointmentBookingSchema.safeParse(request.body);

        if (!validationResult.success) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: validationResult.error.errors,
          });
        }

        const appointment = await appointmentService.bookAppointment(
          request.user.organizationId,
          validationResult.data
        );

        reply.code(201).send({
          success: true,
          data: appointment,
        });
      } catch (error) {
        fastify.log.error(error);
        if (error.message.includes('already booked')) {
          return reply.code(409).send({ error: error.message });
        }
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/appointments/:appointmentId
   * Get appointment details
   */
  fastify.get(
    '/patientflow/api/appointments/:appointmentId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { appointmentId } = request.params;
        const appointment = await appointmentService.getAppointmentById(appointmentId);

        reply.send({
          success: true,
          data: appointment,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * PUT /patientflow/api/appointments/:appointmentId/reschedule
   * Reschedule an appointment
   */
  fastify.put(
    '/patientflow/api/appointments/:appointmentId/reschedule',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { appointmentId } = request.params;
        const { startTime, endTime, reason } = request.body;

        if (!startTime || !endTime) {
          return reply.code(400).send({
            error: 'startTime and endTime are required',
          });
        }

        const appointment = await appointmentService.rescheduleAppointment(
          appointmentId,
          startTime,
          endTime,
          reason
        );

        reply.send({
          success: true,
          data: appointment,
        });
      } catch (error) {
        fastify.log.error(error);
        if (error.message.includes('already booked')) {
          return reply.code(409).send({ error: error.message });
        }
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * DELETE /patientflow/api/appointments/:appointmentId
   * Cancel an appointment
   */
  fastify.delete(
    '/patientflow/api/appointments/:appointmentId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { appointmentId } = request.params;
        const { reason } = request.body || {};

        const appointment = await appointmentService.cancelAppointment(appointmentId, reason);

        reply.send({
          success: true,
          data: appointment,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/patients/:patientId/appointments
   * Get patient appointments
   */
  fastify.get(
    '/patientflow/api/patients/:patientId/appointments',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const { status } = request.query;

        const appointments = await appointmentService.getPatientAppointments(
          patientId,
          status
        );

        reply.send({
          success: true,
          data: appointments,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // ===== INTERACTION ENDPOINTS =====

  /**
   * GET /patientflow/api/patients/:patientId/messages
   * Get recent messages for a patient
   */
  fastify.get(
    '/patientflow/api/patients/:patientId/messages',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const { limit = 20 } = request.query;

        const messages = await interactionLogger.getRecentMessages(
          patientId,
          parseInt(limit)
        );

        reply.send({
          success: true,
          data: messages,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/patients/:patientId/calls
   * Get recent calls for a patient
   */
  fastify.get(
    '/patientflow/api/patients/:patientId/calls',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId } = request.params;
        const { limit = 20 } = request.query;

        const calls = await interactionLogger.getRecentCalls(
          patientId,
          parseInt(limit)
        );

        reply.send({
          success: true,
          data: calls,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /patientflow/api/interactions/log-message
   * Log a message interaction
   */
  fastify.post(
    '/patientflow/api/interactions/log-message',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId, channel, direction, payload, externalMessageId } = request.body;

        if (!patientId || !channel || !direction || !payload) {
          return reply.code(400).send({
            error: 'Missing required fields: patientId, channel, direction, payload',
          });
        }

        const messageLog = await interactionLogger.logMessage(
          request.user.organizationId,
          patientId,
          channel,
          direction,
          payload,
          externalMessageId
        );

        reply.code(201).send({
          success: true,
          data: messageLog,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * POST /patientflow/api/interactions/log-call
   * Log a call interaction
   */
  fastify.post(
    '/patientflow/api/interactions/log-call',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientId, callSid, status, startTime, callMetadata } = request.body;

        if (!patientId || !callSid || !status || !startTime) {
          return reply.code(400).send({
            error: 'Missing required fields: patientId, callSid, status, startTime',
          });
        }

        const callLog = await interactionLogger.logCall(
          request.user.organizationId,
          patientId,
          callSid,
          status,
          startTime,
          callMetadata
        );

        reply.code(201).send({
          success: true,
          data: callLog,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // ===== CONVERSATION SESSION ENDPOINTS =====

  /**
   * POST /patientflow/api/sessions
   * Create or get conversation session
   */
  fastify.post(
    '/patientflow/api/sessions',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { patientPhone } = request.body;

        if (!patientPhone) {
          return reply.code(400).send({ error: 'patientPhone is required' });
        }

        const session = await conversationSessionService.getOrCreateSession(
          request.user.organizationId,
          patientPhone
        );

        reply.send({
          success: true,
          data: session,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /patientflow/api/sessions/:sessionId
   * Get session details
   */
  fastify.get(
    '/patientflow/api/sessions/:sessionId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const session = await conversationSessionService.getSessionById(sessionId);

        if (!session) {
          return reply.code(404).send({ error: 'Session not found' });
        }

        reply.send({
          success: true,
          data: session,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * PUT /patientflow/api/sessions/:sessionId/state
   * Update session state
   */
  fastify.put(
    '/patientflow/api/sessions/:sessionId/state',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const stateUpdates = request.body;

        const session = await conversationSessionService.updateSessionState(
          sessionId,
          stateUpdates
        );

        reply.send({
          success: true,
          data: session,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );

  /**
   * DELETE /patientflow/api/sessions/:sessionId
   * End a session
   */
  fastify.delete(
    '/patientflow/api/sessions/:sessionId',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const session = await conversationSessionService.endSession(sessionId);

        reply.send({
          success: true,
          data: session,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

module.exports = patientFlowRoutes;
