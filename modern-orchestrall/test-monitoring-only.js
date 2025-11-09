// test-monitoring-only.js - Test monitoring functionality only
const monitoringService = require('./src/monitoring');

async function testMonitoring() {
  console.log('🧪 Testing PatientFlow Monitoring System\n');

  try {
    // Test PatientFlow health checks
    console.log('🔍 Testing PatientFlow health checks...');
    const health = await monitoringService.getPatientFlowHealth();
    console.log('✅ PatientFlow health:', JSON.stringify(health, null, 2));

    // Test recording metrics
    console.log('\n📊 Testing metric recording...');
    
    // Test message metrics
    monitoringService.recordPatientFlowMessage('WHATSAPP', 'INBOUND');
    monitoringService.recordPatientFlowMessage('VOICE', 'OUTBOUND');
    console.log('✅ Recorded message metrics');

    // Test call metrics
    monitoringService.recordPatientFlowCall('COMPLETED', 120.5);
    monitoringService.recordPatientFlowCall('MISSED');
    console.log('✅ Recorded call metrics');

    // Test booking metrics
    monitoringService.recordPatientFlowBooking('WHATSAPP', 'BOOKED');
    monitoringService.recordPatientFlowBooking('VOICE', 'CONFIRMED');
    console.log('✅ Recorded booking metrics');

    // Test metrics output
    console.log('\n📈 Testing metrics output...');
    const metrics = await monitoringService.getMetrics();
    
    // Extract PatientFlow metrics
    const patientflowMetrics = metrics.split('\n').filter(line => 
      line.startsWith('patientflow_') || line.startsWith('# HELP patientflow_')
    );
    
    console.log('PatientFlow metrics:');
    patientflowMetrics.forEach(line => console.log('  ' + line));

    console.log('\n🎉 Monitoring test completed successfully!');
    
  } catch (error) {
    console.error('❌ Monitoring test failed:', error);
    process.exit(1);
  }
}

testMonitoring();