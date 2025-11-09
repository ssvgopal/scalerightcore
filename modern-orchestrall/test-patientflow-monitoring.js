// test-patientflow-monitoring.js - Test script for PatientFlow monitoring
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testHealthCheck() {
  console.log('🔍 Testing health check...');
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check response:', JSON.stringify(response.data, null, 2));
    
    // Check if PatientFlow health is included
    if (response.data.patientflow) {
      console.log('✅ PatientFlow health check included');
      console.log(`   Status: ${response.data.patientflow.status}`);
      Object.entries(response.data.patientflow.checks).forEach(([service, check]) => {
        console.log(`   ${service}: ${check.status} - ${check.message}`);
      });
    } else {
      console.log('❌ PatientFlow health check missing');
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

async function testMetricsEndpoint() {
  console.log('\n📊 Testing metrics endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/metrics`, {
      headers: { Accept: 'text/plain' }
    });
    
    const metrics = response.data;
    
    // Check for PatientFlow metrics
    const patientflowMetrics = [
      'patientflow_messages_total',
      'patientflow_calls_total', 
      'patientflow_bookings_total',
      'patientflow_call_duration_seconds'
    ];
    
    console.log('✅ Metrics endpoint responding');
    
    patientflowMetrics.forEach(metric => {
      if (metrics.includes(metric)) {
        console.log(`✅ Found metric: ${metric}`);
      } else {
        console.log(`❌ Missing metric: ${metric}`);
      }
    });
    
    console.log('\n📈 Sample metrics output:');
    console.log(metrics.split('\n').filter(line => 
      line.startsWith('patientflow_') || line.startsWith('# HELP patientflow_')
    ).slice(0, 10).join('\n'));
    
  } catch (error) {
    console.error('❌ Metrics endpoint failed:', error.message);
  }
}

async function testSimulation() {
  console.log('\n🎭 Testing PatientFlow simulation...');
  try {
    // Test message simulation
    const messageResponse = await axios.get(`${BASE_URL}/test/patientflow/simulate?type=message&count=2`);
    console.log('✅ Message simulation:', JSON.stringify(messageResponse.data, null, 2));
    
    // Test call simulation  
    const callResponse = await axios.get(`${BASE_URL}/test/patientflow/simulate?type=call&count=2`);
    console.log('✅ Call simulation:', JSON.stringify(callResponse.data, null, 2));
    
    // Test booking simulation
    const bookingResponse = await axios.get(`${BASE_URL}/test/patientflow/simulate?type=booking&count=2`);
    console.log('✅ Booking simulation:', JSON.stringify(bookingResponse.data, null, 2));
    
    console.log('\n⏳ Waiting 2 seconds for metrics to update...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check metrics again after simulation
    const metricsResponse = await axios.get(`${BASE_URL}/metrics`, {
      headers: { Accept: 'text/plain' }
    });
    
    const metrics = metricsResponse.data;
    console.log('\n📈 Updated PatientFlow metrics:');
    console.log(metrics.split('\n').filter(line => 
      line.startsWith('patientflow_') && !line.startsWith('#')
    ).join('\n'));
    
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
  }
}

async function testWebhooks() {
  console.log('\n🪝 Testing webhooks...');
  try {
    // Test WhatsApp webhook
    const whatsappResponse = await axios.post(`${BASE_URL}/webhooks/patientflow/whatsapp`, {
      Body: 'Test message from patient',
      From: 'whatsapp:+1234567890',
      To: 'whatsapp:+0987654321',
      MessageSid: 'msg_test_123'
    });
    console.log('✅ WhatsApp webhook:', whatsappResponse.data);
    
    // Test voice webhook
    const voiceResponse = await axios.post(`${BASE_URL}/webhooks/patientflow/voice`, {
      CallSid: 'call_test_456',
      CallStatus: 'completed',
      From: '+1234567890',
      To: '+0987654321',
      Duration: '120'
    });
    console.log('✅ Voice webhook:', voiceResponse.data);
    
    // Test appointment webhook
    const appointmentResponse = await axios.post(`${BASE_URL}/webhooks/patientflow/appointment`, {
      source: 'WHATSAPP',
      patientId: 'patient_123',
      doctorId: 'doctor_456',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      reason: 'Regular checkup'
    });
    console.log('✅ Appointment webhook:', appointmentResponse.data);
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function runTests() {
  console.log('🧪 Starting PatientFlow Monitoring Tests\n');
  
  await testHealthCheck();
  await testMetricsEndpoint();
  await testSimulation();
  testWebhooks(); // Run this last as it might affect the metrics
  
  console.log('\n🎉 Testing completed!');
  console.log('\n📝 Summary:');
  console.log('- Health check should show PatientFlow subsystem status');
  console.log('- Metrics endpoint should expose PatientFlow metrics');
  console.log('- Simulation should increment counters and update histograms');
  console.log('- Webhooks should process PatientFlow interactions');
  console.log('- Check /metrics after simulations to see updated values');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testHealthCheck,
  testMetricsEndpoint,
  testSimulation,
  testWebhooks,
  runTests
};