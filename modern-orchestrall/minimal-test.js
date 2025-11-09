// minimal-test.js - Minimal server test
require('dotenv').config();
console.log('Starting minimal test...');

const fastify = require('fastify');
const app = fastify({ logger: true });

app.get('/test', async (request, reply) => {
  return { message: 'Hello World' };
});

app.listen({ port: 3001, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log('Server listening on', address);
});
