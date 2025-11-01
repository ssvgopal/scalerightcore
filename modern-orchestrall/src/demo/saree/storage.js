// src/demo/saree/storage.js - Local File Storage Service for Saree Demo
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const logger = require('../../utils/logger');

class LocalStorageService {
  constructor() {
    this.baseDir = process.env.STORAGE_PATH || './uploads';
    this.baseUrl = process.env.ASSET_BASE_URL || 'http://localhost:3000/uploads';
  }

  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  // Upload file to local storage
  async uploadFile(key, buffer, contentType) {
    try {
      const filePath = path.join(this.baseDir, key);
      const dir = path.dirname(filePath);
      
      // Ensure directory exists
      await this.ensureDir(dir);
      
      // Write file
      await fs.writeFile(filePath, buffer);
      
      const location = `${this.baseUrl}/${key}`;
      
      logger.info('Local file upload successful', {
        key,
        filePath,
        location,
      });

      return location;
    } catch (error) {
      logger.error('Local file upload failed', { key, error: error.message });
      throw error;
    }
  }

  // Download file from URL and upload to local storage
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

  // Get public URL for file
  async getPublicUrl(key, ttl = 3600) {
    try {
      // For local storage, just return the public URL
      // TTL is ignored since we're not using signed URLs
      const publicUrl = `${this.baseUrl}/${key}`;
      
      return publicUrl;
    } catch (error) {
      logger.error('Failed to generate public URL', { key, error: error.message });
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

  // Delete file from local storage
  async deleteFile(key) {
    try {
      const filePath = path.join(this.baseDir, key);
      
      await fs.unlink(filePath);
      
      logger.info('Local file delete successful', { key, filePath });
    } catch (error) {
      logger.error('Local file delete failed', { key, error: error.message });
      throw error;
    }
  }

  // List files for an asset
  async listAssetFiles(assetId) {
    try {
      const assetDir = path.join(this.baseDir, 'saree', assetId);
      
      try {
        const files = await fs.readdir(assetDir, { recursive: true });
        
        const fileList = [];
        for (const file of files) {
          const filePath = path.join(assetDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            fileList.push({
              key: `saree/${assetId}/${file}`,
              size: stats.size,
              lastModified: stats.mtime,
            });
          }
        }
        
        return fileList;
      } catch (error) {
        if (error.code === 'ENOENT') {
          return []; // Directory doesn't exist yet
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to list asset files', { assetId, error: error.message });
      throw error;
    }
  }
}

// Export as LocalStorageService but maintain S3StorageService interface for compatibility
module.exports = LocalStorageService;