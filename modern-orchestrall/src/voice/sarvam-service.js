const AWS = require('aws-sdk');
const axios = require('axios');

class SarvamVoiceService {
  constructor() {
    this.apiKey = process.env.SARVAM_API_KEY;
    this.modelId = process.env.SARVAM_MODEL_ID;
    this.baseUrl = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';
    
    // Initialize AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    this.bucketName = process.env.AWS_S3_BUCKET || 'orchestrall-voice-storage';
    this.callSessions = new Map();
  }

  async processVoiceCall(audioData, sessionId, options = {}) {
    try {
      const session = {
        id: sessionId,
        startTime: new Date(),
        status: 'processing',
        language: options.language || 'en',
        organizationId: options.organizationId,
        userId: options.userId,
        audioData: null,
        transcript: null,
        sentiment: null,
        entities: null,
        intent: null,
        response: null,
        duration: 0,
        cost: 0
      };

      this.callSessions.set(sessionId, session);

      // Upload audio to S3
      const audioUrl = await this.uploadAudioToS3(audioData, sessionId);
      session.audioData = audioUrl;

      // Process with Sarvam AI
      const processingResult = await this.processWithSarvam(audioData, options);
      
      if (processingResult.success) {
        session.transcript = processingResult.transcript;
        session.sentiment = processingResult.sentiment;
        session.entities = processingResult.entities;
        session.intent = processingResult.intent;
        session.response = processingResult.response;
        session.status = 'completed';
        session.duration = processingResult.duration;
        session.cost = processingResult.cost;
      } else {
        session.status = 'failed';
        session.error = processingResult.error;
      }

      session.endTime = new Date();

      return {
        success: true,
        session: {
          id: sessionId,
          status: session.status,
          transcript: session.transcript,
          sentiment: session.sentiment,
          entities: session.entities,
          intent: session.intent,
          response: session.response,
          duration: session.duration,
          cost: session.cost,
          audioUrl: session.audioData
        }
      };
    } catch (error) {
      console.error('Voice call processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processWithSarvam(audioData, options) {
    try {
      const requestData = {
        audio: audioData,
        model_id: this.modelId,
        language: options.language || 'en',
        features: ['transcription', 'sentiment', 'entities', 'intent'],
        ...options
      };

      const response = await axios.post(
        `${this.baseUrl}/v1/process`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const result = response.data;

      return {
        success: true,
        transcript: result.transcript,
        sentiment: result.sentiment,
        entities: result.entities,
        intent: result.intent,
        response: result.response,
        duration: result.duration,
        cost: result.cost
      };
    } catch (error) {
      console.error('Sarvam AI processing failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  async uploadAudioToS3(audioData, sessionId) {
    try {
      const key = `voice-calls/${sessionId}/${Date.now()}.wav`;
      
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: audioData,
        ContentType: 'audio/wav',
        ACL: 'private'
      };

      const result = await this.s3.upload(params).promise();
      
      return result.Location;
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new Error(`Audio upload failed: ${error.message}`);
    }
  }

  async getCallSession(sessionId) {
    const session = this.callSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Call session not found'
      };
    }

    return {
      success: true,
      session: {
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        language: session.language,
        organizationId: session.organizationId,
        userId: session.userId,
        transcript: session.transcript,
        sentiment: session.sentiment,
        entities: session.entities,
        intent: session.intent,
        response: session.response,
        duration: session.duration,
        cost: session.cost,
        audioUrl: session.audioData,
        error: session.error
      }
    };
  }

  async getAllCallSessions(organizationId, filters = {}) {
    try {
      const sessions = Array.from(this.callSessions.values())
        .filter(session => session.organizationId === organizationId)
        .filter(session => {
          if (filters.status && session.status !== filters.status) return false;
          if (filters.userId && session.userId !== filters.userId) return false;
          if (filters.language && session.language !== filters.language) return false;
          if (filters.startDate && session.startTime < new Date(filters.startDate)) return false;
          if (filters.endDate && session.startTime > new Date(filters.endDate)) return false;
          return true;
        })
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, filters.limit || 100)
        .map(session => ({
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          language: session.language,
          userId: session.userId,
          duration: session.duration,
          cost: session.cost,
          sentiment: session.sentiment,
          intent: session.intent
        }));

      return {
        success: true,
        sessions,
        total: sessions.length
      };
    } catch (error) {
      console.error('Call sessions fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getVoiceAnalytics(organizationId, startDate, endDate) {
    try {
      const sessions = Array.from(this.callSessions.values())
        .filter(session => 
          session.organizationId === organizationId &&
          session.startTime >= new Date(startDate) &&
          session.startTime <= new Date(endDate)
        );

      const analytics = {
        totalCalls: sessions.length,
        completedCalls: sessions.filter(s => s.status === 'completed').length,
        failedCalls: sessions.filter(s => s.status === 'failed').length,
        totalDuration: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        totalCost: sessions.reduce((sum, s) => sum + (s.cost || 0), 0),
        averageDuration: sessions.length > 0 
          ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length 
          : 0,
        averageCost: sessions.length > 0 
          ? sessions.reduce((sum, s) => sum + (s.cost || 0), 0) / sessions.length 
          : 0,
        sentimentBreakdown: this.calculateSentimentBreakdown(sessions),
        intentBreakdown: this.calculateIntentBreakdown(sessions),
        languageBreakdown: this.calculateLanguageBreakdown(sessions),
        hourlyBreakdown: this.calculateHourlyBreakdown(sessions),
        dailyBreakdown: this.calculateDailyBreakdown(sessions)
      };

      return {
        success: true,
        analytics
      };
    } catch (error) {
      console.error('Voice analytics failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateSentimentBreakdown(sessions) {
    const sentimentCounts = {};
    sessions.forEach(session => {
      if (session.sentiment) {
        sentimentCounts[session.sentiment] = (sentimentCounts[session.sentiment] || 0) + 1;
      }
    });
    return sentimentCounts;
  }

  calculateIntentBreakdown(sessions) {
    const intentCounts = {};
    sessions.forEach(session => {
      if (session.intent) {
        intentCounts[session.intent] = (intentCounts[session.intent] || 0) + 1;
      }
    });
    return intentCounts;
  }

  calculateLanguageBreakdown(sessions) {
    const languageCounts = {};
    sessions.forEach(session => {
      languageCounts[session.language] = (languageCounts[session.language] || 0) + 1;
    });
    return languageCounts;
  }

  calculateHourlyBreakdown(sessions) {
    const hourlyCounts = {};
    sessions.forEach(session => {
      const hour = session.startTime.getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    });
    return hourlyCounts;
  }

  calculateDailyBreakdown(sessions) {
    const dailyCounts = {};
    sessions.forEach(session => {
      const date = session.startTime.toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
    return dailyCounts;
  }

  async deleteCallSession(sessionId) {
    try {
      const session = this.callSessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Call session not found'
        };
      }

      // Delete audio file from S3
      if (session.audioData) {
        const key = session.audioData.split('/').slice(-2).join('/');
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: key
        }).promise();
      }

      // Remove from memory
      this.callSessions.delete(sessionId);

      return {
        success: true,
        message: 'Call session deleted successfully'
      };
    } catch (error) {
      console.error('Call session deletion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAudioUrl(sessionId) {
    try {
      const session = this.callSessions.get(sessionId);
      if (!session || !session.audioData) {
        return {
          success: false,
          error: 'Audio not found'
        };
      }

      // Generate presigned URL for private S3 object
      const key = session.audioData.split('/').slice(-2).join('/');
      const presignedUrl = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: 3600 // 1 hour
      });

      return {
        success: true,
        audioUrl: presignedUrl,
        expiresIn: 3600
      };
    } catch (error) {
      console.error('Audio URL generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SarvamVoiceService;
