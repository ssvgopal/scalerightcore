// test-webhooks-only.js - Test PatientFlow webhook functionality
const patientFlowService = require('./src/patientflow');
const { 
  handleWhatsAppWebhook, 
  handleTwilioVoiceWebhook, 
  handleAppointmentWebhook 
} = require('./src/patientflow/webhooks');

// Mock Fastify request/reply objects
function createMockRequest(body) {
  return { body };
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
  
  reply.code = reply.status; // alias for consistency
  
  return reply;
}

async function testWebhooks() {
  console.log('🧪 Testing PatientFlow Webhooks\n');

  try {
    // Initialize PatientFlow service
    await patientFlowService.initialize();
    console.log('✅ PatientFlow service initialized');

    // Test WhatsApp webhook
    console.log('\n📱 Testing WhatsApp webhook...');
    const whatsappRequest = createMockRequest({
      Body: 'Test message from patient',
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      MessageSid: 'msg_test_123'
    });
    const whatsappReply = createMockReply();
    
    const whatsappResult = await handleWhatsAppWebhook(whatsappRequest, whatsappReply);
    console.log('✅ WhatsApp webhook result:', JSON.stringify(whatsappResult, null, 2));

    // Test voice webhook
    console.log('\n📞 Testing voice webhook...');
    const voiceRequest = createMockRequest({
      CallSid: 'call_test_456',
      CallStatus: 'completed',
      From: '+1234567890',
      To: '+0987654321',
      Duration: '120'
    });
    const voiceReply = createMockReply();
    
    const voiceResult = await handleTwilioVoiceWebhook(voiceRequest, voiceReply);
    console.log('✅ Voice webhook result:', JSON.stringify(voiceResult, null, 2));

    // Test appointment webhook
    console.log('\n📅 Testing appointment webhook...');
    const appointmentRequest = createMockRequest({
      source: 'WHATSAPP',
      patientId: 'patient_123',
      doctorId: 'doctor_456',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      reason: 'Regular checkup'
    });
    const appointmentReply = createMockReply();
    
    const appointmentResult = await handleAppointmentWebhook(appointmentRequest, appointmentReply);
    console.log('✅ Appointment webhook result:', JSON.stringify(appointmentResult, null, 2));

    console.log('\n🎉 All webhook tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error);
    process.exit(1);
  }
}

testWebhooks();