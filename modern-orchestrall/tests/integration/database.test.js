// tests/integration/database.test.js - Database Integration Tests
const { PrismaClient } = require('@prisma/client');
const ConnectionManager = require('../../src/core/database/ConnectionManager');

describe('Database Integration Tests', () => {
  let prisma;
  let connectionManager;

  beforeAll(async () => {
    // Set up test database - use main database for now
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/orchestrall';
    
    prisma = new PrismaClient();
    await prisma.$connect();

    connectionManager = new ConnectionManager();
    await connectionManager.initialize();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.$disconnect();
    await connectionManager.closeAllConnections();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.location.deleteMany();
    await prisma.farmerTransaction.deleteMany();
    await prisma.farmerProfile.deleteMany();
    await prisma.storePerformance.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  });

  describe('Organization Operations', () => {
    test('should create organization successfully', async () => {
      const orgData = {
        id: 'test-org-' + Date.now(),
        name: 'Test Organization',
        slug: 'test-org-' + Date.now(),
        tier: 'starter'
      };

      const organization = await prisma.organization.create({
        data: orgData
      });

      expect(organization.id).toBe(orgData.id);
      expect(organization.name).toBe(orgData.name);
      expect(organization.slug).toBe(orgData.slug);
      expect(organization.tier).toBe(orgData.tier);
    });

    test('should create organization with users', async () => {
      const orgData = {
        id: 'test-org-' + Date.now(),
        name: 'Test Organization',
        slug: 'test-org-' + Date.now(),
        tier: 'starter',
        users: {
          create: {
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      };

      const organization = await prisma.organization.create({
        data: orgData,
        include: {
          users: true
        }
      });

      expect(organization.users).toHaveLength(1);
      expect(organization.users[0].email).toBe('test@example.com');
    });
  });

  describe('Product Operations', () => {
    let testOrg;

    beforeEach(async () => {
      testOrg = await prisma.organization.create({
        data: {
          id: 'test-org-' + Date.now(),
          name: 'Test Organization',
          slug: 'test-org-' + Date.now(),
          tier: 'starter'
        }
      });
    });

    test('should create product successfully', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test product description',
        price: 99.99,
        sku: 'TEST-SKU-' + Date.now(),
        attributes: {
          category: 'test',
          color: 'red'
        },
        organizationId: testOrg.id
      };

      const product = await prisma.product.create({
        data: productData
      });

      expect(product.name).toBe(productData.name);
      expect(product.price).toEqual(productData.price);
      expect(product.sku).toBe(productData.sku);
      expect(product.attributes).toEqual(productData.attributes);
    });

    test('should create product with inventory', async () => {
      const location = await prisma.location.create({
        data: {
          name: 'Test Store',
          type: 'store',
          organizationId: testOrg.id
        }
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Product',
          price: 99.99,
          sku: 'TEST-SKU-' + Date.now(),
          organizationId: testOrg.id,
          inventoryItems: {
            create: {
              locationId: location.id,
              quantity: 100,
              reserved: 0
            }
          }
        },
        include: {
          inventoryItems: true
        }
      });

      expect(product.inventoryItems).toHaveLength(1);
      expect(product.inventoryItems[0].quantity).toBe(100);
    });
  });

  describe('Order Operations', () => {
    let testOrg, testCustomer, testProduct;

    beforeEach(async () => {
      testOrg = await prisma.organization.create({
        data: {
          id: 'test-org-' + Date.now(),
          name: 'Test Organization',
          slug: 'test-org-' + Date.now(),
          tier: 'starter'
        }
      });

      testCustomer = await prisma.customer.create({
        data: {
          email: 'customer@example.com',
          name: 'Test Customer',
          organizationId: testOrg.id
        }
      });

      testProduct = await prisma.product.create({
        data: {
          name: 'Test Product',
          price: 99.99,
          sku: 'TEST-SKU-' + Date.now(),
          organizationId: testOrg.id
        }
      });
    });

    test('should create order with items', async () => {
      const orderData = {
        orderNumber: 'ORDER-' + Date.now(),
        customerId: testCustomer.id,
        status: 'pending',
        total: 199.98,
        organizationId: testOrg.id,
        items: {
          create: [
            {
              productId: testProduct.id,
              quantity: 2,
              price: 99.99
            }
          ]
        }
      };

      const order = await prisma.order.create({
        data: orderData,
        include: {
          items: true,
          customer: true
        }
      });

      expect(order.orderNumber).toBe(orderData.orderNumber);
      expect(order.total).toEqual(orderData.total);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(2);
      expect(order.customer.email).toBe('customer@example.com');
    });

    test('should update order status', async () => {
      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORDER-' + Date.now(),
          customerId: testCustomer.id,
          status: 'pending',
          total: 99.99,
          organizationId: testOrg.id
        }
      });

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'confirmed' }
      });

      expect(updatedOrder.status).toBe('confirmed');
    });
  });

  describe('Farmer Operations', () => {
    let testOrg;

    beforeEach(async () => {
      testOrg = await prisma.organization.create({
        data: {
          id: 'test-org-' + Date.now(),
          name: 'Test Organization',
          slug: 'test-org-' + Date.now(),
          tier: 'starter'
        }
      });
    });

    test('should create farmer profile with transactions', async () => {
      const farmerData = {
        name: 'Test Farmer',
        farmLocation: 'Test Farm Location',
        region: 'Test Region',
        organizationId: testOrg.id,
        transactions: {
          create: {
            amount: 1000.00,
            profitShare: 15.00,
            status: 'pending'
          }
        }
      };

      const farmer = await prisma.farmerProfile.create({
        data: farmerData,
        include: {
          transactions: true
        }
      });

      expect(farmer.name).toBe(farmerData.name);
      expect(farmer.transactions).toHaveLength(1);
      expect(farmer.transactions[0].amount).toEqual(farmerData.transactions.create.amount);
      expect(farmer.transactions[0].profitShare).toEqual(farmerData.transactions.create.profitShare);
    });
  });

  describe('Multi-tenant Data Isolation', () => {
    test('should isolate data between organizations', async () => {
      const org1 = await prisma.organization.create({
        data: {
          id: 'org1-' + Date.now(),
          name: 'Organization 1',
          slug: 'org1-' + Date.now(),
          tier: 'starter'
        }
      });

      const org2 = await prisma.organization.create({
        data: {
          id: 'org2-' + Date.now(),
          name: 'Organization 2',
          slug: 'org2-' + Date.now(),
          tier: 'starter'
        }
      });

      // Create products for each organization
      const product1 = await prisma.product.create({
        data: {
          name: 'Org1 Product',
          price: 100.00,
          sku: 'ORG1-SKU',
          organizationId: org1.id
        }
      });

      const product2 = await prisma.product.create({
        data: {
          name: 'Org2 Product',
          price: 200.00,
          sku: 'ORG2-SKU',
          organizationId: org2.id
        }
      });

      // Verify isolation
      const org1Products = await prisma.product.findMany({
        where: { organizationId: org1.id }
      });

      const org2Products = await prisma.product.findMany({
        where: { organizationId: org2.id }
      });

      expect(org1Products).toHaveLength(1);
      expect(org1Products[0].name).toBe('Org1 Product');
      expect(org2Products).toHaveLength(1);
      expect(org2Products[0].name).toBe('Org2 Product');
    });
  });

  describe('Connection Manager Integration', () => {
    test('should execute operations with organization context', async () => {
      const testOrg = await prisma.organization.create({
        data: {
          id: 'test-org-' + Date.now(),
          name: 'Test Organization',
          slug: 'test-org-' + Date.now(),
          tier: 'starter'
        }
      });

      const result = await connectionManager.executeWithContext(testOrg.id, async (context) => {
        const product = await context.prisma.product.create({
          data: {
            name: 'Context Product',
            price: 50.00,
            sku: 'CONTEXT-SKU',
            organizationId: context.organizationId
          }
        });

        return {
          product,
          organizationId: context.organizationId,
          isDemo: context.isDemo
        };
      });

      expect(result.product.name).toBe('Context Product');
      expect(result.organizationId).toBe(testOrg.id);
      expect(result.isDemo).toBe(false);
    });
  });
});
