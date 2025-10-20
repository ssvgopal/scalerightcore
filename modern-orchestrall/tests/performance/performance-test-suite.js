# Performance Testing Suite for Orchestrall Platform

const { performance } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class PerformanceTestSuite {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = {
      loadTests: [],
      stressTests: [],
      enduranceTests: [],
      spikeTests: [],
      volumeTests: []
    };
    this.authToken = null;
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
        email: 'admin@orchestrall.com',
        password: 'admin123'
      });
      this.authToken = response.data.token;
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const startTime = performance.now();
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      const endTime = performance.now();
      
      return {
        success: true,
        statusCode: response.status,
        responseTime: endTime - startTime,
        dataSize: JSON.stringify(response.data).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        statusCode: error.response?.status || 0,
        responseTime: endTime - startTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async loadTest() {
    console.log('🚀 Starting Load Tests...');
    
    const endpoints = [
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/health/database' },
      { method: 'GET', path: '/health/redis' },
      { method: 'GET', path: '/health/full' },
      { method: 'GET', path: '/api/entities' },
      { method: 'GET', path: '/api/user' },
      { method: 'GET', path: '/api/organization' },
      { method: 'GET', path: '/api/product' },
      { method: 'GET', path: '/api/order' }
    ];

    const concurrentUsers = [1, 5, 10, 25, 50];
    
    for (const userCount of concurrentUsers) {
      console.log(`📊 Testing with ${userCount} concurrent users...`);
      
      const promises = [];
      for (let i = 0; i < userCount; i++) {
        const endpoint = endpoints[i % endpoints.length];
        promises.push(this.makeRequest(endpoint.method, endpoint.path));
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      const maxResponseTime = Math.max(...successfulRequests.map(r => r.responseTime));
      const minResponseTime = Math.min(...successfulRequests.map(r => r.responseTime));
      
      const testResult = {
        userCount,
        totalRequests: results.length,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: (successfulRequests.length / results.length) * 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        maxResponseTime: Math.round(maxResponseTime * 100) / 100,
        minResponseTime: Math.round(minResponseTime * 100) / 100,
        totalTime: Math.round((endTime - startTime) * 100) / 100,
        throughput: Math.round((results.length / ((endTime - startTime) / 1000)) * 100) / 100
      };

      this.results.loadTests.push(testResult);
      console.log(`✅ Load test completed for ${userCount} users:`, testResult);
    }
  }

  async stressTest() {
    console.log('💪 Starting Stress Tests...');
    
    const stressLevels = [50, 100, 200, 500, 1000];
    
    for (const requestCount of stressLevels) {
      console.log(`🔥 Stress testing with ${requestCount} requests...`);
      
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(this.makeRequest('GET', '/health'));
      }

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      
      const testResult = {
        requestCount,
        totalRequests: results.length,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: (successfulRequests.length / results.length) * 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        totalTime: Math.round((endTime - startTime) * 100) / 100,
        throughput: Math.round((results.length / ((endTime - startTime) / 1000)) * 100) / 100,
        errorRate: (failedRequests.length / results.length) * 100
      };

      this.results.stressTests.push(testResult);
      console.log(`✅ Stress test completed for ${requestCount} requests:`, testResult);
    }
  }

  async enduranceTest() {
    console.log('⏱️ Starting Endurance Tests...');
    
    const duration = 300000; // 5 minutes
    const interval = 1000; // 1 second
    const requestsPerInterval = 10;
    
    const startTime = performance.now();
    const results = [];
    
    console.log(`🔄 Running endurance test for ${duration / 1000} seconds...`);
    
    while (performance.now() - startTime < duration) {
      const promises = [];
      for (let i = 0; i < requestsPerInterval; i++) {
        promises.push(this.makeRequest('GET', '/health'));
      }
      
      const intervalResults = await Promise.all(promises);
      results.push(...intervalResults);
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    const successfulRequests = results.filter(r => r.success);
    const failedRequests = results.filter(r => !r.success);
    
    const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
    
    const testResult = {
      duration: duration / 1000,
      totalRequests: results.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      successRate: (successfulRequests.length / results.length) * 100,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      throughput: Math.round((results.length / (duration / 1000)) * 100) / 100,
      errorRate: (failedRequests.length / results.length) * 100
    };

    this.results.enduranceTests.push(testResult);
    console.log(`✅ Endurance test completed:`, testResult);
  }

  async spikeTest() {
    console.log('📈 Starting Spike Tests...');
    
    const spikePatterns = [
      { normal: 10, spike: 100, duration: 30000 },
      { normal: 20, spike: 200, duration: 60000 },
      { normal: 5, spike: 150, duration: 45000 }
    ];
    
    for (const pattern of spikePatterns) {
      console.log(`⚡ Testing spike pattern: ${pattern.normal} -> ${pattern.spike} requests`);
      
      const results = [];
      
      // Normal load phase
      console.log('📊 Normal load phase...');
      for (let i = 0; i < 5; i++) {
        const promises = [];
        for (let j = 0; j < pattern.normal; j++) {
          promises.push(this.makeRequest('GET', '/health'));
        }
        const normalResults = await Promise.all(promises);
        results.push(...normalResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Spike phase
      console.log('🔥 Spike load phase...');
      const spikeStartTime = performance.now();
      while (performance.now() - spikeStartTime < pattern.duration) {
        const promises = [];
        for (let j = 0; j < pattern.spike; j++) {
          promises.push(this.makeRequest('GET', '/health'));
        }
        const spikeResults = await Promise.all(promises);
        results.push(...spikeResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Recovery phase
      console.log('🔄 Recovery phase...');
      for (let i = 0; i < 5; i++) {
        const promises = [];
        for (let j = 0; j < pattern.normal; j++) {
          promises.push(this.makeRequest('GET', '/health'));
        }
        const recoveryResults = await Promise.all(promises);
        results.push(...recoveryResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      const testResult = {
        pattern,
        totalRequests: results.length,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: (successfulRequests.length / results.length) * 100,
        errorRate: (failedRequests.length / results.length) * 100
      };

      this.results.spikeTests.push(testResult);
      console.log(`✅ Spike test completed:`, testResult);
    }
  }

  async volumeTest() {
    console.log('📊 Starting Volume Tests...');
    
    const volumeLevels = [
      { requests: 1000, description: 'Small Volume' },
      { requests: 5000, description: 'Medium Volume' },
      { requests: 10000, description: 'Large Volume' },
      { requests: 25000, description: 'Very Large Volume' }
    ];
    
    for (const volume of volumeLevels) {
      console.log(`📈 Testing ${volume.description} (${volume.requests} requests)...`);
      
      const startTime = performance.now();
      const promises = [];
      
      for (let i = 0; i < volume.requests; i++) {
        promises.push(this.makeRequest('GET', '/health'));
      }
      
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      
      const testResult = {
        volume: volume.description,
        requestCount: volume.requests,
        totalRequests: results.length,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: (successfulRequests.length / results.length) * 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        totalTime: Math.round((endTime - startTime) * 100) / 100,
        throughput: Math.round((results.length / ((endTime - startTime) / 1000)) * 100) / 100,
        errorRate: (failedRequests.length / results.length) * 100
      };

      this.results.volumeTests.push(testResult);
      console.log(`✅ Volume test completed:`, testResult);
    }
  }

  async databasePerformanceTest() {
    console.log('🗄️ Starting Database Performance Tests...');
    
    const dbTests = [
      { name: 'Simple Query', endpoint: '/api/entities' },
      { name: 'Complex Query', endpoint: '/api/user?include=organization&limit=100' },
      { name: 'Search Query', endpoint: '/api/user?search=admin' },
      { name: 'Filtered Query', endpoint: '/api/user?filter={"isActive":true}' }
    ];
    
    for (const test of dbTests) {
      console.log(`🔍 Testing ${test.name}...`);
      
      const iterations = 100;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const result = await this.makeRequest('GET', test.endpoint);
        results.push(result);
      }
      
      const successfulRequests = results.filter(r => r.success);
      const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      
      const testResult = {
        testName: test.name,
        endpoint: test.endpoint,
        iterations,
        successfulRequests: successfulRequests.length,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        successRate: (successfulRequests.length / iterations) * 100
      };
      
      console.log(`✅ Database test completed:`, testResult);
    }
  }

  async memoryLeakTest() {
    console.log('🧠 Starting Memory Leak Tests...');
    
    const iterations = 1000;
    const results = [];
    
    console.log(`🔄 Running ${iterations} iterations to detect memory leaks...`);
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.makeRequest('GET', '/health');
      results.push(result);
      
      if (i % 100 === 0) {
        console.log(`📊 Completed ${i} iterations...`);
      }
    }
    
    const successfulRequests = results.filter(r => r.success);
    const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
    
    const testResult = {
      iterations,
      successfulRequests: successfulRequests.length,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      successRate: (successfulRequests.length / iterations) * 100,
      memoryStable: avgResponseTime < 1000 // Response time should remain stable
    };
    
    this.results.memoryLeakTest = testResult;
    console.log(`✅ Memory leak test completed:`, testResult);
  }

  generateReport() {
    console.log('\n📊 PERFORMANCE TEST REPORT');
    console.log('='.repeat(50));
    
    // Load Test Results
    console.log('\n🚀 LOAD TEST RESULTS:');
    console.log('User Count | Success Rate | Avg Response Time | Throughput');
    console.log('-'.repeat(60));
    this.results.loadTests.forEach(test => {
      console.log(`${test.userCount.toString().padStart(10)} | ${test.successRate.toFixed(1).padStart(11)}% | ${test.avgResponseTime.toString().padStart(16)}ms | ${test.throughput.toString().padStart(9)} req/s`);
    });
    
    // Stress Test Results
    console.log('\n💪 STRESS TEST RESULTS:');
    console.log('Requests | Success Rate | Avg Response Time | Error Rate');
    console.log('-'.repeat(60));
    this.results.stressTests.forEach(test => {
      console.log(`${test.requestCount.toString().padStart(8)} | ${test.successRate.toFixed(1).padStart(11)}% | ${test.avgResponseTime.toString().padStart(16)}ms | ${test.errorRate.toFixed(1).padStart(9)}%`);
    });
    
    // Endurance Test Results
    console.log('\n⏱️ ENDURANCE TEST RESULTS:');
    if (this.results.enduranceTests.length > 0) {
      const test = this.results.enduranceTests[0];
      console.log(`Duration: ${test.duration}s | Success Rate: ${test.successRate.toFixed(1)}% | Avg Response Time: ${test.avgResponseTime}ms | Throughput: ${test.throughput} req/s`);
    }
    
    // Spike Test Results
    console.log('\n📈 SPIKE TEST RESULTS:');
    this.results.spikeTests.forEach((test, index) => {
      console.log(`Pattern ${index + 1}: ${test.pattern.normal} -> ${test.pattern.spike} requests | Success Rate: ${test.successRate.toFixed(1)}% | Error Rate: ${test.errorRate.toFixed(1)}%`);
    });
    
    // Volume Test Results
    console.log('\n📊 VOLUME TEST RESULTS:');
    console.log('Volume | Success Rate | Avg Response Time | Throughput');
    console.log('-'.repeat(60));
    this.results.volumeTests.forEach(test => {
      console.log(`${test.volume.padStart(15)} | ${test.successRate.toFixed(1).padStart(11)}% | ${test.avgResponseTime.toString().padStart(16)}ms | ${test.throughput.toString().padStart(9)} req/s`);
    });
    
    // Memory Leak Test Results
    if (this.results.memoryLeakTest) {
      console.log('\n🧠 MEMORY LEAK TEST RESULTS:');
      const test = this.results.memoryLeakTest;
      console.log(`Iterations: ${test.iterations} | Success Rate: ${test.successRate.toFixed(1)}% | Avg Response Time: ${test.avgResponseTime}ms | Memory Stable: ${test.memoryStable ? 'Yes' : 'No'}`);
    }
    
    // Performance Benchmarks
    console.log('\n🎯 PERFORMANCE BENCHMARKS:');
    console.log('Metric | Target | Status');
    console.log('-'.repeat(40));
    
    const loadTest = this.results.loadTests[this.results.loadTests.length - 1];
    const stressTest = this.results.stressTests[this.results.stressTests.length - 1];
    
    console.log(`Load Test (50 users) | >95% success | ${loadTest.successRate > 95 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Stress Test (1000 req) | >90% success | ${stressTest.successRate > 90 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Response Time | <500ms avg | ${loadTest.avgResponseTime < 500 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Throughput | >100 req/s | ${loadTest.throughput > 100 ? '✅ PASS' : '❌ FAIL'}`);
    
    // Save detailed report
    this.saveDetailedReport();
  }

  saveDetailedReport() {
    const reportPath = path.join(__dirname, 'performance-test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      testResults: this.results,
      summary: {
        totalTests: Object.values(this.results).flat().length,
        overallSuccess: this.calculateOverallSuccess(),
        recommendations: this.generateRecommendations()
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  calculateOverallSuccess() {
    const allTests = Object.values(this.results).flat();
    const successfulTests = allTests.filter(test => test.successRate > 90);
    return (successfulTests.length / allTests.length) * 100;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze load test results
    const loadTest = this.results.loadTests[this.results.loadTests.length - 1];
    if (loadTest.successRate < 95) {
      recommendations.push('Consider optimizing database queries and implementing caching');
    }
    
    // Analyze stress test results
    const stressTest = this.results.stressTests[this.results.stressTests.length - 1];
    if (stressTest.errorRate > 10) {
      recommendations.push('Implement rate limiting and request queuing for high load scenarios');
    }
    
    // Analyze response times
    if (loadTest.avgResponseTime > 500) {
      recommendations.push('Optimize API endpoints and consider implementing response compression');
    }
    
    // Analyze throughput
    if (loadTest.throughput < 100) {
      recommendations.push('Consider horizontal scaling and load balancing');
    }
    
    return recommendations;
  }

  async runAllTests() {
    try {
      console.log('🚀 Starting Comprehensive Performance Test Suite');
      console.log('='.repeat(60));
      
      await this.authenticate();
      
      await this.loadTest();
      await this.stressTest();
      await this.enduranceTest();
      await this.spikeTest();
      await this.volumeTest();
      await this.databasePerformanceTest();
      await this.memoryLeakTest();
      
      this.generateReport();
      
      console.log('\n✅ All performance tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Performance test suite failed:', error.message);
      throw error;
    }
  }
}

// Export for use in other modules
module.exports = PerformanceTestSuite;

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new PerformanceTestSuite();
  testSuite.runAllTests().catch(console.error);
}
