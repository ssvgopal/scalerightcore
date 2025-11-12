const monitoringService = require('../monitoring');

const inboundMessagesTotal = monitoringService.metrics.patientflow_inbound_messages_total
  || monitoringService.createCustomCounter(
    'patientflow_inbound_messages_total',
    'Total number of inbound PatientFlow messages by channel',
    ['organizationId', 'channel']
  );

const outboundMessagesTotal = monitoringService.metrics.patientflow_outbound_messages_total
  || monitoringService.createCustomCounter(
    'patientflow_outbound_messages_total',
    'Total number of outbound PatientFlow messages by channel',
    ['organizationId', 'channel']
  );

const appointmentsBookedTotal = monitoringService.metrics.patientflow_appointments_booked_total
  || monitoringService.createCustomCounter(
    'patientflow_appointments_booked_total',
    'Total number of appointments booked via PatientFlow',
    ['organizationId']
  );

const webhookDurationSeconds = monitoringService.metrics.patientflow_webhook_duration_seconds
  || monitoringService.createCustomHistogram(
    'patientflow_webhook_duration_seconds',
    'Processing duration for PatientFlow WhatsApp webhooks',
    ['organizationId'],
    [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
  );

function recordInbound(organizationId, channel = 'WHATSAPP') {
  if (!organizationId) {
    return;
  }

  inboundMessagesTotal.inc({ organizationId, channel });
}

function recordOutbound(organizationId, channel = 'WHATSAPP') {
  if (!organizationId) {
    return;
  }

  outboundMessagesTotal.inc({ organizationId, channel });
}

function recordAppointmentBooked(organizationId) {
  if (!organizationId) {
    return;
  }

  appointmentsBookedTotal.inc({ organizationId });
}

function observeWebhookDuration(organizationId, durationMs) {
  if (!organizationId) {
    return;
  }

  webhookDurationSeconds.observe({ organizationId }, durationMs / 1000);
}

module.exports = {
  recordInbound,
  recordOutbound,
  recordAppointmentBooked,
  observeWebhookDuration,
};
