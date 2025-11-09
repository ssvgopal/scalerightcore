// plugins/ai/sarvam/index.js - Sarvam AI Voice Integration Plugin
const axios = require('axios');
const AWS = require('aws-sdk');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');
const logger = require('../../../src/utils/logger');

class SarvamAIPlugin {
  constructor(config, prisma, loggerInstance) {
    this.config = config;
    this.prisma = prisma;
    this.logger = loggerInstance || logger;
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.sarvam.ai/v1/';
    this.supportedLanguages = config.supportedLanguages || ['hi', 'en', 'ta', 'te', 'bn'];
    this.maxDuration = config.maxDuration || 300;
    this.storageBucket = config.storageBucket || 'orchestrall-voice';
    this.initialized = false;
    
    // Initialize AWS S3 for audio storage
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'ap-south-1'
    });
    
    // Initialize multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
          cb(null, true);
        } else {
          cb(new Error('Only audio files are allowed'), false);
        }
      }
    });
  }

  async initialize() {
    this.logger.info('Initializing Sarvam AI Voice Integration...');
    
    if (!this.apiKey) {
      throw new Error('Sarvam AI API key is required');
    }

    // Test API connection
    try {
      await this.testConnection();
      this.initialized = true;
      this.logger.info('Sarvam AI Voice Integration initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Sarvam AI: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Sarvam AI Voice Integration...');
    this.initialized = false;
    this.logger.info('Sarvam AI Voice Integration shut down');
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Sarvam AI connection test failed: ${error.message}`);
      throw new Error(`Sarvam AI API connectivity issue: ${error.message}`);
    }
  }

  async healthCheck() {
    if (!this.initialized) {
      throw new Error('Sarvam AI plugin not initialized');
    }
    
    try {
      await this.testConnection();
      return { 
        status: 'ok', 
        message: 'Sarvam AI API is accessible',
        supportedLanguages: this.supportedLanguages
      };
    } catch (error) {
      this.logger.error(`Sarvam AI health check failed: ${error.message}`);
      throw new Error(`Sarvam AI API connectivity issue: ${error.message}`);
    }
  }

  // Voice-to-Text conversion
  async convertVoiceToText(audioBuffer, language = 'hi', options = {}) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      this.logger.info(`Converting voice to text in language: ${language}`);
      
      // Upload audio to S3
      const audioKey = `voice-input/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.wav`;
      await this.uploadAudioToS3(audioBuffer, audioKey);
      
      // Call Sarvam AI API
      const response = await axios.post(`${this.apiUrl}speech-to-text`, {
        audio_url: `s3://${this.storageBucket}/${audioKey}`,
        language: language,
        options: {
          enable_punctuation: true,
          enable_speaker_diarization: options.enableSpeakerDiarization || false,
          ...options
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      
      this.logger.info(`Voice-to-text conversion completed: ${result.text?.length || 0} characters`);
      
      return {
        text: result.text,
        confidence: result.confidence,
        language: result.detected_language || language,
        duration: result.duration,
        speakers: result.speakers || [],
        metadata: result
      };
    } catch (error) {
      this.logger.error(`Voice-to-text conversion failed: ${error.message}`);
      throw error;
    }
  }

  // Text-to-Speech synthesis
  async convertTextToSpeech(text, language = 'hi', voice = 'default', options = {}) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      this.logger.info(`Converting text to speech in language: ${language}`);
      
      const response = await axios.post(`${this.apiUrl}text-to-speech`, {
        text: text,
        language: language,
        voice: voice,
        options: {
          speed: options.speed || 1.0,
          pitch: options.pitch || 1.0,
          volume: options.volume || 1.0,
          ...options
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const result = response.data;
      
      // Download and store audio file
      const audioKey = `voice-output/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.wav`;
      await this.downloadAndStoreAudio(result.audio_url, audioKey);
      
      this.logger.info(`Text-to-speech conversion completed`);
      
      return {
        audioUrl: `s3://${this.storageBucket}/${audioKey}`,
        duration: result.duration,
        language: language,
        voice: voice,
        metadata: result
      };
    } catch (error) {
      this.logger.error(`Text-to-speech conversion failed: ${error.message}`);
      throw error;
    }
  }

  // Start a voice call session
  async startVoiceCall(farmerId, language = 'hi', organizationId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const sessionId = `voice-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create voice call record
      const voiceCall = await this.prisma.voiceCall.create({
        data: {
          sessionId: sessionId,
          farmerId: farmerId,
          organizationId: organizationId,
          language: language,
          status: 'active',
          duration: 0,
          metadata: {
            startTime: new Date().toISOString(),
            language: language
          }
        }
      });

      this.logger.info(`Voice call session started: ${sessionId}`);
      
      return {
        sessionId: sessionId,
        callId: voiceCall.id,
        status: 'active',
        language: language,
        websocketUrl: `ws://localhost:3000/ws/voice/${sessionId}`
      };
    } catch (error) {
      this.logger.error(`Failed to start voice call: ${error.message}`);
      throw error;
    }
  }

  // End a voice call session
  async endVoiceCall(sessionId, transcript = null) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const voiceCall = await this.prisma.voiceCall.findUnique({
        where: { sessionId: sessionId }
      });

      if (!voiceCall) {
        throw new Error('Voice call session not found');
      }

      const duration = Math.floor((Date.now() - new Date(voiceCall.metadata.startTime).getTime()) / 1000);
      
      // Update voice call record
      const updatedCall = await this.prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          status: 'completed',
          duration: duration,
          transcript: transcript,
          metadata: {
            ...voiceCall.metadata,
            endTime: new Date().toISOString(),
            duration: duration
          }
        }
      });

      // Generate analytics if transcript is available
      if (transcript) {
        await this.generateCallAnalytics(voiceCall.id, transcript);
      }

      this.logger.info(`Voice call session ended: ${sessionId}, duration: ${duration}s`);
      
      return {
        callId: voiceCall.id,
        sessionId: sessionId,
        status: 'completed',
        duration: duration,
        transcript: transcript
      };
    } catch (error) {
      this.logger.error(`Failed to end voice call: ${error.message}`);
      throw error;
    }
  }

  // Generate call analytics using AI
  async generateCallAnalytics(callId, transcript) {
    try {
      // Call Sarvam AI for sentiment analysis and topic extraction
      const response = await axios.post(`${this.apiUrl}analyze-text`, {
        text: transcript,
        analysis_types: ['sentiment', 'topics', 'keywords']
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const analysis = response.data;
      
      // Store analytics
      await this.prisma.voiceAnalytics.create({
        data: {
          callId: callId,
          sentiment: analysis.sentiment?.label || 'neutral',
          topics: analysis.topics || [],
          confidence: analysis.sentiment?.confidence || 0.5,
          metadata: analysis
        }
      });

      this.logger.info(`Call analytics generated for call: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to generate call analytics: ${error.message}`);
    }
  }

  // Get call history for a farmer
  async getFarmerCallHistory(farmerId, limit = 10) {
    try {
      const calls = await this.prisma.voiceCall.findMany({
        where: { farmerId: farmerId },
        include: {
          analytics: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return calls.map(call => ({
        id: call.id,
        sessionId: call.sessionId,
        language: call.language,
        duration: call.duration,
        status: call.status,
        transcript: call.transcript,
        createdAt: call.createdAt,
        analytics: call.analytics
      }));
    } catch (error) {
      this.logger.error(`Failed to get farmer call history: ${error.message}`);
      throw error;
    }
  }

  // Upload audio file to S3
  async uploadAudioToS3(audioBuffer, key) {
    try {
      const params = {
        Bucket: this.storageBucket,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/wav',
        ACL: 'private'
      };

      await this.s3.upload(params).promise();
      this.logger.debug(`Audio uploaded to S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload audio to S3: ${error.message}`);
      throw error;
    }
  }

  // Download and store audio from URL
  async downloadAndStoreAudio(audioUrl, key) {
    try {
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      
      const params = {
        Bucket: this.storageBucket,
        Key: key,
        Body: Buffer.from(response.data),
        ContentType: 'audio/wav',
        ACL: 'private'
      };

      await this.s3.upload(params).promise();
      this.logger.debug(`Audio downloaded and stored: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to download and store audio: ${error.message}`);
      throw error;
    }
  }

  // Get supported languages
  getSupportedLanguages() {
    return this.supportedLanguages.map(code => ({
      code: code,
      name: this.getLanguageName(code)
    }));
  }

  // Get language name from code
  getLanguageName(code) {
    const languages = {
      'hi': 'Hindi',
      'en': 'English',
      'ta': 'Tamil',
      'te': 'Telugu',
      'bn': 'Bengali'
    };
    return languages[code] || code;
  }

  // Validate language support
  isLanguageSupported(language) {
    return this.supportedLanguages.includes(language);
  }
}

module.exports = SarvamAIPlugin;
