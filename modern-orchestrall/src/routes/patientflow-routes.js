// src/routes/patientflow-routes.js - PatientFlow Dashboard API Routes
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');

const prisma = new PrismaClient();

// Schema definitions for validation
const organizationIdSchema = z.string().uuid();
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Helper function to calculate date ranges
function getDateRange(startDate, endDate, daysBack = 7) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  return { start, end };
}

// Get dashboard overview metrics
async function getDashboardOverview(organizationId, dateRange) {
  const { start, end } = dateRange;
  
  // Get metrics in parallel for performance
  const [
    totalMessages,
    totalCalls,
    totalAppointments,
    activeConversations,
    upcomingAppointments,
    recentMessages
  ] = await Promise.all([
    // Total messages in date range
    prisma.patientMessageLog.count({
      where: {
        organizationId,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    }),
    
    // Total calls in date range
    prisma.patientCallLog.count({
      where: {
        organizationId,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    }),
    
    // Total appointments in date range
    prisma.appointment.count({
      where: {
        organizationId,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    }),
    
    // Active conversations (messages in last 24 hours)
    prisma.patientMessageLog.groupBy({
      by: ['patientId'],
      where: {
        organizationId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),
    
    // Upcoming appointments
    prisma.appointment.count({
      where: {
        organizationId,
        status: 'BOOKED',
        scheduledStart: {
          gte: new Date()
        }
      }
    }),
    
    // Recent messages for activity feed
    prisma.patientMessageLog.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: start
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })
  ]);

  return {
    metrics: {
      totalMessages,
      totalCalls,
      totalAppointments,
      activeConversations: activeConversations.length,
      upcomingAppointments
    },
    recentMessages: recentMessages.map(msg => ({
      id: msg.id,
      patientName: `${msg.patient.firstName} ${msg.patient.lastName}`,
      patientPhone: msg.patient.phone,
      content: msg.content,
      direction: msg.direction,
      channel: msg.channel,
      timestamp: msg.createdAt
    }))
  };
}

// Get upcoming appointments with filters
async function getUpcomingAppointments(organizationId, filters = {}) {
  const { status, doctorId, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;
  
  const where = {
    organizationId,
    scheduledStart: {
      gte: new Date()
    }
  };
  
  if (status) {
    where.status = status;
  }
  
  if (doctorId) {
    where.doctorId = doctorId;
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true
          }
        }
      },
      orderBy: {
        scheduledStart: 'asc'
      },
      skip,
      take: limit
    }),
    
    prisma.appointment.count({ where })
  ]);

  return {
    appointments: appointments.map(apt => ({
      id: apt.id,
      patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
      patientPhone: apt.patient.phone,
      doctorName: `${apt.doctor.firstName} ${apt.doctor.lastName}`,
      doctorSpecialization: apt.doctor.specialization,
      status: apt.status,
      source: apt.source,
      scheduledStart: apt.scheduledStart,
      scheduledEnd: apt.scheduledEnd,
      notes: apt.notes
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// Get active call sessions
async function getActiveCallSessions(organizationId) {
  const activeCalls = await prisma.patientCallLog.findMany({
    where: {
      organizationId,
      status: {
        in: ['INITIATED', 'IN_PROGRESS']
      }
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 20
  });

  return {
    activeCalls: activeCalls.map(call => ({
      id: call.id,
      patientName: `${call.patient.firstName} ${call.patient.lastName}`,
      patientPhone: call.patient.phone,
      status: call.status,
      direction: call.direction,
      duration: call.duration,
      startTime: call.createdAt,
      summary: call.summary,
      transcript: call.transcript ? call.transcript.substring(0, 200) + '...' : null
    }))
  };
}

// Get recent activities (messages and calls)
async function getRecentActivities(organizationId, limit = 50) {
  const [recentMessages, recentCalls] = await Promise.all([
    prisma.patientMessageLog.findMany({
      where: {
        organizationId
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    }),
    
    prisma.patientCallLog.findMany({
      where: {
        organizationId
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })
  ]);

  // Combine and sort activities
  const activities = [
    ...recentMessages.map(msg => ({
      id: msg.id,
      type: 'message',
      patientName: `${msg.patient.firstName} ${msg.patient.lastName}`,
      patientPhone: msg.patient.phone,
      direction: msg.direction,
      channel: msg.channel,
      content: msg.content,
      timestamp: msg.createdAt
    })),
    ...recentCalls.map(call => ({
      id: call.id,
      type: 'call',
      patientName: `${call.patient.firstName} ${call.patient.lastName}`,
      patientPhone: call.patient.phone,
      direction: call.direction,
      status: call.status,
      duration: call.duration,
      summary: call.summary,
      timestamp: call.createdAt
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
   .slice(0, limit);

  return { activities };
}

module.exports = function (fastify, opts, done) {
  // Dashboard overview endpoint
  fastify.get('/patientflow/api/dashboard/overview', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get dashboard overview metrics',
      tags: ['PatientFlow Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            metrics: {
              type: 'object',
              properties: {
                totalMessages: { type: 'number' },
                totalCalls: { type: 'number' },
                totalAppointments: { type: 'number' },
                activeConversations: { type: 'number' },
                upcomingAppointments: { type: 'number' }
              }
            },
            recentMessages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  patientName: { type: 'string' },
                  patientPhone: { type: 'string' },
                  content: { type: 'string' },
                  direction: { type: 'string' },
                  channel: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { startDate, endDate } = request.query;
      const organizationId = request.organizationId;
      
      // Validate inputs
      organizationIdSchema.parse(organizationId);
      const dateRange = dateRangeSchema.parse({ startDate, endDate });
      const resolvedDateRange = getDateRange(startDate, endDate);
      
      const overview = await getDashboardOverview(organizationId, resolvedDateRange);
      
      return overview;
    } catch (error) {
      fastify.log.error('Dashboard overview error:', error);
      reply.code(500).send({ error: 'Failed to fetch dashboard overview' });
    }
  });

  // Upcoming appointments endpoint
  fastify.get('/patientflow/api/dashboard/appointments', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get upcoming appointments with filters',
      tags: ['PatientFlow Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['BOOKED', 'CONFIRMED', 'CANCELLED'] },
          doctorId: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const organizationId = request.organizationId;
      const filters = request.query;
      
      organizationIdSchema.parse(organizationId);
      
      const appointments = await getUpcomingAppointments(organizationId, filters);
      
      return appointments;
    } catch (error) {
      fastify.log.error('Appointments error:', error);
      reply.code(500).send({ error: 'Failed to fetch appointments' });
    }
  });

  // Active call sessions endpoint
  fastify.get('/patientflow/api/dashboard/calls/active', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get active call sessions',
      tags: ['PatientFlow Dashboard']
    }
  }, async (request, reply) => {
    try {
      const organizationId = request.organizationId;
      
      organizationIdSchema.parse(organizationId);
      
      const activeCalls = await getActiveCallSessions(organizationId);
      
      return activeCalls;
    } catch (error) {
      fastify.log.error('Active calls error:', error);
      reply.code(500).send({ error: 'Failed to fetch active calls' });
    }
  });

  // Recent activities endpoint
  fastify.get('/patientflow/api/dashboard/activities', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get recent activities (messages and calls)',
      tags: ['PatientFlow Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 200, default: 50 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const organizationId = request.organizationId;
      const { limit = 50 } = request.query;
      
      organizationIdSchema.parse(organizationId);
      
      const activities = await getRecentActivities(organizationId, limit);
      
      return activities;
    } catch (error) {
      fastify.log.error('Activities error:', error);
      reply.code(500).send({ error: 'Failed to fetch activities' });
    }
  });

  // Live conversations (real-time message polling)
  fastify.get('/patientflow/api/dashboard/conversations/live', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get live conversations (recent messages)',
      tags: ['PatientFlow Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', format: 'date-time' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const organizationId = request.organizationId;
      const { since, limit = 20 } = request.query;
      
      organizationIdSchema.parse(organizationId);
      
      const where = {
        organizationId
      };
      
      if (since) {
        where.createdAt = {
          gte: new Date(since)
        };
      } else {
        // Default to last 2 hours
        where.createdAt = {
          gte: new Date(Date.now() - 2 * 60 * 60 * 1000)
        };
      }
      
      const messages = await prisma.patientMessageLog.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return {
        conversations: messages.map(msg => ({
          id: msg.id,
          patientName: `${msg.patient.firstName} ${msg.patient.lastName}`,
          patientPhone: msg.patient.phone,
          content: msg.content,
          direction: msg.direction,
          channel: msg.channel,
          timestamp: msg.createdAt,
          metadata: msg.channelMetadata
        }))
      };
    } catch (error) {
      fastify.log.error('Live conversations error:', error);
      reply.code(500).send({ error: 'Failed to fetch live conversations' });
    }
  });

  done();
};