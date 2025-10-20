// tests/global-teardown.js - Global Test Teardown
module.exports = async () => {
  console.log('🧹 Cleaning up global test environment...');
  
  // Clean up global test database connection
  if (global.testPrisma) {
    try {
      await global.testPrisma.$disconnect();
      console.log('✅ Test database disconnected');
    } catch (error) {
      console.log('⚠️ Error disconnecting test database:', error.message);
    }
  }
  
  // Clean up any other global resources
  if (global.testServer) {
    try {
      await global.testServer.close();
      console.log('✅ Test server closed');
    } catch (error) {
      console.log('⚠️ Error closing test server:', error.message);
    }
  }
  
  console.log('✅ Global test teardown complete');
};
