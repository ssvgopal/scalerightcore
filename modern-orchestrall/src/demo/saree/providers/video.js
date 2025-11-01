// src/demo/saree/providers/video.js - Video Generation Provider
const axios = require('axios');
const config = require('../../../config');
const logger = require('../../../utils/logger');

class VideoProvider {
  constructor() {
    this.provider = config.demo.videoProvider;
    this.lumaApiKey = config.demo.lumaApiKey;
    this.runwayApiKey = config.demo.runwayApiKey;
    this.pikaApiKey = config.demo.pikaApiKey;
  }

  // Generate video from try-on image
  async generateVideo(imageUrl, style = 'studioTurntable') {
    try {
      switch (this.provider) {
        case 'luma':
          return await this.generateLumaVideo(imageUrl, style);
        case 'runway':
          return await this.generateRunwayVideo(imageUrl, style);
        case 'pika':
          return await this.generatePikaVideo(imageUrl, style);
        default:
          throw new Error(`Unsupported video provider: ${this.provider}`);
      }
    } catch (error) {
      logger.error('Video generation failed', { provider: this.provider, error: error.message });
      throw error;
    }
  }

  // Generate video using Luma Dream Machine
  async generateLumaVideo(imageUrl, style) {
    try {
      if (!this.lumaApiKey) {
        throw new Error('Luma API key not configured');
      }

      const prompt = this.buildVideoPrompt(style);
      
      const response = await axios.post(
        'https://api.lumalabs.ai/dream-machine/v1/generations',
        {
          prompt: prompt,
          image_url: imageUrl,
          duration: 10, // 10 seconds
          aspect_ratio: '16:9',
          resolution: '1080p',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.lumaApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const generation = response.data;
      
      logger.info('Luma video generation started', {
        generationId: generation.id,
        imageUrl,
        style,
      });

      // Poll for completion
      const result = await this.pollLumaGeneration(generation.id);
      
      return {
        jobId: generation.id,
        videoUrl: result.video_url,
        status: 'completed',
        provider: 'luma',
      };
    } catch (error) {
      logger.error('Luma video generation failed', { error: error.message });
      throw error;
    }
  }

  // Generate video using Runway Gen-3
  async generateRunwayVideo(imageUrl, style) {
    try {
      if (!this.runwayApiKey) {
        throw new Error('Runway API key not configured');
      }

      const prompt = this.buildVideoPrompt(style);
      
      const response = await axios.post(
        'https://api.runwayml.com/v1/video/generations',
        {
          prompt: prompt,
          image_url: imageUrl,
          duration: 8, // 8 seconds
          ratio: '16:9',
          watermark: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.runwayApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const generation = response.data;
      
      logger.info('Runway video generation started', {
        generationId: generation.id,
        imageUrl,
        style,
      });

      // Poll for completion
      const result = await this.pollRunwayGeneration(generation.id);
      
      return {
        jobId: generation.id,
        videoUrl: result.video_url,
        status: 'completed',
        provider: 'runway',
      };
    } catch (error) {
      logger.error('Runway video generation failed', { error: error.message });
      throw error;
    }
  }

  // Generate video using Pika
  async generatePikaVideo(imageUrl, style) {
    try {
      if (!this.pikaApiKey) {
        throw new Error('Pika API key not configured');
      }

      const prompt = this.buildVideoPrompt(style);
      
      const response = await axios.post(
        'https://api.pika.art/v1/generations',
        {
          prompt: prompt,
          input_image: imageUrl,
          duration: 12, // 12 seconds
          aspect_ratio: '16:9',
          frame_rate: 24,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.pikaApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const generation = response.data;
      
      logger.info('Pika video generation started', {
        generationId: generation.id,
        imageUrl,
        style,
      });

      // Poll for completion
      const result = await this.pollPikaGeneration(generation.id);
      
      return {
        jobId: generation.id,
        videoUrl: result.video_url,
        status: 'completed',
        provider: 'pika',
      };
    } catch (error) {
      logger.error('Pika video generation failed', { error: error.message });
      throw error;
    }
  }

  // Poll Luma generation
  async pollLumaGeneration(generationId, maxAttempts = 60, delayMs = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `https://api.lumalabs.ai/dream-machine/v1/generations/${generationId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.lumaApiKey}`,
            },
          }
        );

        const generation = response.data;
        
        logger.debug('Luma generation status', {
          generationId,
          status: generation.status,
          attempt: attempt + 1,
        });

        if (generation.status === 'completed') {
          return generation;
        }

        if (generation.status === 'failed') {
          throw new Error(`Generation failed: ${generation.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Luma generation timed out');
  }

  // Poll Runway generation
  async pollRunwayGeneration(generationId, maxAttempts = 60, delayMs = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `https://api.runwayml.com/v1/video/generations/${generationId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.runwayApiKey}`,
            },
          }
        );

        const generation = response.data;
        
        logger.debug('Runway generation status', {
          generationId,
          status: generation.status,
          attempt: attempt + 1,
        });

        if (generation.status === 'completed') {
          return generation;
        }

        if (generation.status === 'failed') {
          throw new Error(`Generation failed: ${generation.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Runway generation timed out');
  }

  // Poll Pika generation
  async pollPikaGeneration(generationId, maxAttempts = 60, delayMs = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `https://api.pika.art/v1/generations/${generationId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.pikaApiKey}`,
            },
          }
        );

        const generation = response.data;
        
        logger.debug('Pika generation status', {
          generationId,
          status: generation.status,
          attempt: attempt + 1,
        });

        if (generation.status === 'completed') {
          return generation;
        }

        if (generation.status === 'failed') {
          throw new Error(`Generation failed: ${generation.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        if (attempt === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Pika generation timed out');
  }

  // Build video prompt based on style
  buildVideoPrompt(style) {
    const prompts = {
      studioTurntable: 'Cinematic studio turntable shot, model slowly turning to showcase the saree, professional lighting, clean background, high fashion photography',
      runwaySubtle: 'Runway fashion video, model walking gracefully with subtle movements, soft fabric flow, elegant presentation, fashion show style',
    };
    
    return prompts[style] || prompts.studioTurntable;
  }

  // Check if provider is configured
  isConfigured() {
    switch (this.provider) {
      case 'luma':
        return !!this.lumaApiKey;
      case 'runway':
        return !!this.runwayApiKey;
      case 'pika':
        return !!this.pikaApiKey;
      default:
        return false;
    }
  }
}

module.exports = VideoProvider;