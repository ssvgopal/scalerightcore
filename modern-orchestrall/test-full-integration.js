// test-full-integration.js - Complete integration test for PatientFlow monitoring
const monitoringService = require('./src/monitoring');
const patientFlowService = require('./src/patientflow');
const { 
  handleWhatsAppWebhook, 
  handleTwilioVoiceWebhook, 
  handleAppointmentWebhook,
  simulatePatientFlowInteractions 
} = require('./src/patientflow/webhooks');

// Mock Fastify request/reply objects
function createMockRequest(body, query = {}) {
  return { body, query };
}

function createMockReply() {
  let statusCode = 200;
  let contentType = 'application/json';
  let responseData = null;
  
  const reply = {
    statusCode: statusCode,
    type: (type) => { contentType = type; return reply; },
    send: (data) => { 
      responseData = data; 
      return Promise.resolve(data);
    }
  };
  
  reply.status = (code) => { 
    statusCode = code; 
    reply.statusCode = code;
    return reply; 
  };
  
  reply.code = reply.status;
  
  return reply;
}

async function getPatientFlowMetrics() {
  const metrics = await monitoringService.getMetrics();
  const lines = metrics.split('\n');
  
  const result = {
    messages_total: 0,
    calls_total: 0,
    bookings_total: 0,
    call_duration_observations: 0
  };
  
  for (const line of lines) {
    if (line.startsWith('patientflow_messages_total{')) {
      result.messages_total += parseInt(line.split(' ')[1]) || 0;
    } else if (line.startsWith('patientflow_calls_total{')) {
      result.calls_total += parseInt(line.split(' ')[1]) || 0;
    } else if (line.startsWith('patientflow_bookings_total{')) {
      result.bookings_total += parseInt(line.split(' ')[1]) || 0;
    } else if (line.startsWith('patientflow_call_duration_seconds_count{')) {
      result.call_duration_observations += parseInt(line.split(' ')[1]) || 0;
    }
  }
  
  return result;
}

async function runIntegrationTest() {
  console.log('🧪 Running Full PatientFlow Integration Test\n');

  try {
    // Initialize services
    await patientFlowService.initialize();
    console.log('✅ Services initialized');

    // Get baseline metrics
    const baseline = await getPatientFlowMetrics();
    console.log('📊 Baseline metrics:', baseline);

    console.log('\n🎭 Testing webhook interactions...');

    // Test WhatsApp webhook
    console.log('📱 Processing WhatsApp message...');
    const whatsappRequest = createMockRequest({
      Body: 'I need to book an appointment',
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      MessageSid: 'msg_test_123'
    });
    const whatsappReply = createMockReply();
    await handleWhatsAppWebhook(whatsappRequest, whatsappReply);

    // Test voice webhook
    console.log('📞 Processing voice call...');
    const voiceRequest = createMockRequest({
      CallSid: 'call_test_456',
      CallStatus: 'completed',
      From: '+1234567890',
      To: '+0987654321',
      Duration: '180' // 3 minutes
    });
    const voiceReply = createMockReply();
    await handleTwilioVoiceWebhook(voiceRequest, voiceReply);

    // Test appointment webhook
    console.log('📅 Processing appointment booking...');
    const appointmentRequest = createMockRequest({
      source: 'WHATSAPP',
      patientId: 'patient_123',
      doctorId: 'doctor_456',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      reason: 'Regular checkup'
    });
    const appointmentReply = createMockReply();
    await handleAppointmentWebhook(appointmentRequest, appointmentReply);

    console.log('\n🎭 Testing simulation...');
    // Test simulation for all types
    const messageRequest = createMockRequest({}, { type: 'message', count: 2 });
    const messageReply = createMockReply();
    await simulatePatientFlowInteractions(messageRequest, messageReply);
    
    const callRequest = createMockRequest({}, { type: 'call', count: 1 });
    const callReply = createMockReply();
    await simulatePatientFlowInteractions(callRequest, callReply);
    
    const bookingRequest = createMockRequest({}, { type: 'booking', count: 1 });
    const bookingReply = createMockReply();
    await simulatePatientFlowInteractions(bookingRequest, bookingReply);

    // Get updated metrics
    const updated = await getPatientFlowMetrics();
    console.log('📊 Updated metrics:', updated);

    // Verify metrics increased correctly
    console.log('\n🔍 Verifying metrics changes...');
    const messageIncrease = updated.messages_total - baseline.messages_total;
    const callIncrease = updated.calls_total - baseline.calls_total;
    const bookingIncrease = updated.bookings_total - baseline.bookings_total;
    const durationIncrease = updated.call_duration_observations - baseline.call_duration_observations;

    console.log(`📈 Messages: +${messageIncrease} (expected: +3)`);
    console.log(`📞 Calls: +${callIncrease} (expected: +2)`);
    console.log(`📅 Bookings: +${bookingIncrease} (expected: +2)`);
    console.log(`⏱️  Duration observations: +${durationIncrease} (expected: +1)`);

    // Test health checks
    console.log('\n🏥 Testing health checks...');
    const health = await monitoringService.getPatientFlowHealth();
    console.log('✅ Health check status:', health.status);
    
    if (health.checks) {
      console.log('   Twilio:', health.checks.twilio.status, '-', health.checks.twilio.message);
      console.log('   AI Provider:', health.checks.aiProvider.status, '-', health.checks.aiProvider.message);
      console.log('   Google TTS:', health.checks.googleTTS.status, '-', health.checks.googleTTS.message);
    } else {
      console.log('   Health checks structure unexpected');
    }

    // Verify Prometheus metrics format
    console.log('\n📈 Verifying Prometheus metrics format...');
    const allMetrics = await monitoringService.getMetrics();
    const patientflowMetrics = allMetrics.split('\n').filter(line => 
      line.startsWith('patientflow_') || line.startsWith('# HELP patientflow_')
    );

    const expectedMetrics = [
      '# HELP patientflow_messages_total',
      '# HELP patientflow_calls_total', 
      '# HELP patientflow_bookings_total',
      '# HELP patientflow_call_duration_seconds'
    ];

    let allMetricsPresent = true;
    for (const expected of expectedMetrics) {
      if (patientflowMetrics.some(line => line.includes(expected))) {
        console.log(`✅ Found: ${expected}`);
      } else {
        console.log(`❌ Missing: ${expected}`);
        allMetricsPresent = false;
      }
    }

    console.log('\n🎉 Integration test completed!');
    
    if (allMetricsPresent && 
        messageIncrease >= 3 && 
        callIncrease >= 2 && 
        bookingIncrease >= 2 && 
        durationIncrease >= 1) {
      console.log('✅ ALL TESTS PASSED - PatientFlow monitoring is working correctly!');
      return true;
    } else {
      console.log('❌ Some tests failed - check the output above');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

// Run the test
runIntegrationTest().then(success => {
  process.exit(success ? 0 : 1);
});