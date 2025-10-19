// plugins/dashboard/farmer/index.js - Farmer Dashboard Plugin
const axios = require('axios');
const moment = require('moment');
const _ = require('lodash');
const logger = require('../../../src/utils/logger');

class FarmerDashboardPlugin {
  constructor(config, prisma, loggerInstance) {
    this.config = config;
    this.prisma = prisma;
    this.logger = loggerInstance || logger;
    this.weatherApiKey = config.weatherApiKey;
    this.weatherApiUrl = config.weatherApiUrl || 'https://api.openweathermap.org/data/2.5/';
    this.commodityApiKey = config.commodityApiKey;
    this.commodityApiUrl = config.commodityApiUrl || 'https://api.ncdex.com/v1/';
    this.updateInterval = config.updateInterval || 300000; // 5 minutes
    this.maxHistoryDays = config.maxHistoryDays || 365;
    this.initialized = false;
    this.updateTimer = null;
  }

  async initialize() {
    this.logger.info('Initializing Farmer Dashboard...');
    
    if (!this.weatherApiKey || !this.commodityApiKey) {
      throw new Error('Weather and Commodity API keys are required');
    }

    try {
      // Test API connections
      await this.testWeatherAPI();
      await this.testCommodityAPI();
      
      // Start background data updates
      this.startDataUpdates();
      
      this.initialized = true;
      this.logger.info('Farmer Dashboard initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Farmer Dashboard: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    this.logger.info('Shutting down Farmer Dashboard...');
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    this.initialized = false;
    this.logger.info('Farmer Dashboard shut down');
  }

  async healthCheck() {
    if (!this.initialized) {
      throw new Error('Farmer Dashboard plugin not initialized');
    }
    
    try {
      await this.testWeatherAPI();
      await this.testCommodityAPI();
      
      return { 
        status: 'ok', 
        message: 'Farmer Dashboard is operational',
        weatherAPI: 'connected',
        commodityAPI: 'connected'
      };
    } catch (error) {
      this.logger.error(`Farmer Dashboard health check failed: ${error.message}`);
      throw new Error(`Farmer Dashboard connectivity issue: ${error.message}`);
    }
  }

  // Get farmer dashboard data
  async getFarmerDashboard(farmerId, organizationId) {
    if (!this.initialized) throw new Error('Plugin not initialized');
    
    try {
      const farmer = await this.prisma.farmerProfile.findUnique({
        where: { id: farmerId },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          crops: {
            orderBy: { plantingDate: 'desc' }
          },
          voiceCalls: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!farmer) {
        throw new Error('Farmer not found');
      }

      // Get recent weather data
      const weatherData = await this.getWeatherData(farmer.farmLocation);
      
      // Get market prices for farmer's crops
      const marketPrices = await this.getMarketPrices(farmer.crops);
      
      // Calculate financial summary
      const financialSummary = await this.calculateFinancialSummary(farmerId);
      
      // Get crop analytics
      const cropAnalytics = await this.getCropAnalytics(farmerId);

      return {
        farmer: {
          id: farmer.id,
          name: farmer.name,
          farmLocation: farmer.farmLocation,
          region: farmer.region
        },
        transactions: farmer.transactions,
        crops: farmer.crops,
        recentCalls: farmer.voiceCalls,
        weather: weatherData,
        marketPrices: marketPrices,
        financialSummary: financialSummary,
        cropAnalytics: cropAnalytics,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error(`Failed to get farmer dashboard: ${error.message}`);
      throw error;
    }
  }

  // Get farmer transaction history
  async getFarmerTransactions(farmerId, filters = {}) {
    try {
      const where = { farmerId: farmerId };
      
      if (filters.dateRange) {
        where.createdAt = {
          gte: new Date(filters.dateRange.start),
          lte: new Date(filters.dateRange.end)
        };
      }
      
      if (filters.type) {
        where.type = filters.type;
      }

      const transactions = await this.prisma.farmerTransaction.findMany({
        where: where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      });

      return transactions;
    } catch (error) {
      this.logger.error(`Failed to get farmer transactions: ${error.message}`);
      throw error;
    }
  }

  // Get crop analytics
  async getCropAnalytics(farmerId) {
    try {
      const crops = await this.prisma.crop.findMany({
        where: { farmerId: farmerId },
        orderBy: { plantingDate: 'desc' }
      });

      const analytics = {
        totalCrops: crops.length,
        activeCrops: crops.filter(c => c.status === 'growing').length,
        harvestedCrops: crops.filter(c => c.status === 'harvested').length,
        totalYield: crops.reduce((sum, crop) => sum + (crop.yield || 0), 0),
        averageYield: 0,
        cropTypes: {},
        monthlyData: {}
      };

      if (crops.length > 0) {
        analytics.averageYield = analytics.totalYield / crops.length;
        
        // Group by crop type
        analytics.cropTypes = _.groupBy(crops, 'name');
        
        // Group by month
        analytics.monthlyData = _.groupBy(crops, crop => 
          moment(crop.plantingDate).format('YYYY-MM')
        );
      }

      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get crop analytics: ${error.message}`);
      throw error;
    }
  }

  // Get weather data for location
  async getWeatherData(location) {
    try {
      // Check if we have recent weather data
      const recentWeather = await this.prisma.weatherData.findFirst({
        where: {
          location: location,
          date: {
            gte: moment().subtract(1, 'hour').toDate()
          }
        },
        orderBy: { date: 'desc' }
      });

      if (recentWeather) {
        return {
          current: recentWeather,
          forecast: await this.getWeatherForecast(location)
        };
      }

      // Fetch fresh weather data
      const weatherData = await this.fetchWeatherData(location);
      
      // Store in database
      await this.storeWeatherData(location, weatherData);
      
      return {
        current: weatherData.current,
        forecast: weatherData.forecast
      };
    } catch (error) {
      this.logger.error(`Failed to get weather data: ${error.message}`);
      throw error;
    }
  }

  // Get market prices for crops
  async getMarketPrices(crops) {
    try {
      const cropNames = crops.map(crop => crop.name);
      const prices = await this.prisma.marketPrice.findMany({
        where: {
          commodity: { in: cropNames },
          date: {
            gte: moment().subtract(7, 'days').toDate()
          }
        },
        orderBy: { date: 'desc' }
      });

      // Group by commodity
      const groupedPrices = _.groupBy(prices, 'commodity');
      
      return Object.keys(groupedPrices).map(commodity => ({
        commodity: commodity,
        currentPrice: groupedPrices[commodity][0]?.price || 0,
        unit: groupedPrices[commodity][0]?.unit || 'kg',
        trend: this.calculatePriceTrend(groupedPrices[commodity]),
        history: groupedPrices[commodity].slice(0, 7)
      }));
    } catch (error) {
      this.logger.error(`Failed to get market prices: ${error.message}`);
      throw error;
    }
  }

  // Calculate financial summary
  async calculateFinancialSummary(farmerId) {
    try {
      const transactions = await this.prisma.farmerTransaction.findMany({
        where: { farmerId: farmerId }
      });

      const summary = {
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        monthlyBreakdown: {},
        topIncomeSources: {},
        topExpenseCategories: {}
      };

      transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        const month = moment(transaction.createdAt).format('YYYY-MM');
        
        if (transaction.type === 'income') {
          summary.totalIncome += amount;
          summary.monthlyBreakdown[month] = (summary.monthlyBreakdown[month] || 0) + amount;
          
          const source = transaction.description || 'Other';
          summary.topIncomeSources[source] = (summary.topIncomeSources[source] || 0) + amount;
        } else if (transaction.type === 'expense') {
          summary.totalExpenses += amount;
          summary.monthlyBreakdown[month] = (summary.monthlyBreakdown[month] || 0) - amount;
          
          const category = transaction.description || 'Other';
          summary.topExpenseCategories[category] = (summary.topExpenseCategories[category] || 0) + amount;
        }
      });

      summary.netProfit = summary.totalIncome - summary.totalExpenses;
      
      // Sort top sources/categories
      summary.topIncomeSources = Object.entries(summary.topIncomeSources)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
        
      summary.topExpenseCategories = Object.entries(summary.topExpenseCategories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      return summary;
    } catch (error) {
      this.logger.error(`Failed to calculate financial summary: ${error.message}`);
      throw error;
    }
  }

  // Add new crop
  async addCrop(farmerId, cropData) {
    try {
      const crop = await this.prisma.crop.create({
        data: {
          farmerId: farmerId,
          name: cropData.name,
          variety: cropData.variety,
          plantingDate: new Date(cropData.plantingDate),
          harvestDate: cropData.harvestDate ? new Date(cropData.harvestDate) : null,
          status: 'planted',
          metadata: cropData.metadata || {}
        }
      });

      this.logger.info(`Crop added for farmer ${farmerId}: ${crop.id}`);
      return crop;
    } catch (error) {
      this.logger.error(`Failed to add crop: ${error.message}`);
      throw error;
    }
  }

  // Update crop status
  async updateCropStatus(cropId, status, yield = null) {
    try {
      const updateData = { status: status };
      
      if (status === 'harvested' && yield) {
        updateData.harvestDate = new Date();
        updateData.yield = yield;
      }

      const crop = await this.prisma.crop.update({
        where: { id: cropId },
        data: updateData
      });

      this.logger.info(`Crop status updated: ${cropId} -> ${status}`);
      return crop;
    } catch (error) {
      this.logger.error(`Failed to update crop status: ${error.message}`);
      throw error;
    }
  }

  // Test Weather API connection
  async testWeatherAPI() {
    try {
      const response = await axios.get(`${this.weatherApiUrl}weather`, {
        params: {
          q: 'Mumbai,IN',
          appid: this.weatherApiKey,
          units: 'metric'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Weather API connection failed: ${error.message}`);
    }
  }

  // Test Commodity API connection
  async testCommodityAPI() {
    try {
      const response = await axios.get(`${this.commodityApiUrl}prices`, {
        headers: {
          'Authorization': `Bearer ${this.commodityApiKey}`
        },
        params: {
          commodity: 'rice',
          limit: 1
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Commodity API connection failed: ${error.message}`);
    }
  }

  // Fetch weather data from API
  async fetchWeatherData(location) {
    try {
      const response = await axios.get(`${this.weatherApiUrl}weather`, {
        params: {
          q: location,
          appid: this.weatherApiKey,
          units: 'metric'
        }
      });

      return {
        current: {
          temperature: response.data.main.temp,
          humidity: response.data.main.humidity,
          description: response.data.weather[0].description,
          windSpeed: response.data.wind.speed
        },
        forecast: await this.getWeatherForecast(location)
      };
    } catch (error) {
      this.logger.error(`Failed to fetch weather data: ${error.message}`);
      throw error;
    }
  }

  // Get weather forecast
  async getWeatherForecast(location) {
    try {
      const response = await axios.get(`${this.weatherApiUrl}forecast`, {
        params: {
          q: location,
          appid: this.weatherApiKey,
          units: 'metric'
        }
      });

      return response.data.list.slice(0, 5).map(item => ({
        date: item.dt_txt,
        temperature: item.main.temp,
        humidity: item.main.humidity,
        description: item.weather[0].description,
        windSpeed: item.wind.speed
      }));
    } catch (error) {
      this.logger.error(`Failed to get weather forecast: ${error.message}`);
      return [];
    }
  }

  // Store weather data in database
  async storeWeatherData(location, weatherData) {
    try {
      await this.prisma.weatherData.create({
        data: {
          location: location,
          date: new Date(),
          temperature: weatherData.current.temperature,
          humidity: weatherData.current.humidity,
          rainfall: 0, // Would need additional API call
          windSpeed: weatherData.current.windSpeed,
          metadata: weatherData
        }
      });
    } catch (error) {
      this.logger.error(`Failed to store weather data: ${error.message}`);
    }
  }

  // Calculate price trend
  calculatePriceTrend(prices) {
    if (prices.length < 2) return 'stable';
    
    const recent = prices[0].price;
    const previous = prices[1].price;
    
    const change = ((recent - previous) / previous) * 100;
    
    if (change > 5) return 'rising';
    if (change < -5) return 'falling';
    return 'stable';
  }

  // Start background data updates
  startDataUpdates() {
    this.updateTimer = setInterval(async () => {
      try {
        await this.updateMarketPrices();
        await this.cleanupOldData();
      } catch (error) {
        this.logger.error(`Background update failed: ${error.message}`);
      }
    }, this.updateInterval);
  }

  // Update market prices
  async updateMarketPrices() {
    try {
      const commodities = ['rice', 'wheat', 'maize', 'sugarcane', 'cotton'];
      
      for (const commodity of commodities) {
        const response = await axios.get(`${this.commodityApiUrl}prices`, {
          headers: {
            'Authorization': `Bearer ${this.commodityApiKey}`
          },
          params: {
            commodity: commodity,
            limit: 1
          }
        });

        if (response.data && response.data.length > 0) {
          const priceData = response.data[0];
          
          await this.prisma.marketPrice.create({
            data: {
              commodity: commodity,
              price: priceData.price,
              unit: priceData.unit || 'kg',
              location: priceData.location || 'National',
              date: new Date(),
              source: 'NCDEX',
              metadata: priceData
            }
          });
        }
      }
      
      this.logger.debug('Market prices updated');
    } catch (error) {
      this.logger.error(`Failed to update market prices: ${error.message}`);
    }
  }

  // Cleanup old data
  async cleanupOldData() {
    try {
      const cutoffDate = moment().subtract(this.maxHistoryDays, 'days').toDate();
      
      await this.prisma.weatherData.deleteMany({
        where: {
          date: { lt: cutoffDate }
        }
      });
      
      await this.prisma.marketPrice.deleteMany({
        where: {
          date: { lt: cutoffDate }
        }
      });
      
      this.logger.debug('Old data cleaned up');
    } catch (error) {
      this.logger.error(`Failed to cleanup old data: ${error.message}`);
    }
  }
}

module.exports = FarmerDashboardPlugin;
