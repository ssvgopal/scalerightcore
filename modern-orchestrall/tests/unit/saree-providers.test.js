// tests/unit/saree-providers.test.js - Unit Tests for Saree Provider Clients
const ReplicateProvider = require('../../src/demo/saree/providers/replicate');
const VideoProvider = require('../../src/demo/saree/providers/video');
const DepthProvider = require('../../src/demo/saree/providers/depth');

describe('Saree Provider Clients', () => {
  describe('ReplicateProvider', () => {
    let provider;

    beforeAll(() => {
      provider = new ReplicateProvider();
    });

    describe('Avatar prompt building', () => {
      it('should build basic avatar prompt', () => {
        const prompt = provider.buildAvatarPrompt({});
        expect(prompt).toContain('Beautiful Indian model wearing traditional saree');
        expect(prompt).toContain('photorealistic');
        expect(prompt).toContain('professional photography');
      });

      it('should include skin tone in prompt', () => {
        const prompt = provider.buildAvatarPrompt({ skinTone: 'fair' });
        expect(prompt).toContain('fair skin tone');
      });

      it('should include hair style in prompt', () => {
        const prompt = provider.buildAvatarPrompt({ hair: 'long' });
        expect(prompt).toContain('long flowing hair');
      });

      it('should include jewelry preference in prompt', () => {
        const prompt = provider.buildAvatarPrompt({ jewelryMinimal: 'minimal' });
        expect(prompt).toContain('minimal elegant jewelry');
      });

      it('should include pose in prompt', () => {
        const prompt = provider.buildAvatarPrompt({ pose: 'side' });
        expect(prompt).toContain('side profile pose');
      });

      it('should include background in prompt', () => {
        const prompt = provider.buildAvatarPrompt({ background: 'lifestyle' });
        expect(prompt).toContain('lifestyle background');
      });

      it('should build comprehensive prompt with all options', () => {
        const avatarSpec = {
          skinTone: 'medium',
          hair: 'bun',
          jewelryMinimal: 'traditional',
          pose: 'threeQuarter',
          background: 'studio',
        };

        const prompt = provider.buildAvatarPrompt(avatarSpec);
        
        expect(prompt).toContain('medium skin tone');
        expect(prompt).toContain('hair in traditional bun');
        expect(prompt).toContain('traditional Indian jewelry');
        expect(prompt).toContain('three-quarter view pose');
        expect(prompt).toContain('studio background');
      });
    });

    describe('Configuration check', () => {
      it('should return false when not configured', () => {
        const unconfiguredProvider = new ReplicateProvider();
        expect(unconfiguredProvider.isConfigured()).toBe(false);
      });
    });
  });

  describe('VideoProvider', () => {
    let provider;

    beforeAll(() => {
      provider = new VideoProvider();
    });

    describe('Video prompt building', () => {
      it('should build studio turntable prompt', () => {
        const prompt = provider.buildVideoPrompt('studioTurntable');
        expect(prompt).toContain('Cinematic studio turntable shot');
        expect(prompt).toContain('professional lighting');
        expect(prompt).toContain('clean background');
      });

      it('should build runway subtle prompt', () => {
        const prompt = provider.buildVideoPrompt('runwaySubtle');
        expect(prompt).toContain('Runway fashion video');
        expect(prompt).toContain('model walking gracefully');
        expect(prompt).toContain('fashion show style');
      });

      it('should default to studio turntable for unknown style', () => {
        const prompt = provider.buildVideoPrompt('unknown');
        expect(prompt).toContain('Cinematic studio turntable shot');
      });
    });

    describe('Configuration check', () => {
      it('should return false when no API keys are configured', () => {
        const unconfiguredProvider = new VideoProvider();
        expect(unconfiguredProvider.isConfigured()).toBe(false);
      });
    });
  });

  describe('DepthProvider', () => {
    let provider;

    beforeAll(() => {
      provider = new DepthProvider();
    });

    describe('Camera parameters calculation', () => {
      it('should calculate camera parameters correctly', () => {
        const params = provider.calculateCameraParams(1920, 1080);
        
        expect(params).toHaveProperty('fov');
        expect(params).toHaveProperty('aspectRatio');
        expect(params).toHaveProperty('near');
        expect(params).toHaveProperty('far');
        expect(params).toHaveProperty('focalLength');
        expect(params).toHaveProperty('depthScale');
        expect(params).toHaveProperty('parallaxStrength');
        
        expect(params.fov).toBe(60);
        expect(params.aspectRatio).toBe(1920 / 1080);
        expect(params.near).toBe(0.1);
        expect(params.far).toBe(1000);
        expect(params.depthScale).toBe(1000);
        expect(params.parallaxStrength).toBe(0.5);
      });
    });

    describe('Configuration check', () => {
      it('should return true for local provider', () => {
        const localProvider = new DepthProvider();
        expect(localProvider.isConfigured()).toBe(true);
      });
    });
  });
});