// test-db.js - Test database connection
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testDB() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
}

testDB();