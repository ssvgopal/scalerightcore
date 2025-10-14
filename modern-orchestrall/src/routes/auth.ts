// src/routes/auth.ts
import { FastifyInstance } from 'fastify';
import { UserManager } from '../core/database/user-manager';

interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  const userManager = new UserManager();

  // Register endpoint
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as RegisterBody;

      const user = await userManager.createUser(email, password);

      reply.code(201).send({
        success: true,
        message: 'User created successfully',
        userId: user.id
      });
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as LoginBody;

      const result = await userManager.authenticateUser(email, password);

      if (!result) {
        reply.code(401).send({
          success: false,
          error: 'Invalid credentials'
        });
        return;
      }

      reply.send({
        success: true,
        token: result.token,
        user: result.user
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Authentication failed'
      });
    }
  });
}
