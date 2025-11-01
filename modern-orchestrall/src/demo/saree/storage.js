// src/demo/saree/storage.js - S3 Storage Service for Saree Demo
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const logger = require('../../utils/logger');

class S3StorageService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      region: config.s3.region,
    });
    this.bucket = config.s3.sareeBucket;
  }

  // Upload file to S3
  async uploadFile(key, buffer, contentType) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      };

      const result = await this.s3.upload(params).promise();
      
      logger.info('S3 upload successful', {
        key,
        bucket: this.bucket,
        location: result.Location,
      });

      return result.Location;
    } catch (error) {
      logger.error('S3 upload failed', { key, error: error.message });
      throw error;
    }
  }

  // Download file from URL and upload to S3
  async downloadAndUpload(imageUrl, assetId) {
    try {
      // Validate URL allowlist
      if (!this.isAllowedUrl(imageUrl)) {
        throw new Error('URL not allowed for security reasons');
      }

      // Download image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const key = `saree/${assetId}/source.jpg`;
      
      const location = await this.uploadFile(key, buffer, 'image/jpeg');
      
      return {
        assetId,
        sourceUrl: location,
        key,
      };
    } catch (error) {
      logger.error('Download and upload failed', { imageUrl, error: error.message });
      throw error;
    }
  }

  // Generate signed URL for S3 object
  async getSignedUrl(key, ttl = config.s3.signedUrlTtl) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: ttl,
      };

      const signedUrl = await this.s3.getSignedUrlPromise('getObject', params);
      
      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', { key, error: error.message });
      throw error;
    }
  }

  // Check if URL is allowed (prevent SSRF)
  isAllowedUrl(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Allow kankatala.com
      if (parsedUrl.hostname === 'kankatala.com' || parsedUrl.hostname.endsWith('.kankatala.com')) {
        return true;
      }
      
      // Allow HTTP/HTTPS only
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }
      
      // Allow localhost for development
      if (config.server.nodeEnv === 'development' && parsedUrl.hostname === 'localhost') {
        return true;
      }
      
      // Allow direct image URLs from common CDNs
      const allowedHosts = [
        'd3.amazonaws.com',
        's3.amazonaws.com',
        'storage.googleapis.com',
        'cdn.shopify.com',
        'images.unsplash.com',
      ];
      
      return allowedHosts.includes(parsedUrl.hostname);
    } catch (error) {
      logger.error('URL validation failed', { url, error: error.message });
      return false;
    }
  }

  // Delete file from S3
  async deleteFile(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      
      logger.info('S3 delete successful', { key });
    } catch (error) {
      logger.error('S3 delete failed', { key, error: error.message });
      throw error;
    }
  }

  // List files for an asset
  async listAssetFiles(assetId) {
    try {
      const params = {
        Bucket: this.bucket,
        Prefix: `saree/${assetId}/`,
      };

      const result = await this.s3.listObjectsV2(params).promise();
      
      const files = result.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
      }));

      return files;
    } catch (error) {
      logger.error('Failed to list asset files', { assetId, error: error.message });
      throw error;
    }
  }
}

module.exports = S3StorageService;