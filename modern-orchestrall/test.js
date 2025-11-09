// test.js
const fastify = require('fastify')({ logger: false });

fastify.get('/test', async (request, reply) => {
  reply.send({ message: 'test works' });
});

fastify.listen({ port: 3001, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log('Test server running on port 3001');
});
