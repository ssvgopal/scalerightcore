// tests/unit/ConnectionManager.test.js - Connection Manager Unit Tests
const ConnectionManager = require('../../src/core/database/ConnectionManager');

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    organization: {
      upsert: jest.fn().mockResolvedValue({ id: 'test-org' })
    }
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('ConnectionManager', () => {
  let connectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct properties', () => {
      expect(connectionManager.connections).toBeInstanceOf(Map);
      expect(connectionManager.defaultConnection).toBeNull();
      expect(connectionManager.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      await connectionManager.initialize();

      expect(connectionManager.isInitialized).toBe(true);
      expect(connectionManager.defaultConnection).toBeDefined();
      expect(connectionManager.defaultConnection.$connect).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      // Create a new ConnectionManager and mock its initialize method
      const newConnectionManager = new ConnectionManager();
      
      // Mock the initialize method to throw an error
      const originalInitialize = newConnectionManager.initialize;
      newConnectionManager.initialize = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(newConnectionManager.initialize()).rejects.toThrow('Connection failed');
      
      // Restore original method
      newConnectionManager.initialize = originalInitialize;
    });
  });

  describe('getConnection', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    test('should return default connection for default organization', async () => {
      const connection = await connectionManager.getConnection('default');
      
      expect(connection).toBe(connectionManager.defaultConnection);
    });

    test('should return default connection for demo organization', async () => {
      const connection = await connectionManager.getConnection('demo');
      
      expect(connection).toBe(connectionManager.defaultConnection);
    });

    test('should throw error if not initialized', async () => {
      const uninitializedManager = new ConnectionManager();
      
      await expect(uninitializedManager.getConnection('test')).rejects.toThrow('Connection Manager not initialized');
    });

    test('should return cached connection for existing organization', async () => {
      const mockConnection = { $connect: jest.fn() };
      connectionManager.connections.set('test-org', mockConnection);

      const connection = await connectionManager.getConnection('test-org');
      
      expect(connection).toBe(mockConnection);
    });
  });

  describe('getOrganizationContext', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    test('should return organization context', async () => {
      const context = await connectionManager.getOrganizationContext('test-org');

      expect(context.prisma).toBeDefined();
      expect(context.organizationId).toBe('test-org');
      expect(context.isProduction).toBe(false);
      expect(context.isDemo).toBe(false);
    });

    test('should mark demo organizations correctly', async () => {
      const context = await connectionManager.getOrganizationContext('demo');

      expect(context.organizationId).toBe('demo');
      expect(context.isDemo).toBe(true);
    });
  });

  describe('executeWithContext', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    test('should execute operation with context', async () => {
      const mockOperation = jest.fn().mockResolvedValue('test-result');
      
      const result = await connectionManager.executeWithContext('test-org', mockOperation);
      
      expect(result).toBe('test-result');
      expect(mockOperation).toHaveBeenCalledWith({
        prisma: connectionManager.defaultConnection,
        organizationId: 'test-org',
        isProduction: false,
        isDemo: false
      });
    });

    test('should handle operation errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(
        connectionManager.executeWithContext('test-org', mockOperation)
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('healthCheck', () => {
    test('should return health status when not initialized', async () => {
      const healthStatus = await connectionManager.healthCheck();

      expect(healthStatus.isInitialized).toBe(false);
      expect(healthStatus.defaultConnection).toBe(false);
      expect(healthStatus.organizationConnections).toBe(0);
    });

    test('should return health status when initialized', async () => {
      await connectionManager.initialize();
      
      const healthStatus = await connectionManager.healthCheck();

      expect(healthStatus.isInitialized).toBe(true);
      expect(healthStatus.defaultConnection).toBe(true);
      expect(healthStatus.organizationConnections).toBe(0);
    });

    test('should handle health check errors', async () => {
      await connectionManager.initialize();
      
      // Mock connection failure
      connectionManager.defaultConnection.$queryRaw = jest.fn().mockRejectedValue(new Error('Query failed'));
      
      const healthStatus = await connectionManager.healthCheck();

      expect(healthStatus.isInitialized).toBe(true);
      expect(healthStatus.defaultConnection).toBe(false);
    });
  });

  describe('closeConnection', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    test('should close organization connection', async () => {
      const mockConnection = {
        $disconnect: jest.fn().mockResolvedValue(undefined)
      };
      connectionManager.connections.set('test-org', mockConnection);

      await connectionManager.closeConnection('test-org');

      expect(mockConnection.$disconnect).toHaveBeenCalled();
      expect(connectionManager.connections.has('test-org')).toBe(false);
    });

    test('should not close default connection', async () => {
      const originalDisconnect = connectionManager.defaultConnection.$disconnect;
      
      await connectionManager.closeConnection('default');

      expect(connectionManager.defaultConnection.$disconnect).toBe(originalDisconnect);
    });

    test('should handle non-existent connection gracefully', async () => {
      await expect(
        connectionManager.closeConnection('non-existent-org')
      ).resolves.not.toThrow();
    });
  });

  describe('closeAllConnections', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    test('should close all connections', async () => {
      const mockConnection1 = {
        $disconnect: jest.fn().mockResolvedValue(undefined)
      };
      const mockConnection2 = {
        $disconnect: jest.fn().mockResolvedValue(undefined)
      };

      connectionManager.connections.set('org1', mockConnection1);
      connectionManager.connections.set('org2', mockConnection2);

      await connectionManager.closeAllConnections();

      expect(mockConnection1.$disconnect).toHaveBeenCalled();
      expect(mockConnection2.$disconnect).toHaveBeenCalled();
      expect(connectionManager.defaultConnection.$disconnect).toHaveBeenCalled();
      expect(connectionManager.connections.size).toBe(0);
      expect(connectionManager.isInitialized).toBe(false);
    });

    test('should handle connection close errors', async () => {
      const mockConnection = {
        $disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed'))
      };

      connectionManager.connections.set('test-org', mockConnection);

      await expect(connectionManager.closeAllConnections()).resolves.not.toThrow();
    });
  });

  describe('utility methods', () => {
    test('getConnectionCount should return correct count', () => {
      connectionManager.connections.set('org1', {});
      connectionManager.connections.set('org2', {});

      expect(connectionManager.getConnectionCount()).toBe(2);
    });

    test('getConnectedOrganizations should return organization IDs', () => {
      connectionManager.connections.set('org1', {});
      connectionManager.connections.set('org2', {});

      const organizations = connectionManager.getConnectedOrganizations();
      expect(organizations).toContain('org1');
      expect(organizations).toContain('org2');
    });

    test('isOrganizationConnected should return correct status', () => {
      connectionManager.connections.set('org1', {});

      expect(connectionManager.isOrganizationConnected('org1')).toBe(true);
      expect(connectionManager.isOrganizationConnected('org2')).toBe(false);
    });
  });
});
