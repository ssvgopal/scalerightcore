// Test startup issues step by step
require('dotenv').config();
console.log('1. dotenv loaded');

try {
  const fastify = require('fastify');
  console.log('2. fastify loaded');
  
  const config = require('./src/config');
  console.log('3. config loaded');
  
  const logger = require('./src/utils/logger');
  console.log('4. logger loaded');
  
  const database = require('./src/database');
  console.log('5. database module loaded');
  
  // Test database connection
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  prisma.$connect()
    .then(() => {
      console.log('6. Database connected successfully');
      return prisma.$disconnect();
    })
    .then(() => {
      console.log('7. Database disconnected');
      console.log('All basic components loaded successfully!');
    })
    .catch(e => {
      console.error('Database connection failed:', e.message);
      console.error('Stack:', e.stack);
    });
    
} catch(e) {
  console.error('Error loading component:', e.message);
  console.error('Stack:', e.stack);
}
