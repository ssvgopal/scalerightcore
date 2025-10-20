const axios = require('axios');

class WeatherIntegrationService {
  constructor(prisma) {
    this.prisma = prisma;
    this.weatherProviders = {
      openweathermap: {
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        apiKey: process.env.OPENWEATHER_API_KEY
      },
      weatherbit: {
        baseUrl: 'https://api.weatherbit.io/v2.0',
        apiKey: process.env.WEATHERBIT_API_KEY
      },
      accuweather: {
        baseUrl: 'https://dataservice.accuweather.com',
        apiKey: process.env.ACCUWEATHER_API_KEY
      }
    };
    
    this.weatherAlerts = new Map();
    this.historicalData = new Map();
  }

  async getCurrentWeather(location, coordinates = null) {
    try {
      let lat, lon;
      
      if (coordinates) {
        lat = coordinates.lat;
        lon = coordinates.lon;
      } else {
        // Geocode location to get coordinates
        const geoData = await this.geocodeLocation(location);
        lat = geoData.lat;
        lon = geoData.lon;
      }

      // Fetch current weather from primary provider
      const weatherData = await this.fetchWeatherData(lat, lon);
      
      // Store weather data
      await this.storeWeatherData(location, weatherData, 'current');

      return {
        success: true,
        weather: {
          location,
          temperature: weatherData.temperature,
          humidity: weatherData.humidity,
          pressure: weatherData.pressure,
          windSpeed: weatherData.windSpeed,
          windDirection: weatherData.windDirection,
          visibility: weatherData.visibility,
          uvIndex: weatherData.uvIndex,
          condition: weatherData.condition,
          description: weatherData.description,
          icon: weatherData.icon,
          timestamp: weatherData.timestamp
        }
      };
    } catch (error) {
      console.error('Current weather fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWeatherForecast(location, days = 7, coordinates = null) {
    try {
      let lat, lon;
      
      if (coordinates) {
        lat = coordinates.lat;
        lon = coordinates.lon;
      } else {
        const geoData = await this.geocodeLocation(location);
        lat = geoData.lat;
        lon = geoData.lon;
      }

      // Fetch forecast data
      const forecastData = await this.fetchForecastData(lat, lon, days);
      
      // Store forecast data
      await this.storeWeatherData(location, forecastData, 'forecast');

      return {
        success: true,
        forecast: {
          location,
          days,
          data: forecastData.map(day => ({
            date: day.date,
            temperature: {
              min: day.temperature.min,
              max: day.temperature.max,
              average: day.temperature.average
            },
            humidity: day.humidity,
            precipitation: {
              probability: day.precipitation.probability,
              amount: day.precipitation.amount
            },
            wind: {
              speed: day.wind.speed,
              direction: day.wind.direction
            },
            condition: day.condition,
            description: day.description
          }))
        }
      };
    } catch (error) {
      console.error('Weather forecast fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHistoricalWeather(location, startDate, endDate, coordinates = null) {
    try {
      let lat, lon;
      
      if (coordinates) {
        lat = coordinates.lat;
        lon = coordinates.lon;
      } else {
        const geoData = await this.geocodeLocation(location);
        lat = geoData.lat;
        lon = geoData.lon;
      }

      // Check if data exists in database first
      const existingData = await this.prisma.weatherData.findMany({
        where: {
          location,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: { date: 'asc' }
      });

      if (existingData.length > 0) {
        return {
          success: true,
          historical: {
            location,
            startDate,
            endDate,
            dataPoints: existingData.length,
            data: existingData.map(record => ({
              date: record.date,
              temperature: record.temperature,
              humidity: record.humidity,
              precipitation: record.precipitation,
              windSpeed: record.windSpeed,
              condition: record.condition
            }))
          }
        };
      }

      // Fetch from external API if not in database
      const historicalData = await this.fetchHistoricalData(lat, lon, startDate, endDate);
      
      // Store historical data
      await this.storeWeatherData(location, historicalData, 'historical');

      return {
        success: true,
        historical: {
          location,
          startDate,
          endDate,
          dataPoints: historicalData.length,
          data: historicalData.map(day => ({
            date: day.date,
            temperature: day.temperature,
            humidity: day.humidity,
            precipitation: day.precipitation,
            windSpeed: day.windSpeed,
            condition: day.condition
          }))
        }
      };
    } catch (error) {
      console.error('Historical weather fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async geocodeLocation(location) {
    try {
      // Mock geocoding - in production, use Google Maps or similar service
      const mockCoordinates = {
        'delhi': { lat: 28.6139, lon: 77.2090 },
        'mumbai': { lat: 19.0760, lon: 72.8777 },
        'bangalore': { lat: 12.9716, lon: 77.5946 },
        'kolkata': { lat: 22.5726, lon: 88.3639 },
        'chennai': { lat: 13.0827, lon: 80.2707 },
        'hyderabad': { lat: 17.3850, lon: 78.4867 },
        'pune': { lat: 18.5204, lon: 73.8567 },
        'ahmedabad': { lat: 23.0225, lon: 72.5714 }
      };

      const normalizedLocation = location.toLowerCase().trim();
      const coordinates = mockCoordinates[normalizedLocation];
      
      if (coordinates) {
        return coordinates;
      }

      // Default to Delhi if location not found
      return { lat: 28.6139, lon: 77.2090 };
    } catch (error) {
      console.error('Geocoding failed:', error);
      return { lat: 28.6139, lon: 77.2090 }; // Default to Delhi
    }
  }

  async fetchWeatherData(lat, lon) {
    try {
      // Mock weather data - in production, fetch from real API
      const mockWeather = {
        temperature: Math.round((Math.random() * 20 + 15) * 100) / 100, // 15-35°C
        humidity: Math.round((Math.random() * 40 + 40) * 100) / 100, // 40-80%
        pressure: Math.round((Math.random() * 50 + 1000) * 100) / 100, // 1000-1050 hPa
        windSpeed: Math.round((Math.random() * 10 + 2) * 100) / 100, // 2-12 m/s
        windDirection: Math.round(Math.random() * 360), // 0-360 degrees
        visibility: Math.round((Math.random() * 5 + 5) * 100) / 100, // 5-10 km
        uvIndex: Math.round(Math.random() * 8 + 2), // 2-10
        condition: this.getRandomCondition(),
        description: this.getRandomDescription(),
        icon: this.getRandomIcon(),
        timestamp: new Date()
      };

      return mockWeather;
    } catch (error) {
      console.error('Weather data fetch failed:', error);
      throw error;
    }
  }

  async fetchForecastData(lat, lon, days) {
    try {
      const forecast = [];
      
      for (let i = 1; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        forecast.push({
          date: date.toISOString().split('T')[0],
          temperature: {
            min: Math.round((Math.random() * 10 + 15) * 100) / 100,
            max: Math.round((Math.random() * 15 + 25) * 100) / 100,
            average: Math.round((Math.random() * 12 + 20) * 100) / 100
          },
          humidity: Math.round((Math.random() * 40 + 40) * 100) / 100,
          precipitation: {
            probability: Math.round(Math.random() * 100),
            amount: Math.round(Math.random() * 20 * 100) / 100
          },
          wind: {
            speed: Math.round((Math.random() * 10 + 2) * 100) / 100,
            direction: Math.round(Math.random() * 360)
          },
          condition: this.getRandomCondition(),
          description: this.getRandomDescription()
        });
      }

      return forecast;
    } catch (error) {
      console.error('Forecast data fetch failed:', error);
      throw error;
    }
  }

  async fetchHistoricalData(lat, lon, startDate, endDate) {
    try {
      const historical = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        historical.push({
          date: date.toISOString().split('T')[0],
          temperature: Math.round((Math.random() * 20 + 15) * 100) / 100,
          humidity: Math.round((Math.random() * 40 + 40) * 100) / 100,
          precipitation: Math.round(Math.random() * 50 * 100) / 100,
          windSpeed: Math.round((Math.random() * 10 + 2) * 100) / 100,
          condition: this.getRandomCondition()
        });
      }

      return historical;
    } catch (error) {
      console.error('Historical data fetch failed:', error);
      throw error;
    }
  }

  getRandomCondition() {
    const conditions = ['sunny', 'partly_cloudy', 'cloudy', 'rainy', 'heavy_rain', 'stormy', 'foggy'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  getRandomDescription() {
    const descriptions = [
      'Clear sky', 'Partly cloudy', 'Overcast', 'Light rain', 'Heavy rain', 
      'Thunderstorm', 'Fog', 'Haze', 'Mist'
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  getRandomIcon() {
    const icons = ['01d', '02d', '03d', '04d', '09d', '10d', '11d', '13d', '50d'];
    return icons[Math.floor(Math.random() * icons.length)];
  }

  async storeWeatherData(location, data, type) {
    try {
      if (type === 'current') {
        await this.prisma.weatherData.create({
          data: {
            location,
            date: new Date(),
            temperature: data.temperature,
            humidity: data.humidity,
            precipitation: 0,
            windSpeed: data.windSpeed,
            condition: data.condition,
            type: 'current',
            recordedAt: new Date()
          }
        });
      } else if (type === 'forecast') {
        const forecastRecords = data.map(day => ({
          location,
          date: new Date(day.date),
          temperature: day.temperature.average,
          humidity: day.humidity,
          precipitation: day.precipitation.amount,
          windSpeed: day.wind.speed,
          condition: day.condition,
          type: 'forecast',
          recordedAt: new Date()
        }));

        await this.prisma.weatherData.createMany({
          data: forecastRecords,
          skipDuplicates: true
        });
      } else if (type === 'historical') {
        const historicalRecords = data.map(day => ({
          location,
          date: new Date(day.date),
          temperature: day.temperature,
          humidity: day.humidity,
          precipitation: day.precipitation,
          windSpeed: day.windSpeed,
          condition: day.condition,
          type: 'historical',
          recordedAt: new Date()
        }));

        await this.prisma.weatherData.createMany({
          data: historicalRecords,
          skipDuplicates: true
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Weather data storage failed:', error);
      return { success: false, error: error.message };
    }
  }

  async generateWeatherAlerts(location, cropType, coordinates = null) {
    try {
      const alerts = [];

      // Get current weather
      const currentWeather = await this.getCurrentWeather(location, coordinates);
      if (!currentWeather.success) {
        throw new Error('Failed to fetch current weather');
      }

      const weather = currentWeather.weather;

      // Temperature alerts
      if (weather.temperature > 35) {
        alerts.push({
          type: 'temperature',
          severity: 'high',
          message: `High temperature alert: ${weather.temperature}°C may stress ${cropType} crops`,
          recommendation: 'Increase irrigation frequency and provide shade if possible',
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
      } else if (weather.temperature < 10) {
        alerts.push({
          type: 'temperature',
          severity: 'high',
          message: `Low temperature alert: ${weather.temperature}°C may damage ${cropType} crops`,
          recommendation: 'Protect crops with covers or move to sheltered areas',
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
      }

      // Humidity alerts
      if (weather.humidity > 85) {
        alerts.push({
          type: 'humidity',
          severity: 'medium',
          message: `High humidity alert: ${weather.humidity}% may increase disease risk for ${cropType}`,
          recommendation: 'Monitor for fungal diseases and improve ventilation',
          validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
        });
      } else if (weather.humidity < 30) {
        alerts.push({
          type: 'humidity',
          severity: 'medium',
          message: `Low humidity alert: ${weather.humidity}% may cause water stress in ${cropType}`,
          recommendation: 'Increase irrigation frequency',
          validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000)
        });
      }

      // Wind alerts
      if (weather.windSpeed > 15) {
        alerts.push({
          type: 'wind',
          severity: 'high',
          message: `High wind alert: ${weather.windSpeed} m/s may damage ${cropType} crops`,
          recommendation: 'Secure crops and equipment, avoid field work',
          validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
        });
      }

      // UV Index alerts
      if (weather.uvIndex > 8) {
        alerts.push({
          type: 'uv',
          severity: 'medium',
          message: `High UV index alert: ${weather.uvIndex} may cause sunburn in ${cropType}`,
          recommendation: 'Provide shade or adjust planting timing',
          validUntil: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
        });
      }

      // Store alerts
      if (alerts.length > 0) {
        await this.storeWeatherAlerts(location, alerts);
      }

      return {
        success: true,
        alerts,
        totalAlerts: alerts.length
      };
    } catch (error) {
      console.error('Weather alerts generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async storeWeatherAlerts(location, alerts) {
    try {
      const alertRecords = alerts.map(alert => ({
        location,
        alertType: alert.type,
        severity: alert.severity,
        message: alert.message,
        recommendation: alert.recommendation,
        validUntil: alert.validUntil,
        createdAt: new Date()
      }));

      await this.prisma.weatherAlert.createMany({
        data: alertRecords
      });

      return { success: true };
    } catch (error) {
      console.error('Weather alerts storage failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getWeatherAlerts(location, activeOnly = true) {
    try {
      const where = { location };
      
      if (activeOnly) {
        where.validUntil = { gt: new Date() };
      }

      const alerts = await this.prisma.weatherAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        alerts: alerts.map(alert => ({
          id: alert.id,
          location: alert.location,
          type: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          recommendation: alert.recommendation,
          validUntil: alert.validUntil,
          createdAt: alert.createdAt
        }))
      };
    } catch (error) {
      console.error('Weather alerts fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWeatherAnalytics(location, period = '30d') {
    try {
      const days = this.getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const weatherData = await this.prisma.weatherData.findMany({
        where: {
          location,
          date: { gte: startDate },
          type: 'current'
        },
        orderBy: { date: 'asc' }
      });

      if (weatherData.length === 0) {
        return {
          success: false,
          error: 'No weather data available for the specified period'
        };
      }

      // Calculate analytics
      const analytics = this.calculateWeatherAnalytics(weatherData);

      return {
        success: true,
        analytics: {
          location,
          period,
          dataPoints: weatherData.length,
          temperature: analytics.temperature,
          humidity: analytics.humidity,
          precipitation: analytics.precipitation,
          wind: analytics.wind,
          conditions: analytics.conditions
        }
      };
    } catch (error) {
      console.error('Weather analytics calculation failed:', error);
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

  calculateWeatherAnalytics(weatherData) {
    const temperatures = weatherData.map(d => d.temperature);
    const humidities = weatherData.map(d => d.humidity);
    const precipitations = weatherData.map(d => d.precipitation);
    const windSpeeds = weatherData.map(d => d.windSpeed);
    const conditions = weatherData.map(d => d.condition);

    return {
      temperature: {
        average: Math.round((temperatures.reduce((a, b) => a + b, 0) / temperatures.length) * 100) / 100,
        min: Math.min(...temperatures),
        max: Math.max(...temperatures),
        trend: this.calculateTrend(temperatures)
      },
      humidity: {
        average: Math.round((humidities.reduce((a, b) => a + b, 0) / humidities.length) * 100) / 100,
        min: Math.min(...humidities),
        max: Math.max(...humidities),
        trend: this.calculateTrend(humidities)
      },
      precipitation: {
        total: Math.round(precipitations.reduce((a, b) => a + b, 0) * 100) / 100,
        average: Math.round((precipitations.reduce((a, b) => a + b, 0) / precipitations.length) * 100) / 100,
        rainyDays: precipitations.filter(p => p > 0).length
      },
      wind: {
        average: Math.round((windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length) * 100) / 100,
        max: Math.max(...windSpeeds),
        trend: this.calculateTrend(windSpeeds)
      },
      conditions: this.calculateConditionFrequency(conditions)
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  calculateConditionFrequency(conditions) {
    const frequency = {};
    conditions.forEach(condition => {
      frequency[condition] = (frequency[condition] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .map(([condition, count]) => ({
        condition,
        count,
        percentage: Math.round((count / conditions.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }
}

module.exports = WeatherIntegrationService;
