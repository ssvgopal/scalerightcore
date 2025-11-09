const axios = require('axios');

class CropMonitoringService {
  constructor(prisma) {
    this.prisma = prisma;
    this.weatherApiKey = process.env.OPENWEATHER_API_KEY;
    this.weatherBaseUrl = 'https://api.openweathermap.org/data/2.5';
    this.cropHealthThresholds = new Map();
    this.yieldPredictionModels = new Map();
  }

  async initializeCropHealthThresholds() {
    // Initialize crop-specific health thresholds
    const cropThresholds = {
      'rice': {
        temperature: { min: 20, max: 35, optimal: 28 },
        humidity: { min: 60, max: 90, optimal: 75 },
        rainfall: { min: 1000, max: 2500, optimal: 1500 },
        soilPh: { min: 6.0, max: 7.5, optimal: 6.5 },
        pestRisk: { low: 0.2, medium: 0.5, high: 0.8 }
      },
      'wheat': {
        temperature: { min: 15, max: 25, optimal: 20 },
        humidity: { min: 40, max: 70, optimal: 55 },
        rainfall: { min: 500, max: 1000, optimal: 750 },
        soilPh: { min: 6.0, max: 7.0, optimal: 6.5 },
        pestRisk: { low: 0.2, medium: 0.5, high: 0.8 }
      },
      'cotton': {
        temperature: { min: 20, max: 30, optimal: 25 },
        humidity: { min: 50, max: 80, optimal: 65 },
        rainfall: { min: 600, max: 1200, optimal: 900 },
        soilPh: { min: 5.5, max: 7.0, optimal: 6.2 },
        pestRisk: { low: 0.3, medium: 0.6, high: 0.9 }
      },
      'sugarcane': {
        temperature: { min: 25, max: 35, optimal: 30 },
        humidity: { min: 60, max: 85, optimal: 72 },
        rainfall: { min: 1200, max: 2000, optimal: 1600 },
        soilPh: { min: 6.0, max: 7.5, optimal: 6.8 },
        pestRisk: { low: 0.2, medium: 0.5, high: 0.8 }
      }
    };

    Object.entries(cropThresholds).forEach(([crop, thresholds]) => {
      this.cropHealthThresholds.set(crop, thresholds);
    });

    return {
      success: true,
      message: 'Crop health thresholds initialized',
      crops: Object.keys(cropThresholds)
    };
  }

  async analyzeCropHealth(farmerId, cropData) {
    try {
      const {
        cropType,
        plantingDate,
        location,
        currentStage,
        soilData = {},
        weatherData = {}
      } = cropData;

      // Get crop-specific thresholds
      const thresholds = this.cropHealthThresholds.get(cropType.toLowerCase());
      if (!thresholds) {
        throw new Error(`Unsupported crop type: ${cropType}`);
      }

      // Analyze weather conditions
      const weatherAnalysis = await this.analyzeWeatherConditions(weatherData, thresholds);
      
      // Analyze soil conditions
      const soilAnalysis = await this.analyzeSoilConditions(soilData, thresholds);
      
      // Calculate crop growth stage
      const growthStage = await this.calculateGrowthStage(plantingDate, cropType, currentStage);
      
      // Generate health score
      const healthScore = this.calculateHealthScore(weatherAnalysis, soilAnalysis, growthStage);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        cropType,
        healthScore,
        weatherAnalysis,
        soilAnalysis,
        growthStage
      );

      // Create crop health record
      const healthRecord = await this.prisma.cropHealthRecord.create({
        data: {
          farmerId,
          cropType,
          location,
          healthScore,
          weatherAnalysis,
          soilAnalysis,
          growthStage,
          recommendations,
          analyzedAt: new Date()
        }
      });

      return {
        success: true,
        healthRecord: {
          id: healthRecord.id,
          cropType,
          healthScore,
          status: this.getHealthStatus(healthScore),
          recommendations,
          analyzedAt: healthRecord.analyzedAt
        }
      };
    } catch (error) {
      console.error('Crop health analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeWeatherConditions(weatherData, thresholds) {
    const analysis = {
      temperature: { status: 'optimal', score: 100 },
      humidity: { status: 'optimal', score: 100 },
      rainfall: { status: 'optimal', score: 100 },
      overallScore: 100
    };

    // Analyze temperature
    if (weatherData.temperature) {
      const temp = weatherData.temperature;
      if (temp < thresholds.temperature.min || temp > thresholds.temperature.max) {
        analysis.temperature.status = 'critical';
        analysis.temperature.score = 20;
      } else if (temp < thresholds.temperature.min + 2 || temp > thresholds.temperature.max - 2) {
        analysis.temperature.status = 'warning';
        analysis.temperature.score = 60;
      }
    }

    // Analyze humidity
    if (weatherData.humidity) {
      const humidity = weatherData.humidity;
      if (humidity < thresholds.humidity.min || humidity > thresholds.humidity.max) {
        analysis.humidity.status = 'critical';
        analysis.humidity.score = 20;
      } else if (humidity < thresholds.humidity.min + 5 || humidity > thresholds.humidity.max - 5) {
        analysis.humidity.status = 'warning';
        analysis.humidity.score = 60;
      }
    }

    // Calculate overall score
    analysis.overallScore = Math.round(
      (analysis.temperature.score + analysis.humidity.score + analysis.rainfall.score) / 3
    );

    return analysis;
  }

  async analyzeSoilConditions(soilData, thresholds) {
    const analysis = {
      ph: { status: 'optimal', score: 100 },
      moisture: { status: 'optimal', score: 100 },
      nutrients: { status: 'optimal', score: 100 },
      overallScore: 100
    };

    // Analyze soil pH
    if (soilData.ph) {
      const ph = soilData.ph;
      if (ph < thresholds.soilPh.min || ph > thresholds.soilPh.max) {
        analysis.ph.status = 'critical';
        analysis.ph.score = 20;
      } else if (ph < thresholds.soilPh.min + 0.3 || ph > thresholds.soilPh.max - 0.3) {
        analysis.ph.status = 'warning';
        analysis.ph.score = 60;
      }
    }

    // Analyze soil moisture
    if (soilData.moisture) {
      const moisture = soilData.moisture;
      if (moisture < 30 || moisture > 80) {
        analysis.moisture.status = 'critical';
        analysis.moisture.score = 20;
      } else if (moisture < 40 || moisture > 70) {
        analysis.moisture.status = 'warning';
        analysis.moisture.score = 60;
      }
    }

    // Calculate overall score
    analysis.overallScore = Math.round(
      (analysis.ph.score + analysis.moisture.score + analysis.nutrients.score) / 3
    );

    return analysis;
  }

  async calculateGrowthStage(plantingDate, cropType, currentStage) {
    const planting = new Date(plantingDate);
    const now = new Date();
    const daysSincePlanting = Math.floor((now - planting) / (1000 * 60 * 60 * 24));

    // Crop-specific growth stages (in days)
    const growthStages = {
      'rice': { germination: 7, vegetative: 30, reproductive: 60, maturity: 120 },
      'wheat': { germination: 5, vegetative: 25, reproductive: 50, maturity: 100 },
      'cotton': { germination: 10, vegetative: 40, reproductive: 80, maturity: 150 },
      'sugarcane': { germination: 15, vegetative: 60, reproductive: 120, maturity: 300 }
    };

    const stages = growthStages[cropType.toLowerCase()] || growthStages['rice'];
    
    let stage = 'germination';
    if (daysSincePlanting >= stages.maturity) {
      stage = 'maturity';
    } else if (daysSincePlanting >= stages.reproductive) {
      stage = 'reproductive';
    } else if (daysSincePlanting >= stages.vegetative) {
      stage = 'vegetative';
    }

    return {
      currentStage: stage,
      daysSincePlanting,
      nextStage: this.getNextStage(stage),
      daysToNextStage: this.getDaysToNextStage(stage, stages, daysSincePlanting)
    };
  }

  getNextStage(currentStage) {
    const stageOrder = ['germination', 'vegetative', 'reproductive', 'maturity'];
    const currentIndex = stageOrder.indexOf(currentStage);
    return currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
  }

  getDaysToNextStage(currentStage, stages, daysSincePlanting) {
    const nextStage = this.getNextStage(currentStage);
    if (!nextStage) return 0;
    
    const nextStageDays = stages[nextStage];
    return Math.max(0, nextStageDays - daysSincePlanting);
  }

  calculateHealthScore(weatherAnalysis, soilAnalysis, growthStage) {
    const weatherScore = weatherAnalysis.overallScore;
    const soilScore = soilAnalysis.overallScore;
    
    // Growth stage bonus/penalty
    let growthBonus = 0;
    if (growthStage.currentStage === 'vegetative' || growthStage.currentStage === 'reproductive') {
      growthBonus = 10; // Peak growth stages
    } else if (growthStage.currentStage === 'maturity') {
      growthBonus = 5; // Maturity stage
    }

    const finalScore = Math.min(100, Math.round((weatherScore + soilScore) / 2) + growthBonus);
    return finalScore;
  }

  async generateRecommendations(cropType, healthScore, weatherAnalysis, soilAnalysis, growthStage) {
    const recommendations = [];

    // Weather-based recommendations
    if (weatherAnalysis.temperature.status === 'critical') {
      recommendations.push({
        type: 'temperature',
        priority: 'high',
        message: `Temperature is outside optimal range for ${cropType}. Consider shade or irrigation adjustments.`,
        action: 'Adjust irrigation timing and consider protective measures'
      });
    }

    if (weatherAnalysis.humidity.status === 'critical') {
      recommendations.push({
        type: 'humidity',
        priority: 'high',
        message: `Humidity levels are not optimal for ${cropType}. Monitor for disease risk.`,
        action: 'Increase ventilation and monitor for fungal diseases'
      });
    }

    // Soil-based recommendations
    if (soilAnalysis.ph.status === 'critical') {
      recommendations.push({
        type: 'soil',
        priority: 'high',
        message: `Soil pH is not optimal for ${cropType}. Consider soil amendments.`,
        action: 'Apply lime or sulfur to adjust soil pH'
      });
    }

    if (soilAnalysis.moisture.status === 'critical') {
      recommendations.push({
        type: 'irrigation',
        priority: 'high',
        message: `Soil moisture is not optimal for ${cropType}.`,
        action: soilAnalysis.moisture.score < 50 ? 'Increase irrigation' : 'Reduce irrigation'
      });
    }

    // Growth stage recommendations
    if (growthStage.currentStage === 'vegetative') {
      recommendations.push({
        type: 'growth',
        priority: 'medium',
        message: `${cropType} is in vegetative stage. Focus on nutrient management.`,
        action: 'Apply nitrogen-rich fertilizers for optimal growth'
      });
    } else if (growthStage.currentStage === 'reproductive') {
      recommendations.push({
        type: 'growth',
        priority: 'medium',
        message: `${cropType} is in reproductive stage. Monitor for pests and diseases.`,
        action: 'Apply phosphorus and potassium fertilizers, monitor for pests'
      });
    }

    // General health recommendations
    if (healthScore < 50) {
      recommendations.push({
        type: 'general',
        priority: 'high',
        message: `Overall crop health is poor. Immediate attention required.`,
        action: 'Consult agricultural expert and review all growing conditions'
      });
    } else if (healthScore < 70) {
      recommendations.push({
        type: 'general',
        priority: 'medium',
        message: `Crop health needs improvement. Monitor closely.`,
        action: 'Review and adjust growing practices'
      });
    }

    return recommendations;
  }

  getHealthStatus(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  async predictYield(farmerId, cropData) {
    try {
      const {
        cropType,
        plantingDate,
        location,
        area,
        soilData = {},
        weatherData = {}
      } = cropData;

      // Get historical yield data for the region and crop
      const historicalData = await this.getHistoricalYieldData(cropType, location);
      
      // Calculate yield prediction based on multiple factors
      const baseYield = historicalData.averageYield || 0;
      const weatherFactor = this.calculateWeatherYieldFactor(weatherData);
      const soilFactor = this.calculateSoilYieldFactor(soilData);
      const managementFactor = 0.8; // Default management factor

      const predictedYield = Math.round(
        baseYield * weatherFactor * soilFactor * managementFactor
      );

      // Calculate confidence score
      const confidenceScore = this.calculatePredictionConfidence(
        historicalData.dataPoints,
        weatherFactor,
        soilFactor
      );

      // Create yield prediction record
      const prediction = await this.prisma.yieldPrediction.create({
        data: {
          farmerId,
          cropType,
          location,
          area,
          predictedYield,
          confidenceScore,
          factors: {
            baseYield,
            weatherFactor,
            soilFactor,
            managementFactor
          },
          predictedAt: new Date()
        }
      });

      return {
        success: true,
        prediction: {
          id: prediction.id,
          cropType,
          predictedYield,
          confidenceScore,
          area,
          yieldPerHectare: Math.round(predictedYield / area),
          predictedAt: prediction.predictedAt
        }
      };
    } catch (error) {
      console.error('Yield prediction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHistoricalYieldData(cropType, location) {
    try {
      // Query historical yield data from database
      const historicalRecords = await this.prisma.yieldPrediction.findMany({
        where: {
          cropType: cropType.toLowerCase(),
          location: {
            contains: location,
            mode: 'insensitive'
          }
        },
        orderBy: { predictedAt: 'desc' },
        take: 100 // Get last 100 records for analysis
      });

      if (historicalRecords.length === 0) {
        // If no historical data, return default values
        return { averageYield: 2000, dataPoints: 0 };
      }

      // Calculate average yield from historical data
      const totalYield = historicalRecords.reduce((sum, record) => sum + record.predictedYield, 0);
      const averageYield = Math.round(totalYield / historicalRecords.length);

      return {
        averageYield,
        dataPoints: historicalRecords.length
      };
    } catch (error) {
      console.error('Historical yield data fetch failed:', error);
      return { averageYield: 2000, dataPoints: 0 };
    }
  }

  calculateWeatherYieldFactor(weatherData) {
    let factor = 1.0;

    // Temperature factor
    if (weatherData.temperature) {
      const temp = weatherData.temperature;
      if (temp >= 20 && temp <= 30) {
        factor *= 1.1; // Optimal temperature
      } else if (temp < 15 || temp > 35) {
        factor *= 0.7; // Poor temperature
      } else {
        factor *= 0.9; // Suboptimal temperature
      }
    }

    // Rainfall factor
    if (weatherData.rainfall) {
      const rainfall = weatherData.rainfall;
      if (rainfall >= 800 && rainfall <= 1500) {
        factor *= 1.05; // Good rainfall
      } else if (rainfall < 400 || rainfall > 2000) {
        factor *= 0.8; // Poor rainfall
      }
    }

    return Math.max(0.5, Math.min(1.5, factor)); // Clamp between 0.5 and 1.5
  }

  calculateSoilYieldFactor(soilData) {
    let factor = 1.0;

    // Soil pH factor
    if (soilData.ph) {
      const ph = soilData.ph;
      if (ph >= 6.0 && ph <= 7.0) {
        factor *= 1.1; // Optimal pH
      } else if (ph < 5.0 || ph > 8.0) {
        factor *= 0.7; // Poor pH
      } else {
        factor *= 0.9; // Suboptimal pH
      }
    }

    // Soil moisture factor
    if (soilData.moisture) {
      const moisture = soilData.moisture;
      if (moisture >= 40 && moisture <= 70) {
        factor *= 1.05; // Good moisture
      } else if (moisture < 20 || moisture > 85) {
        factor *= 0.8; // Poor moisture
      }
    }

    return Math.max(0.5, Math.min(1.5, factor));
  }

  calculatePredictionConfidence(dataPoints, weatherFactor, soilFactor) {
    let confidence = 50; // Base confidence

    // More data points = higher confidence
    if (dataPoints > 100) confidence += 20;
    else if (dataPoints > 50) confidence += 10;

    // Stable factors = higher confidence
    if (weatherFactor >= 0.9 && weatherFactor <= 1.1) confidence += 15;
    if (soilFactor >= 0.9 && soilFactor <= 1.1) confidence += 15;

    return Math.min(95, confidence); // Cap at 95%
  }

  async getCropHealthHistory(farmerId, cropType = null, limit = 50) {
    try {
      const where = { farmerId };
      if (cropType) {
        where.cropType = cropType;
      }

      const records = await this.prisma.cropHealthRecord.findMany({
        where,
        orderBy: { analyzedAt: 'desc' },
        take: limit
      });

      return {
        success: true,
        records: records.map(record => ({
          id: record.id,
          cropType: record.cropType,
          healthScore: record.healthScore,
          status: this.getHealthStatus(record.healthScore),
          analyzedAt: record.analyzedAt,
          recommendations: record.recommendations
        }))
      };
    } catch (error) {
      console.error('Crop health history fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getYieldPredictions(farmerId, cropType = null, limit = 20) {
    try {
      const where = { farmerId };
      if (cropType) {
        where.cropType = cropType;
      }

      const predictions = await this.prisma.yieldPrediction.findMany({
        where,
        orderBy: { predictedAt: 'desc' },
        take: limit
      });

      return {
        success: true,
        predictions: predictions.map(prediction => ({
          id: prediction.id,
          cropType: prediction.cropType,
          predictedYield: prediction.predictedYield,
          confidenceScore: prediction.confidenceScore,
          area: prediction.area,
          yieldPerHectare: Math.round(prediction.predictedYield / prediction.area),
          predictedAt: prediction.predictedAt
        }))
      };
    } catch (error) {
      console.error('Yield predictions fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CropMonitoringService;
