const axios = require('axios');

class MarketIntelligenceService {
  constructor(prisma) {
    this.prisma = prisma;
    this.marketDataSources = {
      ncdex: {
        baseUrl: 'https://api.ncdex.com',
        apiKey: process.env.NCDEX_API_KEY
      },
      agmarknet: {
        baseUrl: 'https://agmarknet.gov.in/api',
        apiKey: process.env.AGMARKNET_API_KEY
      },
      weather: {
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        apiKey: process.env.OPENWEATHER_API_KEY
      }
    };
    
    this.cropPriceHistory = new Map();
    this.marketTrends = new Map();
  }

  async initializeMarketData() {
    try {
      // Initialize price history for major crops
      const majorCrops = ['rice', 'wheat', 'cotton', 'sugarcane', 'maize', 'soybean'];
      
      for (const crop of majorCrops) {
        await this.loadHistoricalPrices(crop);
      }

      return {
        success: true,
        message: 'Market data initialized successfully',
        crops: majorCrops
      };
    } catch (error) {
      console.error('Market data initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCurrentPrices(cropType = null, location = null) {
    try {
      let prices = [];

      if (cropType) {
        // Get prices for specific crop
        const cropPrices = await this.fetchCropPrices(cropType, location);
        prices = cropPrices;
      } else {
        // Get prices for all major crops
        const majorCrops = ['rice', 'wheat', 'cotton', 'sugarcane', 'maize', 'soybean'];
        
        for (const crop of majorCrops) {
          const cropPrices = await this.fetchCropPrices(crop, location);
          prices = prices.concat(cropPrices);
        }
      }

      // Store prices in database
      await this.storePriceData(prices);

      return {
        success: true,
        prices: prices.map(price => ({
          cropType: price.cropType,
          variety: price.variety,
          market: price.market,
          price: price.price,
          unit: price.unit,
          location: price.location,
          updatedAt: price.updatedAt
        }))
      };
    } catch (error) {
      console.error('Current prices fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fetchCropPrices(cropType, location) {
    try {
      // Mock price data - in production, this would fetch from real APIs
      const mockPrices = {
        'rice': [
          { variety: 'Basmati', price: 2800, unit: 'quintal', market: 'Delhi' },
          { variety: 'Non-Basmati', price: 2200, unit: 'quintal', market: 'Mumbai' },
          { variety: 'Paddy', price: 1800, unit: 'quintal', market: 'Kolkata' }
        ],
        'wheat': [
          { variety: 'Durum', price: 2400, unit: 'quintal', market: 'Delhi' },
          { variety: 'Soft', price: 2200, unit: 'quintal', market: 'Mumbai' }
        ],
        'cotton': [
          { variety: 'Long Staple', price: 6500, unit: 'quintal', market: 'Mumbai' },
          { variety: 'Medium Staple', price: 5800, unit: 'quintal', market: 'Delhi' }
        ],
        'sugarcane': [
          { variety: 'Co-86032', price: 320, unit: 'quintal', market: 'Mumbai' },
          { variety: 'Co-0238', price: 310, unit: 'quintal', market: 'Delhi' }
        ]
      };

      const cropPrices = mockPrices[cropType.toLowerCase()] || [];
      
      return cropPrices.map(price => ({
        cropType,
        variety: price.variety,
        market: price.market,
        price: price.price,
        unit: price.unit,
        location: location || 'All India',
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error(`Price fetch failed for ${cropType}:`, error);
      return [];
    }
  }

  async storePriceData(prices) {
    try {
      const priceRecords = prices.map(price => ({
        cropType: price.cropType,
        variety: price.variety,
        market: price.market,
        price: price.price,
        unit: price.unit,
        location: price.location,
        recordedAt: price.updatedAt
      }));

      await this.prisma.marketPrice.createMany({
        data: priceRecords,
        skipDuplicates: true
      });

      return { success: true };
    } catch (error) {
      console.error('Price data storage failed:', error);
      return { success: false, error: error.message };
    }
  }

  async analyzePriceTrends(cropType, period = '30d') {
    try {
      const days = this.getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const prices = await this.prisma.marketPrice.findMany({
        where: {
          cropType: cropType.toLowerCase(),
          recordedAt: { gte: startDate }
        },
        orderBy: { recordedAt: 'asc' }
      });

      if (prices.length === 0) {
        return {
          success: false,
          error: 'No price data available for the specified period'
        };
      }

      // Calculate trend analysis
      const trendAnalysis = this.calculateTrendAnalysis(prices);
      
      // Generate price forecast
      const forecast = await this.generatePriceForecast(prices, cropType);

      return {
        success: true,
        analysis: {
          cropType,
          period,
          dataPoints: prices.length,
          trend: trendAnalysis.trend,
          changePercent: trendAnalysis.changePercent,
          volatility: trendAnalysis.volatility,
          averagePrice: trendAnalysis.averagePrice,
          minPrice: trendAnalysis.minPrice,
          maxPrice: trendAnalysis.maxPrice,
          forecast: forecast
        }
      };
    } catch (error) {
      console.error('Price trend analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getPeriodDays(period) {
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '180d': 180,
      '1y': 365
    };
    return periodMap[period] || 30;
  }

  calculateTrendAnalysis(prices) {
    if (prices.length < 2) {
      return {
        trend: 'insufficient_data',
        changePercent: 0,
        volatility: 0,
        averagePrice: prices[0]?.price || 0,
        minPrice: prices[0]?.price || 0,
        maxPrice: prices[0]?.price || 0
      };
    }

    const priceValues = prices.map(p => p.price);
    const firstPrice = priceValues[0];
    const lastPrice = priceValues[priceValues.length - 1];
    
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    let trend = 'stable';
    if (changePercent > 5) trend = 'rising';
    else if (changePercent < -5) trend = 'falling';

    // Calculate volatility (standard deviation)
    const averagePrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    const variance = priceValues.reduce((sum, price) => sum + Math.pow(price - averagePrice, 2), 0) / priceValues.length;
    const volatility = Math.sqrt(variance);

    return {
      trend,
      changePercent: Math.round(changePercent * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      averagePrice: Math.round(averagePrice * 100) / 100,
      minPrice: Math.min(...priceValues),
      maxPrice: Math.max(...priceValues)
    };
  }

  async generatePriceForecast(prices, cropType) {
    try {
      // Simple linear regression for price forecasting
      const priceValues = prices.map(p => p.price);
      const timeValues = prices.map((p, index) => index);
      
      const n = priceValues.length;
      const sumX = timeValues.reduce((sum, x) => sum + x, 0);
      const sumY = priceValues.reduce((sum, y) => sum + y, 0);
      const sumXY = timeValues.reduce((sum, x, i) => sum + x * priceValues[i], 0);
      const sumXX = timeValues.reduce((sum, x) => sum + x * x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Forecast next 7 days
      const forecast = [];
      for (let i = 1; i <= 7; i++) {
        const futureTime = n + i - 1;
        const predictedPrice = slope * futureTime + intercept;
        forecast.push({
          day: i,
          predictedPrice: Math.round(predictedPrice * 100) / 100,
          confidence: this.calculateForecastConfidence(n, slope)
        });
      }

      return {
        next7Days: forecast,
        trend: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'stable',
        confidence: this.calculateForecastConfidence(n, slope)
      };
    } catch (error) {
      console.error('Price forecast generation failed:', error);
      return {
        next7Days: [],
        trend: 'unknown',
        confidence: 0
      };
    }
  }

  calculateForecastConfidence(dataPoints, slope) {
    let confidence = 50; // Base confidence
    
    // More data points = higher confidence
    if (dataPoints > 30) confidence += 20;
    else if (dataPoints > 15) confidence += 10;
    
    // Stable trend = higher confidence
    if (Math.abs(slope) < 10) confidence += 15;
    else if (Math.abs(slope) < 50) confidence += 5;
    
    return Math.min(90, confidence);
  }

  async getOptimalSellingRecommendation(farmerId, cropType, quantity, location) {
    try {
      // Get current market prices
      const currentPrices = await this.getCurrentPrices(cropType, location);
      if (!currentPrices.success) {
        throw new Error('Failed to fetch current prices');
      }

      // Get price trends
      const trendAnalysis = await this.analyzePriceTrends(cropType, '30d');
      if (!trendAnalysis.success) {
        throw new Error('Failed to analyze price trends');
      }

      // Get weather forecast for the region
      const weatherForecast = await this.getWeatherForecast(location, 7);
      
      // Calculate optimal selling strategy
      const recommendation = this.calculateOptimalSellingStrategy(
        currentPrices.prices,
        trendAnalysis.analysis,
        weatherForecast,
        quantity
      );

      // Store recommendation
      const sellingRecommendation = await this.prisma.sellingRecommendation.create({
        data: {
          farmerId,
          cropType,
          quantity,
          location,
          recommendation: recommendation.strategy,
          recommendedPrice: recommendation.price,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          createdAt: new Date()
        }
      });

      return {
        success: true,
        recommendation: {
          id: sellingRecommendation.id,
          cropType,
          quantity,
          strategy: recommendation.strategy,
          recommendedPrice: recommendation.price,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
          validUntil: sellingRecommendation.validUntil
        }
      };
    } catch (error) {
      console.error('Selling recommendation generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateOptimalSellingStrategy(prices, trendAnalysis, weatherForecast, quantity) {
    const currentPrice = prices[0]?.price || 0;
    const trend = trendAnalysis.trend;
    const forecast = trendAnalysis.forecast;
    
    let strategy = 'hold';
    let recommendedPrice = currentPrice;
    let confidence = 50;
    let reasoning = [];

    // Analyze trend
    if (trend === 'rising' && forecast.trend === 'rising') {
      strategy = 'hold';
      reasoning.push('Prices are rising, consider holding for better prices');
      confidence += 20;
    } else if (trend === 'falling' && forecast.trend === 'falling') {
      strategy = 'sell_now';
      reasoning.push('Prices are falling, sell immediately to avoid further losses');
      confidence += 15;
    } else if (trend === 'stable') {
      strategy = 'sell_now';
      reasoning.push('Prices are stable, good time to sell');
      confidence += 10;
    }

    // Analyze weather impact
    if (weatherForecast && weatherForecast.hasAdverseWeather) {
      if (strategy === 'hold') {
        strategy = 'sell_now';
        reasoning.push('Adverse weather forecast may impact prices negatively');
        confidence += 10;
      }
    }

    // Analyze quantity impact
    if (quantity > 1000) { // Large quantity
      strategy = 'gradual_sell';
      reasoning.push('Large quantity detected, consider gradual selling to avoid market impact');
      confidence += 5;
    }

    // Calculate recommended price
    if (strategy === 'sell_now') {
      recommendedPrice = currentPrice * 0.98; // 2% below current price for quick sale
    } else if (strategy === 'hold') {
      recommendedPrice = currentPrice * 1.05; // 5% above current price for future sale
    } else if (strategy === 'gradual_sell') {
      recommendedPrice = currentPrice * 0.99; // 1% below current price for gradual sale
    }

    return {
      strategy,
      price: Math.round(recommendedPrice * 100) / 100,
      confidence: Math.min(95, confidence),
      reasoning
    };
  }

  async getWeatherForecast(location, days = 7) {
    try {
      // Mock weather forecast - in production, this would fetch from weather API
      const mockForecast = {
        location,
        forecast: [
          { day: 1, temperature: 28, humidity: 65, rainfall: 0, condition: 'sunny' },
          { day: 2, temperature: 30, humidity: 70, rainfall: 0, condition: 'partly_cloudy' },
          { day: 3, temperature: 26, humidity: 80, rainfall: 5, condition: 'rainy' },
          { day: 4, temperature: 24, humidity: 85, rainfall: 10, condition: 'heavy_rain' },
          { day: 5, temperature: 27, humidity: 75, rainfall: 2, condition: 'cloudy' },
          { day: 6, temperature: 29, humidity: 68, rainfall: 0, condition: 'sunny' },
          { day: 7, temperature: 31, humidity: 62, rainfall: 0, condition: 'sunny' }
        ],
        hasAdverseWeather: false,
        averageTemperature: 27.9,
        totalRainfall: 17
      };

      // Check for adverse weather
      const hasHeavyRain = mockForecast.forecast.some(day => day.rainfall > 8);
      const hasExtremeTemp = mockForecast.forecast.some(day => day.temperature > 35 || day.temperature < 15);
      
      mockForecast.hasAdverseWeather = hasHeavyRain || hasExtremeTemp;

      return mockForecast;
    } catch (error) {
      console.error('Weather forecast fetch failed:', error);
      return {
        location,
        forecast: [],
        hasAdverseWeather: false,
        error: error.message
      };
    }
  }

  async getMarketAlerts(farmerId, alertTypes = ['price_drop', 'price_spike', 'weather_warning']) {
    try {
      const alerts = [];

      // Get farmer's crops
      const farmerCrops = await this.prisma.cropRecord.findMany({
        where: { farmerId, status: 'planted' }
      });

      for (const crop of farmerCrops) {
        // Price drop alert
        if (alertTypes.includes('price_drop')) {
          const trendAnalysis = await this.analyzePriceTrends(crop.cropType, '7d');
          if (trendAnalysis.success && trendAnalysis.analysis.changePercent < -10) {
            alerts.push({
              type: 'price_drop',
              cropType: crop.cropType,
              severity: 'high',
              message: `${crop.cropType} prices have dropped by ${Math.abs(trendAnalysis.analysis.changePercent)}% in the last week`,
              action: 'Consider selling immediately to avoid further losses',
              createdAt: new Date()
            });
          }
        }

        // Price spike alert
        if (alertTypes.includes('price_spike')) {
          const trendAnalysis = await this.analyzePriceTrends(crop.cropType, '7d');
          if (trendAnalysis.success && trendAnalysis.analysis.changePercent > 15) {
            alerts.push({
              type: 'price_spike',
              cropType: crop.cropType,
              severity: 'medium',
              message: `${crop.cropType} prices have increased by ${trendAnalysis.analysis.changePercent}% in the last week`,
              action: 'Consider selling to capitalize on high prices',
              createdAt: new Date()
            });
          }
        }

        // Weather warning alert
        if (alertTypes.includes('weather_warning')) {
          const weatherForecast = await this.getWeatherForecast(crop.location, 3);
          if (weatherForecast.hasAdverseWeather) {
            alerts.push({
              type: 'weather_warning',
              cropType: crop.cropType,
              severity: 'high',
              message: `Adverse weather forecast for ${crop.location} may impact ${crop.cropType}`,
              action: 'Take protective measures for your crops',
              createdAt: new Date()
            });
          }
        }
      }

      return {
        success: true,
        alerts,
        totalAlerts: alerts.length
      };
    } catch (error) {
      console.error('Market alerts generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getSupplyDemandAnalysis(cropType, region) {
    try {
      // Mock supply-demand analysis - in production, this would use real data
      const analysis = {
        cropType,
        region,
        supply: {
          current: 85000, // quintals
          trend: 'increasing',
          changePercent: 5.2
        },
        demand: {
          current: 92000, // quintals
          trend: 'stable',
          changePercent: 1.8
        },
        priceImpact: 'positive',
        recommendation: 'Supply is increasing faster than demand, prices may stabilize or decrease',
        confidence: 75,
        updatedAt: new Date()
      };

      // Calculate price impact
      const supplyGrowth = analysis.supply.changePercent;
      const demandGrowth = analysis.demand.changePercent;
      
      if (supplyGrowth > demandGrowth + 2) {
        analysis.priceImpact = 'negative';
        analysis.recommendation = 'Supply growing faster than demand, prices likely to decrease';
      } else if (demandGrowth > supplyGrowth + 2) {
        analysis.priceImpact = 'positive';
        analysis.recommendation = 'Demand growing faster than supply, prices likely to increase';
      } else {
        analysis.priceImpact = 'neutral';
        analysis.recommendation = 'Supply and demand growth balanced, prices likely to remain stable';
      }

      return {
        success: true,
        analysis
      };
    } catch (error) {
      console.error('Supply-demand analysis failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = MarketIntelligenceService;
