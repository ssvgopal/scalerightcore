# Load Testing Configuration for Orchestrall Platform

# K6 Load Testing Script
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time');

// Test configuration
export let options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 20 },   // Stay at 20 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],             // Custom error rate must be below 10%
  },
};

// Base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Authentication token
let authToken = null;

// Setup function - runs once at the beginning
export function setup() {
  console.log('🔐 Authenticating...');
  
  const loginPayload = JSON.stringify({
    email: 'admin@orchestrall.com',
    password: 'admin123'
  });
  
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginResponse.status === 200) {
    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.token;
    console.log('✅ Authentication successful');
    return { token: authToken };
  } else {
    console.error('❌ Authentication failed:', loginResponse.status);
    return { token: null };
  }
}

// Main test function
export default function(data) {
  if (!data.token) {
    console.error('❌ No authentication token available');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test scenarios
  const scenarios = [
    // Health check endpoints
    { method: 'GET', url: '/health', weight: 20 },
    { method: 'GET', url: '/health/database', weight: 15 },
    { method: 'GET', url: '/health/redis', weight: 15 },
    { method: 'GET', url: '/health/full', weight: 10 },
    
    // API endpoints
    { method: 'GET', url: '/api/entities', weight: 15 },
    { method: 'GET', url: '/api/user', weight: 10 },
    { method: 'GET', url: '/api/organization', weight: 10 },
    { method: 'GET', url: '/api/product', weight: 5 },
  ];

  // Select random scenario based on weight
  const totalWeight = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
  let randomWeight = Math.random() * totalWeight;
  
  let selectedScenario = scenarios[0];
  for (const scenario of scenarios) {
    randomWeight -= scenario.weight;
    if (randomWeight <= 0) {
      selectedScenario = scenario;
      break;
    }
  }

  // Make request
  const response = http.request(selectedScenario.method, `${BASE_URL}${selectedScenario.url}`, null, {
    headers: headers,
  });

  // Record metrics
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  // Add some realistic think time
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

// Teardown function - runs once at the end
export function teardown(data) {
  console.log('🏁 Load test completed');
  console.log(`📊 Final error rate: ${errorRate.count > 0 ? (errorRate.count / (errorRate.count + errorRate.passes) * 100).toFixed(2) : 0}%`);
  console.log(`⏱️ Average response time: ${responseTime.avg.toFixed(2)}ms`);
}
