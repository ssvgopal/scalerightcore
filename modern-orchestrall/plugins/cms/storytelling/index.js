// plugins/cms/storytelling/index.js - Storytelling CMS Plugin
const multer = require('multer');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const cloudinary = require('cloudinary').v2;
const { Client } = require('elasticsearch');
const logger = require('../../../src/utils/logger');

class StorytellingCMSPlugin {
  constructor(config, prisma, loggerInstance) {
    this.config = config;
    this.prisma = prisma;
    this.logger = loggerInstance || logger;
    this.storageBucket = config.storageBucket || 'orchestrall-stories';
    this.cdnUrl = config.cdnUrl || 'https://cdn.orchestrall.com';
    this.elasticsearchUrl = config.elasticsearchUrl || 'http://localhost:9200';
    this.maxFileSize = config.maxFileSize || 10485760; // 10MB
    this.allowedFormats = config.allowedFormats || ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm', 'mp3', 'wav'];
    this.initialized = false;
    
    // Initialize AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'ap-south-1'
    });
    
    // Initialize Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    // Initialize Elasticsearch
    this.esClient = new Client({
      node: this.elasticsearchUrl
    });
    
    // Initialize multer
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (this.allowedFormats.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`File format ${ext} not allowed`), false);
        }
      }
    });
  }

  async initialize() {
    this.logger.info('Initializing Storytelling CMS...');
    
    try {
      // Test Elasticsearch connection
      await this.esClient.ping();
      
      // Create index if it doesn't exist
      await this.createSearchIndex();
      
      this.initialized = true;
      this.logger.info('Storytelling CMS initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Storytelling CMS: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Storytelling CMS...');
    this.initialized = false;
    this.logger.info('Storytelling CMS shut down');
  }

  async healthCheck() {
    if (!this.initialized) {
      throw new Error('Storytelling CMS plugin not initialized');
    }
    
    try {
      await this.esClient.ping();
      return { 
        status: 'ok', 
        message: 'Storytelling CMS is operational',
        elasticsearch: 'connected',
        storage: 'available'
      };
    } catch (error) {
      this.logger.error(`Storytelling CMS health check failed: ${error.message}`);
      throw new Error(`Storytelling CMS connectivity issue: ${error.message}`);
    }
  }

  // Create a new story
  async createStory(storyData, authorId, organizationId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const story = await this.prisma.story.create({
        data: {
          title: storyData.title,
          content: storyData.content,
          authorId: authorId,
          organizationId: organizationId,
          status: 'draft',
          templateId: storyData.templateId || null,
          metadata: storyData.metadata || {}
        }
      });

      // Index in Elasticsearch
      await this.indexStory(story);

      this.logger.info(`Story created: ${story.id}`);
      return story;
    } catch (error) {
      this.logger.error(`Failed to create story: ${error.message}`);
      throw error;
    }
  }

  // Update a story
  async updateStory(storyId, updateData) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const story = await this.prisma.story.update({
        where: { id: storyId },
        data: {
          title: updateData.title,
          content: updateData.content,
          templateId: updateData.templateId,
          metadata: updateData.metadata,
          updatedAt: new Date()
        }
      });

      // Update in Elasticsearch
      await this.indexStory(story);

      this.logger.info(`Story updated: ${storyId}`);
      return story;
    } catch (error) {
      this.logger.error(`Failed to update story: ${error.message}`);
      throw error;
    }
  }

  // Publish a story
  async publishStory(storyId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const story = await this.prisma.story.update({
        where: { id: storyId },
        data: {
          status: 'published',
          publishedAt: new Date()
        }
      });

      // Update in Elasticsearch
      await this.indexStory(story);

      this.logger.info(`Story published: ${storyId}`);
      return story;
    } catch (error) {
      this.logger.error(`Failed to publish story: ${error.message}`);
      throw error;
    }
  }

  // Upload media for a story
  async uploadStoryMedia(storyId, file, mediaType) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const mediaKey = `stories/${storyId}/${Date.now()}-${file.originalname}`;
      
      // Process media based on type
      let processedFile = file.buffer;
      let thumbnailUrl = null;
      
      if (mediaType === 'image') {
        // Process image with Sharp
        processedFile = await sharp(file.buffer)
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        // Generate thumbnail
        const thumbnail = await sharp(file.buffer)
          .resize(300, 200, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        thumbnailUrl = await this.uploadToCloudinary(thumbnail, `${mediaKey}-thumb`);
      } else if (mediaType === 'video') {
        // Process video with FFmpeg
        processedFile = await this.processVideo(file.buffer);
        
        // Generate video thumbnail
        thumbnailUrl = await this.generateVideoThumbnail(file.buffer, `${mediaKey}-thumb`);
      }
      
      // Upload to S3
      const mediaUrl = await this.uploadToS3(processedFile, mediaKey, file.mimetype);
      
      // Store media record
      const media = await this.prisma.storyMedia.create({
        data: {
          storyId: storyId,
          type: mediaType,
          url: mediaUrl,
          thumbnail: thumbnailUrl,
          metadata: {
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype
          }
        }
      });

      this.logger.info(`Media uploaded for story ${storyId}: ${media.id}`);
      return media;
    } catch (error) {
      this.logger.error(`Failed to upload story media: ${error.message}`);
      throw error;
    }
  }

  // Search stories
  async searchStories(query, filters = {}, organizationId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const searchQuery = {
        index: 'stories',
        body: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: query,
                    fields: ['title^2', 'content', 'author.name']
                  }
                },
                {
                  term: { 'organizationId': organizationId }
                }
              ],
              filter: []
            }
          },
          sort: [
            { 'publishedAt': { order: 'desc' } },
            { '_score': { order: 'desc' } }
          ],
          size: filters.limit || 20,
          from: filters.offset || 0
        }
      };

      // Add filters
      if (filters.status) {
        searchQuery.body.query.bool.filter.push({
          term: { 'status': filters.status }
        });
      }

      if (filters.templateId) {
        searchQuery.body.query.bool.filter.push({
          term: { 'templateId': filters.templateId }
        });
      }

      if (filters.dateRange) {
        searchQuery.body.query.bool.filter.push({
          range: {
            'publishedAt': {
              gte: filters.dateRange.start,
              lte: filters.dateRange.end
            }
          }
        });
      }

      const response = await this.esClient.search(searchQuery);
      
      return {
        stories: response.body.hits.hits.map(hit => hit._source),
        total: response.body.hits.total.value,
        took: response.body.took
      };
    } catch (error) {
      this.logger.error(`Failed to search stories: ${error.message}`);
      throw error;
    }
  }

  // Get story analytics
  async getStoryAnalytics(storyId) {
    try {
      const analytics = await this.prisma.storyAnalytics.groupBy({
        by: ['event'],
        where: { storyId: storyId },
        _count: { event: true }
      });

      const views = await this.prisma.storyAnalytics.count({
        where: { storyId: storyId, event: 'view' }
      });

      const likes = await this.prisma.storyAnalytics.count({
        where: { storyId: storyId, event: 'like' }
      });

      return {
        views: views,
        likes: likes,
        events: analytics
      };
    } catch (error) {
      this.logger.error(`Failed to get story analytics: ${error.message}`);
      throw error;
    }
  }

  // Track story event
  async trackStoryEvent(storyId, event, userId = null) {
    try {
      await this.prisma.storyAnalytics.create({
        data: {
          storyId: storyId,
          event: event,
          userId: userId,
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: 'storytelling-cms'
          }
        }
      });

      // Update story counters
      if (event === 'view') {
        await this.prisma.story.update({
          where: { id: storyId },
          data: { views: { increment: 1 } }
        });
      } else if (event === 'like') {
        await this.prisma.story.update({
          where: { id: storyId },
          data: { likes: { increment: 1 } }
        });
      }
    } catch (error) {
      this.logger.error(`Failed to track story event: ${error.message}`);
    }
  }

  // Create story template
  async createStoryTemplate(templateData, organizationId) {
    try {
      const template = await this.prisma.storyTemplate.create({
        data: {
          name: templateData.name,
          description: templateData.description,
          content: templateData.content,
          category: templateData.category,
          organizationId: organizationId
        }
      });

      this.logger.info(`Story template created: ${template.id}`);
      return template;
    } catch (error) {
      this.logger.error(`Failed to create story template: ${error.message}`);
      throw error;
    }
  }

  // Get story templates
  async getStoryTemplates(organizationId, category = null) {
    try {
      const where = { organizationId: organizationId };
      if (category) {
        where.category = category;
      }

      const templates = await this.prisma.storyTemplate.findMany({
        where: where,
        orderBy: { createdAt: 'desc' }
      });

      return templates;
    } catch (error) {
      this.logger.error(`Failed to get story templates: ${error.message}`);
      throw error;
    }
  }

  // Index story in Elasticsearch
  async indexStory(story) {
    try {
      await this.esClient.index({
        index: 'stories',
        id: story.id,
        body: {
          id: story.id,
          title: story.title,
          content: story.content,
          status: story.status,
          publishedAt: story.publishedAt,
          organizationId: story.organizationId,
          authorId: story.authorId,
          templateId: story.templateId,
          views: story.views,
          likes: story.likes,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt
        }
      });
    } catch (error) {
      this.logger.error(`Failed to index story: ${error.message}`);
    }
  }

  // Create Elasticsearch index
  async createSearchIndex() {
    try {
      const exists = await this.esClient.indices.exists({ index: 'stories' });
      
      if (!exists.body) {
        await this.esClient.indices.create({
          index: 'stories',
          body: {
            mappings: {
              properties: {
                title: { type: 'text', analyzer: 'standard' },
                content: { type: 'text', analyzer: 'standard' },
                status: { type: 'keyword' },
                publishedAt: { type: 'date' },
                organizationId: { type: 'keyword' },
                authorId: { type: 'keyword' },
                templateId: { type: 'keyword' },
                views: { type: 'integer' },
                likes: { type: 'integer' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' }
              }
            }
          }
        });
        
        this.logger.info('Elasticsearch index created for stories');
      }
    } catch (error) {
      this.logger.error(`Failed to create search index: ${error.message}`);
    }
  }

  // Upload file to S3
  async uploadToS3(buffer, key, contentType) {
    try {
      const params = {
        Bucket: this.storageBucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read'
      };

      const result = await this.s3.upload(params).promise();
      return result.Location;
    } catch (error) {
      this.logger.error(`Failed to upload to S3: ${error.message}`);
      throw error;
    }
  }

  // Upload to Cloudinary
  async uploadToCloudinary(buffer, publicId) {
    try {
      const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${buffer.toString('base64')}`,
        { public_id: publicId }
      );
      return result.secure_url;
    } catch (error) {
      this.logger.error(`Failed to upload to Cloudinary: ${error.message}`);
      throw error;
    }
  }

  // Process video with FFmpeg
  async processVideo(buffer) {
    return new Promise((resolve, reject) => {
      const outputPath = `/tmp/processed-${Date.now()}.mp4`;
      
      ffmpeg()
        .input(buffer)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1920x1080')
        .outputOptions(['-preset fast', '-crf 23'])
        .output(outputPath)
        .on('end', () => {
          const fs = require('fs');
          const processedBuffer = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath);
          resolve(processedBuffer);
        })
        .on('error', reject)
        .run();
    });
  }

  // Generate video thumbnail
  async generateVideoThumbnail(buffer, publicId) {
    return new Promise((resolve, reject) => {
      const thumbnailPath = `/tmp/thumb-${Date.now()}.jpg`;
      
      ffmpeg()
        .input(buffer)
        .screenshots({
          timestamps: ['50%'],
          filename: thumbnailPath,
          size: '300x200'
        })
        .on('end', async () => {
          try {
            const fs = require('fs');
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            const url = await this.uploadToCloudinary(thumbnailBuffer, publicId);
            fs.unlinkSync(thumbnailPath);
            resolve(url);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }
}

module.exports = StorytellingCMSPlugin;
