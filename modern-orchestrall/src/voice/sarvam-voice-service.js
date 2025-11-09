const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

class SarvamVoiceService {
  constructor(prisma) {
    this.prisma = prisma;
    this.isInitialized = false;
    this.supportedLanguages = ['hi', 'te', 'ta', 'en']; // Hindi, Telugu, Tamil, English
    this.voiceCommands = new Map();
    this.callSessions = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize voice command templates
      await this.initializeVoiceCommands();
      
      // Initialize call analytics
      await this.initializeCallAnalytics();
      
      this.isInitialized = true;
      console.log('✅ Sarvam Voice Service initialized');
    } catch (error) {
      console.error('Failed to initialize Sarvam Voice Service:', error);
      throw error;
    }
  }

  async initializeVoiceCommands() {
    const commandTemplates = [
      // Crop Management Commands
      {
        id: 'crop_status',
        name: 'Check Crop Status',
        patterns: [
          { language: 'hi', pattern: 'मेरी फसल का हाल कैसा है', response: 'crop_status_response' },
          { language: 'te', pattern: 'నా పంటల స్థితి ఎలా ఉంది', response: 'crop_status_response' },
          { language: 'ta', pattern: 'என் பயிரின் நிலை எப்படி', response: 'crop_status_response' },
          { language: 'en', pattern: 'how is my crop doing', response: 'crop_status_response' }
        ],
        action: 'getCropStatus',
        requiredData: ['farmerId']
      },
      {
        id: 'weather_info',
        name: 'Get Weather Information',
        patterns: [
          { language: 'hi', pattern: 'आज का मौसम कैसा है', response: 'weather_info_response' },
          { language: 'te', pattern: 'ఈరోజు వాతావరణం ఎలా ఉంది', response: 'weather_info_response' },
          { language: 'ta', pattern: 'இன்றைய வானிலை எப்படி', response: 'weather_info_response' },
          { language: 'en', pattern: 'what is the weather today', response: 'weather_info_response' }
        ],
        action: 'getWeatherInfo',
        requiredData: ['farmerId', 'location']
      },
      {
        id: 'market_price',
        name: 'Check Market Prices',
        patterns: [
          { language: 'hi', pattern: 'आज के बाजार भाव क्या हैं', response: 'market_price_response' },
          { language: 'te', pattern: 'ఈరోజు మార్కెట్ ధరలు ఎలా ఉన్నాయి', response: 'market_price_response' },
          { language: 'ta', pattern: 'இன்றைய சந்தை விலைகள் என்ன', response: 'market_price_response' },
          { language: 'en', pattern: 'what are today market prices', response: 'market_price_response' }
        ],
        action: 'getMarketPrices',
        requiredData: ['farmerId', 'cropType']
      },
      {
        id: 'loan_status',
        name: 'Check Loan Status',
        patterns: [
          { language: 'hi', pattern: 'मेरे लोन का स्टेटस क्या है', response: 'loan_status_response' },
          { language: 'te', pattern: 'నా లోన్ స్థితి ఎలా ఉంది', response: 'loan_status_response' },
          { language: 'ta', pattern: 'என் கடன் நிலை என்ன', response: 'loan_status_response' },
          { language: 'en', pattern: 'what is my loan status', response: 'loan_status_response' }
        ],
        action: 'getLoanStatus',
        requiredData: ['farmerId']
      },
      {
        id: 'insurance_claim',
        name: 'File Insurance Claim',
        patterns: [
          { language: 'hi', pattern: 'बीमा क्लेम कैसे करें', response: 'insurance_claim_response' },
          { language: 'te', pattern: 'ఇన్సూరెన్స్ క్లెయిమ్ ఎలా చేయాలి', response: 'insurance_claim_response' },
          { language: 'ta', pattern: 'காப்பீட்டு கோரிக்கை எப்படி செய்வது', response: 'insurance_claim_response' },
          { language: 'en', pattern: 'how to file insurance claim', response: 'insurance_claim_response' }
        ],
        action: 'fileInsuranceClaim',
        requiredData: ['farmerId']
      },
      {
        id: 'help',
        name: 'Get Help',
        patterns: [
          { language: 'hi', pattern: 'मदद चाहिए', response: 'help_response' },
          { language: 'te', pattern: 'సహాయం కావాలి', response: 'help_response' },
          { language: 'ta', pattern: 'உதவி வேண்டும்', response: 'help_response' },
          { language: 'en', pattern: 'I need help', response: 'help_response' }
        ],
        action: 'getHelp',
        requiredData: []
      }
    ];

    for (const template of commandTemplates) {
      this.voiceCommands.set(template.id, template);
    }

    console.log(`✅ Initialized ${commandTemplates.length} voice command templates`);
  }

  async initializeCallAnalytics() {
    // Initialize call analytics tracking
    this.callMetrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageCallDuration: 0,
      languageDistribution: {},
      commandUsage: {},
      farmerEngagement: {}
    };

    console.log('✅ Call analytics initialized');
  }

  async processVoiceInput(audioData, farmerId, language = 'hi') {
    try {
      const sessionId = this.generateSessionId();
      const startTime = Date.now();

      // Start call session tracking
      const callSession = {
        sessionId,
        farmerId,
        language,
        startTime: new Date(),
        audioData: audioData.length,
        status: 'processing'
      };

      this.callSessions.set(sessionId, callSession);

      // Simulate Sarvam AI processing (in real implementation, this would call Sarvam API)
      const transcription = await this.transcribeAudio(audioData, language);
      const command = await this.identifyCommand(transcription, language);
      const response = await this.executeCommand(command, farmerId, language);

      // Update call session
      callSession.endTime = new Date();
      callSession.duration = Date.now() - startTime;
      callSession.transcription = transcription;
      callSession.command = command.id;
      callSession.response = response;
      callSession.status = 'completed';

      // Update analytics
      await this.updateCallAnalytics(callSession);

      // Store call record in database
      await this.storeCallRecord(callSession);

      return {
        sessionId,
        transcription,
        command: command.id,
        response: response.text,
        audioResponse: response.audio,
        language,
        duration: callSession.duration
      };

    } catch (error) {
      console.error('Failed to process voice input:', error);
      
      // Update failed call analytics
      this.callMetrics.failedCalls++;
      
      throw error;
    }
  }

  async transcribeAudio(audioData, language) {
    // Simulate Sarvam AI transcription
    // In real implementation, this would call Sarvam API
    const mockTranscriptions = {
      'hi': 'मेरी फसल का हाल कैसा है',
      'te': 'నా పంటల స్థితి ఎలా ఉంది',
      'ta': 'என் பயிரின் நிலை எப்படி',
      'en': 'how is my crop doing'
    };

    return mockTranscriptions[language] || 'Unable to transcribe';
  }

  async identifyCommand(transcription, language) {
    // Find matching command based on transcription and language
    for (const [commandId, command] of this.voiceCommands) {
      const pattern = command.patterns.find(p => p.language === language);
      if (pattern && this.matchPattern(transcription, pattern.pattern)) {
        return command;
      }
    }

    // Default to help command if no match found
    return this.voiceCommands.get('help');
  }

  matchPattern(transcription, pattern) {
    // Simple pattern matching (in real implementation, use NLP)
    const transcriptionLower = transcription.toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    // Check if pattern words are present in transcription
    const patternWords = patternLower.split(' ');
    const transcriptionWords = transcriptionLower.split(' ');
    
    return patternWords.some(word => 
      transcriptionWords.some(tWord => tWord.includes(word) || word.includes(tWord))
    );
  }

  async executeCommand(command, farmerId, language) {
    try {
      let result;

      switch (command.action) {
        case 'getCropStatus':
          result = await this.getCropStatus(farmerId, language);
          break;
        case 'getWeatherInfo':
          result = await this.getWeatherInfo(farmerId, language);
          break;
        case 'getMarketPrices':
          result = await this.getMarketPrices(farmerId, language);
          break;
        case 'getLoanStatus':
          result = await this.getLoanStatus(farmerId, language);
          break;
        case 'fileInsuranceClaim':
          result = await this.fileInsuranceClaim(farmerId, language);
          break;
        case 'getHelp':
          result = await this.getHelp(language);
          break;
        default:
          result = await this.getHelp(language);
      }

      return {
        text: result.text,
        audio: await this.textToSpeech(result.text, language),
        data: result.data
      };

    } catch (error) {
      console.error(`Failed to execute command ${command.action}:`, error);
      return {
        text: this.getErrorMessage(language),
        audio: await this.textToSpeech(this.getErrorMessage(language), language),
        data: null
      };
    }
  }

  async getCropStatus(farmerId, language) {
    try {
      const crops = await this.prisma.crop.findMany({
        where: { farmerId },
        include: {
          cropHealthRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (crops.length === 0) {
        return {
          text: this.getLocalizedText('no_crops_found', language),
          data: { crops: [] }
        };
      }

      const cropStatus = crops.map(crop => ({
        name: crop.name,
        status: crop.status,
        healthScore: crop.cropHealthRecords[0]?.healthScore || 0,
        plantingDate: crop.plantingDate
      }));

      const responseText = this.formatCropStatusResponse(cropStatus, language);
      
      return {
        text: responseText,
        data: { crops: cropStatus }
      };

    } catch (error) {
      console.error('Failed to get crop status:', error);
      throw error;
    }
  }

  async getWeatherInfo(farmerId, language) {
    try {
      const farmer = await this.prisma.farmerProfile.findUnique({
        where: { id: farmerId }
      });

      if (!farmer) {
        return {
          text: this.getLocalizedText('farmer_not_found', language),
          data: null
        };
      }

      // Simulate weather data (in real implementation, call weather API)
      const weatherData = {
        temperature: 28,
        humidity: 65,
        condition: 'partly_cloudy',
        forecast: 'light_rain_tomorrow'
      };

      const responseText = this.formatWeatherResponse(weatherData, language);
      
      return {
        text: responseText,
        data: weatherData
      };

    } catch (error) {
      console.error('Failed to get weather info:', error);
      throw error;
    }
  }

  async getMarketPrices(farmerId, language) {
    try {
      const farmer = await this.prisma.farmerProfile.findUnique({
        where: { id: farmerId },
        include: { crops: true }
      });

      if (!farmer) {
        return {
          text: this.getLocalizedText('farmer_not_found', language),
          data: null
        };
      }

      const cropTypes = farmer.crops.map(crop => crop.name);
      
      // Simulate market prices (in real implementation, call market API)
      const marketPrices = cropTypes.map(cropType => ({
        cropType,
        price: Math.floor(Math.random() * 1000) + 500,
        unit: 'quintal',
        market: 'local_market'
      }));

      const responseText = this.formatMarketPriceResponse(marketPrices, language);
      
      return {
        text: responseText,
        data: { prices: marketPrices }
      };

    } catch (error) {
      console.error('Failed to get market prices:', error);
      throw error;
    }
  }

  async getLoanStatus(farmerId, language) {
    try {
      const loans = await this.prisma.loanApplication.findMany({
        where: { farmerId },
        orderBy: { createdAt: 'desc' }
      });

      if (loans.length === 0) {
        return {
          text: this.getLocalizedText('no_loans_found', language),
          data: { loans: [] }
        };
      }

      const latestLoan = loans[0];
      const responseText = this.formatLoanStatusResponse(latestLoan, language);
      
      return {
        text: responseText,
        data: { loan: latestLoan }
      };

    } catch (error) {
      console.error('Failed to get loan status:', error);
      throw error;
    }
  }

  async fileInsuranceClaim(farmerId, language) {
    try {
      const policies = await this.prisma.insurancePolicy.findMany({
        where: { farmerId },
        orderBy: { createdAt: 'desc' }
      });

      if (policies.length === 0) {
        return {
          text: this.getLocalizedText('no_insurance_policies', language),
          data: { policies: [] }
        };
      }

      const responseText = this.formatInsuranceClaimResponse(policies, language);
      
      return {
        text: responseText,
        data: { policies }
      };

    } catch (error) {
      console.error('Failed to get insurance info:', error);
      throw error;
    }
  }

  async getHelp(language) {
    const availableCommands = Array.from(this.voiceCommands.values())
      .map(cmd => cmd.name)
      .join(', ');

    return {
      text: this.getLocalizedText('help_available_commands', language).replace('{commands}', availableCommands),
      data: { commands: Array.from(this.voiceCommands.keys()) }
    };
  }

  async textToSpeech(text, language) {
    // Simulate Sarvam AI text-to-speech
    // In real implementation, this would call Sarvam TTS API
    return {
      audioUrl: `https://api.sarvam.ai/tts/${language}/${encodeURIComponent(text)}`,
      duration: Math.ceil(text.length / 10) // Rough estimate
    };
  }

  async updateCallAnalytics(callSession) {
    this.callMetrics.totalCalls++;
    this.callMetrics.successfulCalls++;
    
    // Update language distribution
    this.callMetrics.languageDistribution[callSession.language] = 
      (this.callMetrics.languageDistribution[callSession.language] || 0) + 1;
    
    // Update command usage
    this.callMetrics.commandUsage[callSession.command] = 
      (this.callMetrics.commandUsage[callSession.command] || 0) + 1;
    
    // Update farmer engagement
    this.callMetrics.farmerEngagement[callSession.farmerId] = 
      (this.callMetrics.farmerEngagement[callSession.farmerId] || 0) + 1;
    
    // Update average call duration
    const totalDuration = this.callMetrics.averageCallDuration * (this.callMetrics.totalCalls - 1) + callSession.duration;
    this.callMetrics.averageCallDuration = totalDuration / this.callMetrics.totalCalls;
  }

  async storeCallRecord(callSession) {
    try {
      await this.prisma.voiceCall.create({
        data: {
          farmerId: callSession.farmerId,
          sessionId: callSession.sessionId,
          language: callSession.language,
          transcription: callSession.transcription,
          command: callSession.command,
          response: callSession.response.text,
          duration: callSession.duration,
          audioDataSize: callSession.audioData,
          status: callSession.status,
          metadata: {
            startTime: callSession.startTime,
            endTime: callSession.endTime,
            responseData: callSession.response.data
          }
        }
      });
    } catch (error) {
      console.error('Failed to store call record:', error);
    }
  }

  getLocalizedText(key, language) {
    const translations = {
      'no_crops_found': {
        'hi': 'आपकी कोई फसल नहीं मिली',
        'te': 'మీ పంటలు కనబడలేదు',
        'ta': 'உங்கள் பயிர்கள் கிடைக்கவில்லை',
        'en': 'No crops found for you'
      },
      'farmer_not_found': {
        'hi': 'किसान की जानकारी नहीं मिली',
        'te': 'రైతు సమాచారం కనబడలేదు',
        'ta': 'விவசாயி தகவல் கிடைக்கவில்லை',
        'en': 'Farmer information not found'
      },
      'no_loans_found': {
        'hi': 'आपका कोई लोन नहीं मिला',
        'te': 'మీ లోన్ కనబడలేదు',
        'ta': 'உங்கள் கடன் கிடைக்கவில்லை',
        'en': 'No loans found for you'
      },
      'no_insurance_policies': {
        'hi': 'आपकी कोई बीमा पॉलिसी नहीं मिली',
        'te': 'మీ బీమా పాలసీ కనబడలేదు',
        'ta': 'உங்கள் காப்பீட்டு கொள்கை கிடைக்கவில்லை',
        'en': 'No insurance policies found for you'
      },
      'help_available_commands': {
        'hi': 'उपलब्ध कमांड: {commands}',
        'te': 'అందుబాటులో ఉన్న ఆదేశాలు: {commands}',
        'ta': 'கிடைக்கும் கட்டளைகள்: {commands}',
        'en': 'Available commands: {commands}'
      }
    };

    return translations[key]?.[language] || translations[key]?.['en'] || key;
  }

  formatCropStatusResponse(crops, language) {
    if (language === 'hi') {
      return `आपकी ${crops.length} फसलें हैं। सबसे अच्छी फसल ${crops[0]?.name} है जिसकी सेहत ${crops[0]?.healthScore}% है।`;
    } else if (language === 'te') {
      return `మీకు ${crops.length} పంటలు ఉన్నాయి. ఉత్తమ పంట ${crops[0]?.name} ఇది ${crops[0]?.healthScore}% ఆరోగ్య స్కోర్ కలిగి ఉంది.`;
    } else if (language === 'ta') {
      return `உங்களுக்கு ${crops.length} பயிர்கள் உள்ளன. சிறந்த பயிர் ${crops[0]?.name} இது ${crops[0]?.healthScore}% ஆரோக்கிய மதிப்பெண் கொண்டது.`;
    } else {
      return `You have ${crops.length} crops. Your best crop is ${crops[0]?.name} with ${crops[0]?.healthScore}% health score.`;
    }
  }

  formatWeatherResponse(weather, language) {
    if (language === 'hi') {
      return `आज का तापमान ${weather.temperature} डिग्री है और आर्द्रता ${weather.humidity}% है। मौसम आंशिक रूप से बादल है।`;
    } else if (language === 'te') {
      return `ఈరోజు ఉష్ణోగ్రత ${weather.temperature} డిగ్రీలు మరియు తేమ ${weather.humidity}% ఉంది. వాతావరణం పాక్షికంగా మేఘావృతం.`;
    } else if (language === 'ta') {
      return `இன்றைய வெப்பநிலை ${weather.temperature} டிகிரி மற்றும் ஈரப்பதம் ${weather.humidity}% உள்ளது. வானிலை பகுதியாக மேகமூட்டமாக உள்ளது.`;
    } else {
      return `Today's temperature is ${weather.temperature} degrees and humidity is ${weather.humidity}%. Weather is partly cloudy.`;
    }
  }

  formatMarketPriceResponse(prices, language) {
    if (prices.length === 0) {
      return this.getLocalizedText('no_market_data', language);
    }

    const price = prices[0];
    if (language === 'hi') {
      return `${price.cropType} का आज का भाव ${price.price} रुपये प्रति क्विंटल है।`;
    } else if (language === 'te') {
      return `${price.cropType} ఈరోజు ధర ${price.price} రూపాయలు క్వింటాల్ కు ఉంది.`;
    } else if (language === 'ta') {
      return `${price.cropType} இன்றைய விலை ${price.price} ரூபாய் குவிண்டாலுக்கு உள்ளது.`;
    } else {
      return `Today's price for ${price.cropType} is ${price.price} rupees per quintal.`;
    }
  }

  formatLoanStatusResponse(loan, language) {
    if (language === 'hi') {
      return `आपके लोन की राशि ${loan.amount} रुपये है और स्थिति ${loan.status} है।`;
    } else if (language === 'te') {
      return `మీ లోన్ మొత్తం ${loan.amount} రూపాయలు మరియు స్థితి ${loan.status} ఉంది.`;
    } else if (language === 'ta') {
      return `உங்கள் கடன் தொகை ${loan.amount} ரூபாய் மற்றும் நிலை ${loan.status} உள்ளது.`;
    } else {
      return `Your loan amount is ${loan.amount} rupees and status is ${loan.status}.`;
    }
  }

  formatInsuranceClaimResponse(policies, language) {
    if (language === 'hi') {
      return `आपकी ${policies.length} बीमा पॉलिसी हैं। क्लेम के लिए कॉल करें।`;
    } else if (language === 'te') {
      return `మీకు ${policies.length} బీమా పాలసీలు ఉన్నాయి. క్లెయిమ్ కోసం కాల్ చేయండి.`;
    } else if (language === 'ta') {
      return `உங்களுக்கு ${policies.length} காப்பீட்டு கொள்கைகள் உள்ளன. கோரிக்கைக்காக அழைக்கவும்.`;
    } else {
      return `You have ${policies.length} insurance policies. Call for claim assistance.`;
    }
  }

  getErrorMessage(language) {
    const errorMessages = {
      'hi': 'क्षमा करें, कुछ त्रुटि हुई है। कृपया बाद में कोशिश करें।',
      'te': 'క్షమించండి, కొంత లోపం జరిగింది. దయచేసి తర్వాత ప్రయత్నించండి.',
      'ta': 'மன்னிக்கவும், சில பிழை ஏற்பட்டது. தயவுசெய்து பின்னர் முயற்சிக்கவும்.',
      'en': 'Sorry, there was an error. Please try again later.'
    };

    return errorMessages[language] || errorMessages['en'];
  }

  generateSessionId() {
    return 'voice_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  async getCallAnalytics(organizationId, options = {}) {
    try {
      const dateFrom = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = options.dateTo ? new Date(options.dateTo) : new Date();

      const calls = await this.prisma.voiceCall.findMany({
        where: {
          farmer: {
            organizationId
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        include: {
          farmer: {
            select: {
              id: true,
              name: true,
              region: true
            }
          }
        }
      });

      // Calculate analytics
      const analytics = {
        totalCalls: calls.length,
        successfulCalls: calls.filter(c => c.status === 'completed').length,
        failedCalls: calls.filter(c => c.status === 'failed').length,
        averageDuration: calls.length > 0 ? calls.reduce((sum, c) => sum + c.duration, 0) / calls.length : 0,
        languageDistribution: {},
        commandUsage: {},
        farmerEngagement: {},
        regionalDistribution: {},
        dailyCalls: {},
        topFarmers: []
      };

      // Process analytics
      calls.forEach(call => {
        // Language distribution
        analytics.languageDistribution[call.language] = 
          (analytics.languageDistribution[call.language] || 0) + 1;
        
        // Command usage
        analytics.commandUsage[call.command] = 
          (analytics.commandUsage[call.command] || 0) + 1;
        
        // Farmer engagement
        analytics.farmerEngagement[call.farmerId] = 
          (analytics.farmerEngagement[call.farmerId] || 0) + 1;
        
        // Regional distribution
        const region = call.farmer.region;
        analytics.regionalDistribution[region] = 
          (analytics.regionalDistribution[region] || 0) + 1;
        
        // Daily calls
        const date = call.createdAt.toISOString().split('T')[0];
        analytics.dailyCalls[date] = (analytics.dailyCalls[date] || 0) + 1;
      });

      // Top farmers by engagement
      analytics.topFarmers = Object.entries(analytics.farmerEngagement)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([farmerId, count]) => ({
          farmerId,
          callCount: count,
          farmerName: calls.find(c => c.farmerId === farmerId)?.farmer.name || 'Unknown'
        }));

      return {
        overview: {
          totalCalls: analytics.totalCalls,
          successRate: analytics.totalCalls > 0 ? ((analytics.successfulCalls / analytics.totalCalls) * 100).toFixed(2) : 0,
          averageDuration: Math.round(analytics.averageDuration),
          uniqueFarmers: Object.keys(analytics.farmerEngagement).length
        },
        distribution: {
          byLanguage: Object.entries(analytics.languageDistribution).map(([lang, count]) => ({
            language: lang,
            count,
            percentage: analytics.totalCalls > 0 ? ((count / analytics.totalCalls) * 100).toFixed(2) : 0
          })),
          byCommand: Object.entries(analytics.commandUsage).map(([cmd, count]) => ({
            command: cmd,
            count,
            percentage: analytics.totalCalls > 0 ? ((count / analytics.totalCalls) * 100).toFixed(2) : 0
          })),
          byRegion: Object.entries(analytics.regionalDistribution).map(([region, count]) => ({
            region,
            count,
            percentage: analytics.totalCalls > 0 ? ((count / analytics.totalCalls) * 100).toFixed(2) : 0
          }))
        },
        engagement: {
          topFarmers: analytics.topFarmers,
          dailyTrends: Object.entries(analytics.dailyCalls).map(([date, count]) => ({
            date,
            calls: count
          }))
        },
        period: {
          from: dateFrom,
          to: dateTo
        }
      };

    } catch (error) {
      console.error('Failed to get call analytics:', error);
      throw error;
    }
  }

  async getSupportedLanguages() {
    return this.supportedLanguages.map(lang => ({
      code: lang,
      name: this.getLanguageName(lang),
      nativeName: this.getNativeLanguageName(lang)
    }));
  }

  getLanguageName(code) {
    const names = {
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil',
      'en': 'English'
    };
    return names[code] || code;
  }

  getNativeLanguageName(code) {
    const nativeNames = {
      'hi': 'हिन्दी',
      'te': 'తెలుగు',
      'ta': 'தமிழ்',
      'en': 'English'
    };
    return nativeNames[code] || code;
  }
}

module.exports = SarvamVoiceService;
