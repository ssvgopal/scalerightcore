// src/demo/saree/saree-service.js - Saree Demo Service Orchestrator
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const config = require('../../config');
const logger = require('../../utils/logger');
const database = require('../../database');
const LocalStorageService = require('./storage');
const ReplicateProvider = require('./providers/replicate');
const VideoProvider = require('./providers/video');
const DepthProvider = require('./providers/depth');

// Validation schemas
const ingestSchema = z.object({
  productImageUrl: z.string().url('Invalid URL format'),
});

const tryOnSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  avatarSpec: z.object({
    skinTone: z.enum(['fair', 'medium', 'olive', 'tan', 'dark']).optional(),
    hair: z.enum(['long', 'short', 'bun', 'braid']).optional(),
    jewelryMinimal: z.enum(['minimal', 'traditional']).optional(),
    pose: z.enum(['front', 'side', 'threeQuarter']).optional(),
    background: z.enum(['studio', 'lifestyle']).optional(),
  }).optional(),
});

const videoSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  keyframeUrl: z.string().url().optional(),
  style: z.enum(['studioTurntable', 'runwaySubtle']).optional(),
});

const depthmapSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  imageUrl: z.string().url().optional(),
});

class SareeService {
  constructor() {
    this.storage = new LocalStorageService();
    this.replicateProvider = new ReplicateProvider();
    this.videoProvider = new VideoProvider();
    this.depthProvider = new DepthProvider();
    this.prisma = null;
  }

  async initialize() {
    this.prisma = database.client;
  }

  // Ingest saree product image
  async ingestSaree(productImageUrl) {
    try {
      // Validate input
      const validation = ingestSchema.safeParse({ productImageUrl });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      const assetId = uuidv4();
      
      // Download and store the original image
      const result = await this.storage.downloadAndUpload(productImageUrl, assetId);
      
      // Create asset record
      const asset = await this.prisma.asset.create({
        data: {
          id: assetId,
          kind: 'saree',
          status: 'ingested',
          urls: {
            source: result.sourceUrl,
          },
          meta: {
            originalUrl: productImageUrl,
            ingestedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('Saree asset ingested', {
        assetId,
        originalUrl: productImageUrl,
        sourceUrl: result.sourceUrl,
      });

      return {
        assetId,
        sourceUrl: result.sourceUrl,
      };
    } catch (error) {
      logger.error('Saree ingestion failed', { productImageUrl, error: error.message });
      throw error;
    }
  }

  // Generate virtual try-on images
  async generateTryOn(assetId, avatarSpec = {}) {
    try {
      // Validate input
      const validation = tryOnSchema.safeParse({ assetId, avatarSpec });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      // Get asset
      const asset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Update asset status
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'processing',
          meta: {
            ...asset.meta,
            tryOnStartedAt: new Date().toISOString(),
            avatarSpec,
          },
        },
      });

      // Generate try-on images
      const tryOnResult = await this.replicateProvider.generateTryOn(
        asset.urls.source,
        avatarSpec
      );

      // Store try-on images in S3
      const tryOnUrls = [];
      for (let i = 0; i < tryOnResult.images.length; i++) {
        const imageUrl = tryOnResult.images[i];
        const key = `saree/${assetId}/tryon/${i + 1}.jpg`;
        
        // Download and upload to S3
        const response = await fetch(imageUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        const location = await this.storage.uploadFile(key, buffer, 'image/jpeg');
        
        tryOnUrls.push(location);
      }

      // Update asset with try-on URLs
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'completed',
          urls: {
            ...asset.urls,
            tryon: tryOnUrls,
          },
          meta: {
            ...asset.meta,
            tryOnCompletedAt: new Date().toISOString(),
            tryOnJobId: tryOnResult.jobId,
            tryOnCount: tryOnUrls.length,
          },
        },
      });

      logger.info('Try-on generation completed', {
        assetId,
        jobId: tryOnResult.jobId,
        imageCount: tryOnUrls.length,
      });

      // Generate signed URLs
      const signedUrls = await Promise.all(
        tryOnUrls.map(url => this.storage.getPublicUrl(url.split('/').pop()))
      );

      return {
        jobId: tryOnResult.jobId,
        images: signedUrls,
        count: tryOnUrls.length,
      };
    } catch (error) {
      // Update asset status to failed
      if (this.prisma) {
        await this.prisma.asset.update({
          where: { id: assetId },
          data: {
            status: 'failed',
            meta: {
              tryOnError: error.message,
              tryOnFailedAt: new Date().toISOString(),
            },
          },
        }).catch(() => {}); // Ignore errors during failure update
      }

      logger.error('Try-on generation failed', { assetId, error: error.message });
      throw error;
    }
  }

  // Generate cinematic video
  async generateVideo(assetId, keyframeUrl, style = 'studioTurntable') {
    try {
      // Validate input
      const validation = videoSchema.safeParse({ assetId, keyframeUrl, style });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      // Get asset
      const asset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Use first try-on image as keyframe if not provided
      const imageUrl = keyframeUrl || (asset.urls.tryon && asset.urls.tryon[0]);
      
      if (!imageUrl) {
        throw new Error('No keyframe image available');
      }

      // Update asset status
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'processing',
          meta: {
            ...asset.meta,
            videoStartedAt: new Date().toISOString(),
            videoStyle: style,
          },
        },
      });

      // Generate video
      const videoResult = await this.videoProvider.generateVideo(imageUrl, style);

      // Download and store video in S3
      const videoResponse = await fetch(videoResult.videoUrl);
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const videoKey = `saree/${assetId}/video/demo.mp4`;
      const videoLocation = await this.storage.uploadFile(videoKey, videoBuffer, 'video/mp4');

      // Update asset with video URL
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'completed',
          urls: {
            ...asset.urls,
            video: videoLocation,
          },
          meta: {
            ...asset.meta,
            videoCompletedAt: new Date().toISOString(),
            videoJobId: videoResult.jobId,
            videoProvider: videoResult.provider,
          },
        },
      });

      logger.info('Video generation completed', {
        assetId,
        jobId: videoResult.jobId,
        provider: videoResult.provider,
      });

      // Generate signed URL
      const signedUrl = await this.storage.getPublicUrl(videoKey);

      return {
        jobId: videoResult.jobId,
        videoUrl: signedUrl,
        provider: videoResult.provider,
      };
    } catch (error) {
      // Update asset status to failed
      if (this.prisma) {
        await this.prisma.asset.update({
          where: { id: assetId },
          data: {
            status: 'failed',
            meta: {
              videoError: error.message,
              videoFailedAt: new Date().toISOString(),
            },
          },
        }).catch(() => {}); // Ignore errors during failure update
      }

      logger.error('Video generation failed', { assetId, error: error.message });
      throw error;
    }
  }

  // Generate depth map and normals
  async generateDepthMap(assetId, imageUrl) {
    try {
      // Validate input
      const validation = depthmapSchema.safeParse({ assetId, imageUrl });
      if (!validation.success) {
        throw new Error(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      }

      // Get asset
      const asset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Use first try-on image if not provided
      const selectedImageUrl = imageUrl || (asset.urls.tryon && asset.urls.tryon[0]);
      
      if (!selectedImageUrl) {
        throw new Error('No image available for depth processing');
      }

      // Update asset status
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'processing',
          meta: {
            ...asset.meta,
            depthStartedAt: new Date().toISOString(),
          },
        },
      });

      // Generate depth map and normals
      const depthResult = await this.depthProvider.generateDepthMap(selectedImageUrl);

      // Store depth map and normals in S3
      const depthKey = `saree/${assetId}/depth/depth.png`;
      const normalsKey = `saree/${assetId}/depth/normals.png`;
      
      const depthLocation = await this.storage.uploadFile(depthKey, depthResult.depthMap, 'image/png');
      const normalsLocation = await this.storage.uploadFile(normalsKey, depthResult.normalMap, 'image/png');

      // Update asset with depth URLs
      await this.prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'completed',
          urls: {
            ...asset.urls,
            depth: depthLocation,
            normals: normalsLocation,
          },
          meta: {
            ...asset.meta,
            depthCompletedAt: new Date().toISOString(),
            depthProvider: depthResult.provider,
            cameraParams: depthResult.cameraParams,
          },
        },
      });

      logger.info('Depth map generation completed', {
        assetId,
        provider: depthResult.provider,
      });

      // Generate signed URLs
      const depthSignedUrl = await this.storage.getPublicUrl(depthKey);
      const normalsSignedUrl = await this.storage.getPublicUrl(normalsKey);

      return {
        depthUrl: depthSignedUrl,
        normalsUrl: normalsSignedUrl,
        cameraParams: depthResult.cameraParams,
        provider: depthResult.provider,
      };
    } catch (error) {
      // Update asset status to failed
      if (this.prisma) {
        await this.prisma.asset.update({
          where: { id: assetId },
          data: {
            status: 'failed',
            meta: {
              depthError: error.message,
              depthFailedAt: new Date().toISOString(),
            },
          },
        }).catch(() => {}); // Ignore errors during failure update
      }

      logger.error('Depth map generation failed', { assetId, error: error.message });
      throw error;
    }
  }

  // Get asset status and URLs
  async getAssetStatus(assetId) {
    try {
      const asset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Generate signed URLs for all available assets
      const urls = {};
      
      if (asset.urls.source) {
        const key = asset.urls.source.split('/').pop();
        signedUrls.source = await this.storage.getPublicUrl(`saree/${assetId}/${key}`);
      }

      if (asset.urls.tryon && asset.urls.tryon.length > 0) {
        urls.tryon = [];
        for (let i = 0; i < asset.urls.tryon.length; i++) {
          const url = asset.urls.tryon[i];
          const key = url.split('/').pop();
          const signedUrl = await this.storage.getPublicUrl(`saree/${assetId}/tryon/${key}`);
          signedUrls.tryon.push(signedUrl);
        }
      }

      if (asset.urls.video) {
        const key = asset.urls.video.split('/').pop();
        urls.video = await this.storage.getPublicUrl(`saree/${assetId}/video/${key}`);
      }

      if (asset.urls.depth) {
        const key = asset.urls.depth.split('/').pop();
        urls.depth = await this.storage.getPublicUrl(`saree/${assetId}/depth/${key}`);
      }

      if (asset.urls.normals) {
        const key = asset.urls.normals.split('/').pop();
        urls.normals = await this.storage.getPublicUrl(`saree/${assetId}/depth/${key}`);
      }

      return {
        assetId,
        kind: asset.kind,
        status: asset.status,
        urls: signedUrls,
        meta: asset.meta,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get asset status', { assetId, error: error.message });
      throw error;
    }
  }

  // Generate embed HTML for demo
  async generateEmbedHtml(assetId) {
    try {
      const asset = await this.getAssetStatus(assetId);
      
      const embedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Saree Demo - ${assetId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { margin-bottom: 40px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .carousel { display: flex; gap: 10px; overflow-x: auto; padding: 10px 0; }
        .carousel img { width: 300px; height: 400px; object-fit: cover; border-radius: 4px; cursor: pointer; }
        .carousel img:hover { transform: scale(1.05); transition: transform 0.2s; }
        .video-container { text-align: center; }
        .video-container video { max-width: 100%; border-radius: 8px; }
        .parallax-container { position: relative; width: 100%; height: 600px; overflow: hidden; border-radius: 8px; cursor: move; }
        .parallax-image { position: absolute; width: 120%; height: 120%; object-fit: cover; }
        h2 { margin-top: 0; color: #333; }
        .status { padding: 8px 16px; border-radius: 4px; display: inline-block; margin-bottom: 20px; }
        .status.completed { background: #d4edda; color: #155724; }
        .status.processing { background: #fff3cd; color: #856404; }
        .status.failed { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="status ${asset.status}">Status: ${asset.status.toUpperCase()}</div>
        
        ${asset.urls.tryon && asset.urls.tryon.length > 0 ? `
        <div class="section">
            <h2>Virtual Try-On Gallery</h2>
            <div class="carousel">
                ${asset.urls.tryon.map(url => `<img src="${url}" alt="Try-on result" />`).join('')}
            </div>
        </div>
        ` : ''}
        
        ${asset.urls.video ? `
        <div class="section">
            <h2>Cinematic Video</h2>
            <div class="video-container">
                <video controls autoplay muted loop>
                    <source src="${asset.urls.video}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
        ` : ''}
        
        ${asset.urls.depth && asset.urls.normals ? `
        <div class="section">
            <h2>2.5D Interactive View</h2>
            <div class="parallax-container" id="parallax-container">
                <img class="parallax-image" src="${asset.urls.tryon[0]}" alt="2.5D View" />
            </div>
        </div>
        ` : ''}
    </div>
    
    <script>
        // Simple 2.5D parallax effect
        const container = document.getElementById('parallax-container');
        if (container) {
            const image = container.querySelector('.parallax-image');
            let isMouseDown = false;
            let startX, startY, scrollLeft, scrollTop;
            
            container.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                startX = e.pageX - container.offsetLeft;
                startY = e.pageY - container.offsetTop;
                scrollLeft = image.offsetLeft;
                scrollTop = image.offsetTop;
            });
            
            container.addEventListener('mouseleave', () => {
                isMouseDown = false;
            });
            
            container.addEventListener('mouseup', () => {
                isMouseDown = false;
            });
            
            container.addEventListener('mousemove', (e) => {
                if (!isMouseDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const y = e.pageY - container.offsetTop;
                const walkX = (x - startX) * 0.5;
                const walkY = (y - startY) * 0.5;
                image.style.transform = \`translate(\${scrollLeft + walkX}px, \${scrollTop + walkY}px)\`;
            });
        }
    </script>
</body>
</html>`;

      return embedHtml;
    } catch (error) {
      logger.error('Failed to generate embed HTML', { assetId, error: error.message });
      throw error;
    }
  }
}

module.exports = SareeService;