// tests/global-setup.js - Global Test Setup
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  console.log('🚀 Setting up global test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orchestrall_test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  process.env.PORT = '3001'; // Use different port for tests
  
  // Initialize test database connection
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Test database connected');
    
    // Store prisma instance globally for tests
    global.testPrisma = prisma;
    
    // Create test database if it doesn't exist
    try {
      await prisma.$executeRaw`CREATE DATABASE IF NOT EXISTS orchestrall_test`;
    } catch (error) {
      // Database might already exist, continue
      console.log('ℹ️ Test database already exists or creation failed:', error.message);
    }
    
  } catch (error) {
    console.log('⚠️ Test database not available, using mock mode:', error.message);
    global.testPrisma = null;
  }
  
  console.log('✅ Global test setup complete');
};
