// tests/api/demo-saree.test.js - API Tests for Saree Demo Endpoints
const request = require('supertest');
const app = require('../../src/app');

describe('Demo Saree API', () => {
  let authToken;
  let testAssetId;

  beforeAll(async () => {
    // Setup test authentication
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123',
      });

    authToken = loginResponse.body.data.accessToken;
  });

  describe('POST /demo/saree/ingest', () => {
    it('should ingest a saree product image', async () => {
      const response = await request(app)
        .post('/demo/saree/ingest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productImageUrl: 'https://kankatala.com/collections/sarees/products/test-saree.jpg',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assetId');
      expect(response.body.data).toHaveProperty('sourceUrl');
      
      testAssetId = response.body.data.assetId;
    });

    it('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/demo/saree/ingest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productImageUrl: 'invalid-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/demo/saree/ingest')
        .send({
          productImageUrl: 'https://example.com/image.jpg',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /demo/saree/tryon', () => {
    it('should generate try-on images', async () => {
      const response = await request(app)
        .post('/demo/saree/tryon')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assetId: testAssetId,
          avatarSpec: {
            skinTone: 'medium',
            hair: 'long',
            jewelryMinimal: 'minimal',
            pose: 'front',
            background: 'studio',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobId');
      expect(response.body.data).toHaveProperty('images');
      expect(response.body.data).toHaveProperty('count');
    });

    it('should reject invalid asset ID', async () => {
      const response = await request(app)
        .post('/demo/saree/tryon')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assetId: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /demo/saree/video', () => {
    it('should generate cinematic video', async () => {
      const response = await request(app)
        .post('/demo/saree/video')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assetId: testAssetId,
          style: 'studioTurntable',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobId');
      expect(response.body.data).toHaveProperty('videoUrl');
      expect(response.body.data).toHaveProperty('provider');
    });

    it('should reject invalid style', async () => {
      const response = await request(app)
        .post('/demo/saree/video')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assetId: testAssetId,
          style: 'invalid-style',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /demo/saree/depthmap', () => {
    it('should generate depth map and normals', async () => {
      const response = await request(app)
        .post('/demo/saree/depthmap')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assetId: testAssetId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('depthUrl');
      expect(response.body.data).toHaveProperty('normalsUrl');
      expect(response.body.data).toHaveProperty('cameraParams');
      expect(response.body.data).toHaveProperty('provider');
    });
  });

  describe('GET /demo/saree/status/:assetId', () => {
    it('should return asset status and URLs', async () => {
      const response = await request(app)
        .get(`/demo/saree/status/${testAssetId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assetId');
      expect(response.body.data).toHaveProperty('kind');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('urls');
      expect(response.body.data).toHaveProperty('meta');
    });

    it('should return 404 for non-existent asset', async () => {
      const response = await request(app)
        .get('/demo/saree/status/non-existent-asset')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /demo/saree/embed/:assetId', () => {
    it('should return embed HTML', async () => {
      const response = await request(app)
        .get(`/demo/saree/embed/${testAssetId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Saree Demo');
    });
  });
});