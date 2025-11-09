// test-server.js - Debug server startup
require('dotenv').config();
console.log('Environment loaded');

try {
  console.log('Loading config...');
  const config = require('./src/config');
  console.log('Config loaded:', config.server.port);

  console.log('Loading database...');
  const database = require('./src/database');
  console.log('Database module loaded');

  console.log('Loading logger...');
  const logger = require('./src/utils/logger');
  console.log('Logger loaded');

  console.log('Loading Universal CRUD Service...');
  const UniversalCRUDService = require('./src/core/crud/UniversalCRUDService');
  console.log('Universal CRUD Service loaded');

  console.log('Loading Universal CRUD Routes...');
  const universalCRUDRoutes = require('./src/routes/universal-crud');
  console.log('Universal CRUD Routes loaded');

  console.log('All modules loaded successfully!');
} catch (error) {
  console.error('Error loading modules:', error.message);
  console.error('Stack:', error.stack);
}
