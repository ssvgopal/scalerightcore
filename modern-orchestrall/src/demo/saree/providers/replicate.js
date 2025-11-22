// src/demo/saree/providers/replicate.js - Replicate Provider for Virtual Try-On
const axios = require('axios');
const config = require('../../../config');
const logger = require('../../../utils/logger');

class ReplicateProvider {
  constructor() {
    this.apiToken = config.demo.replicateApiToken;
    this.baseUrl = 'https://api.replicate.com/v1';
  }

  // Generate virtual try-on images
  async generateTryOn(sourceImageUrl, avatarSpec) {
    try {
      if (!this.apiToken) {
        throw new Error('Replicate API token not configured');
      }

      // Create prompt for Indian model avatar
      const prompt = this.buildAvatarPrompt(avatarSpec);
      
      // Use OutfitAnyone or TryOnDiffusion model
      const model = this.getTryOnModel();
      
      const prediction = await this.createPrediction(model, {
        source_image: sourceImageUrl,
        prompt: prompt,
        num_outputs: 6, // Generate 6 images
        guidance_scale: 7.5,
        num_inference_steps: 50,
        width: 1024,
        height: 1536,
      });

      logger.info('Replicate try-on prediction created', {
        predictionId: prediction.id,
        model,
        sourceImageUrl,
      });

      // Poll for completion
      const result = await this.pollPrediction(prediction.id);
      
      if (result.status === 'failed') {
        throw new Error(`Try-on generation failed: ${result.error}`);
      }

      // Extract image URLs
      const imageUrls = result.output || [];
      
      logger.info('Replicate try-on completed', {
        predictionId: prediction.id,
        imageCount: imageUrls.length,
      });

      return {
        jobId: prediction.id,
        images: imageUrls,
        status: 'completed',
      };
    } catch (error) {
      logger.error('Replicate try-on failed', { error: error.message });
      throw error;
    }
  }

  // Create a prediction
  async createPrediction(model, inputs) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/predictions`,
        {
          version: model.version,
          inputs: inputs,
        },
        {
          headers: {
            'Authorization': `Token ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to create Replicate prediction', { error: error.message });
      throw error;
    }
  }

  // Get prediction status
  async getPrediction(predictionId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${this.apiToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get Replicate prediction', { predictionId, error: error.message });
      throw error;
    }
  }

  // Poll prediction until completion
  async pollPrediction(predictionId, maxAttempts = 60, delayMs = 2000) {
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const prediction = await this.getPrediction(predictionId);
        
        logger.debug('Replicate prediction status', {
          predictionId,
          status: prediction.status,
          attempt: attempt + 1,
        });

        if (prediction.status === 'succeeded') {
          return prediction;
        }

        if (prediction.status === 'failed') {
          return prediction;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      throw new Error('Prediction timed out');
    } catch (error) {
      logger.error('Prediction polling failed', { predictionId, error: error.message });
      throw error;
    }
  }

  // Build avatar prompt based on specifications
  buildAvatarPrompt(avatarSpec) {
    const { skinTone, hair, jewelryMinimal, pose, background } = avatarSpec || {};
    
    let prompt = 'Beautiful Indian model wearing traditional saree';
    
    // Add skin tone
    if (skinTone) {
      const skinTones = {
        fair: 'fair skin tone',
        medium: 'medium skin tone',
        olive: 'olive skin tone',
        tan: 'tan skin tone',
        dark: 'deep skin tone',
      };
      prompt += `, ${skinTones[skinTone] || skinTone}`;
    }
    
    // Add hair
    if (hair) {
      const hairstyles = {
        long: 'long flowing hair',
        short: 'short elegant hair',
        bun: 'hair in traditional bun',
        braid: 'hair in braid',
      };
      prompt += `, ${hairstyles[hair] || hair}`;
    }
    
    // Add jewelry
    if (jewelryMinimal === 'minimal') {
      prompt += ', minimal elegant jewelry';
    } else if (jewelryMinimal === 'traditional') {
      prompt += ', traditional Indian jewelry';
    }
    
    // Add pose
    if (pose) {
      const poses = {
        front: 'front facing pose',
        side: 'side profile pose',
        threeQuarter: 'three-quarter view pose',
      };
      prompt += `, ${poses[pose] || poses.front}`;
    }
    
    // Add background
    if (background) {
      const backgrounds = {
        studio: 'studio background',
        lifestyle: 'lifestyle background',
      };
      prompt += `, ${backgrounds[background] || backgrounds.studio}`;
    }
    
    // Add quality modifiers
    prompt += ', photorealistic, high detail, professional photography, soft lighting';
    
    return prompt;
  }

  // Get try-on model configuration
  getTryOnModel() {
    // Use OutfitAnyone as default (can be switched to TryOnDiffusion)
    return {
      version: 'c221b2a8fbd88e867764db9ca5d6c63752b16c7512a369b1d3fcd6e8c447e930', // Example version
      name: 'outfit-anyone',
    };
  }

  // Check if provider is configured
  isConfigured() {
    return !!this.apiToken;
  }
}

module.exports = ReplicateProvider;