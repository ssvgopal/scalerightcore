// test-platform.js - Comprehensive Platform Testing Script
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testPlatform() {
  console.log('🧪 Testing Orchestrall Platform...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data);
    console.log('');

    // Test 2: List Agents
    console.log('2️⃣ Testing Agent List...');
    const agentsResponse = await axios.get(`${BASE_URL}/api/agents`);
    console.log('✅ Available Agents:', agentsResponse.data.count);
    agentsResponse.data.agents.forEach(agent => {
      console.log(`   - ${agent.name}: ${agent.description}`);
    });
    console.log('');

    // Test 3: Calculator Agent
    console.log('3️⃣ Testing Calculator Agent...');
    const calcResponse = await axios.post(`${BASE_URL}/api/agents/calculator/execute`, {
      input: '2 + 3 * 4'
    });
    console.log('✅ Calculator Result:', calcResponse.data.result);
    console.log('');

    // Test 4: Text Processor Agent
    console.log('4️⃣ Testing Text Processor Agent...');
    const textResponse = await axios.post(`${BASE_URL}/api/agents/text-processor/execute`, {
      input: 'This is a sample text for analysis. It contains multiple sentences and should provide good insights about word count and reading time estimation.'
    });
    console.log('✅ Text Analysis:', textResponse.data.result);
    console.log('');

    // Test 5: Data Validator Agent
    console.log('5️⃣ Testing Data Validator Agent...');
    const validatorResponse = await axios.post(`${BASE_URL}/api/agents/data-validator/execute`, {
      input: 'test@example.com'
    });
    console.log('✅ Validation Result:', validatorResponse.data.result);
    console.log('');

    // Test 6: Authentication
    console.log('6️⃣ Testing Authentication...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@orchestrall.com',
      password: 'admin123'
    });
    console.log('✅ Login Successful:', loginResponse.data.data.user.email);
    
    const token = loginResponse.data.data.accessToken;
    console.log('');

    // Test 7: Authenticated Request
    console.log('7️⃣ Testing Authenticated Request...');
    const meResponse = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ User Info:', meResponse.data.data.email);
    console.log('');

    // Test 8: JSON Validator Agent
    console.log('8️⃣ Testing JSON Validator Agent...');
    const jsonResponse = await axios.post(`${BASE_URL}/api/agents/json-validator/execute`, {
      input: '{"name": "John", "age": 30, "city": "New York"}'
    });
    console.log('✅ JSON Validation:', jsonResponse.data.result.isValid);
    console.log('');

    // Test 9: URL Analyzer Agent
    console.log('9️⃣ Testing URL Analyzer Agent...');
    const urlResponse = await axios.post(`${BASE_URL}/api/agents/url-analyzer/execute`, {
      input: 'https://www.example.com/path?query=value#fragment'
    });
    console.log('✅ URL Analysis:', urlResponse.data.result.components.hostname);
    console.log('');

    // Test 10: Number Analyzer Agent
    console.log('🔟 Testing Number Analyzer Agent...');
    const numberResponse = await axios.post(`${BASE_URL}/api/agents/number-analyzer/execute`, {
      input: '17'
    });
    console.log('✅ Number Analysis:', numberResponse.data.result.properties.isPrime);
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('📊 Platform Summary:');
    console.log(`   - Agents Available: ${agentsResponse.data.count}`);
    console.log(`   - Authentication: Working`);
    console.log(`   - Agent Execution: Working`);
    console.log(`   - API Documentation: http://localhost:3000/docs`);
    console.log(`   - Health Status: ${healthResponse.data.status}`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run tests
testPlatform();
