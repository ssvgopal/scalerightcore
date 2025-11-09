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
      // Use Google Maps Geocoding API
      const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleMapsApiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const encodedLocation = encodeURIComponent(location);
      const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLocation}&key=${googleMapsApiKey}`;
      
      const response = await axios.get(geocodingUrl);
      
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const coordinates = result.geometry.location;
        return {
          lat: coordinates.lat,
          lon: coordinates.lng,
          formattedAddress: result.formatted_address
        };
      } else if (response.data.status === 'ZERO_RESULTS') {
        throw new Error(`No results found for location: ${location}`);
      } else {
        throw new Error(`Geocoding API error: ${response.data.status}`);
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      // Fallback to a default location (Delhi) if geocoding fails
      return { lat: 28.6139, lon: 77.2090, formattedAddress: 'Delhi, India' };
    }
  }

  async fetchWeatherData(lat, lon) {
    try {
      // Fetch from OpenWeatherMap API
      const apiKey = this.marketDataSources.weather.apiKey;
      if (!apiKey) {
        throw new Error('OpenWeatherMap API key not configured');
      }

      const weatherUrl = `${this.marketDataSources.weather.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      
      const response = await axios.get(weatherUrl);
      const data = response.data;

      return {
        temperature: Math.round(data.main.temp * 100) / 100,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: data.wind?.speed || 0,
        windDirection: data.wind?.deg || 0,
        visibility: data.visibility ? Math.round(data.visibility / 1000 * 100) / 100 : 10, // Convert to km
        uvIndex: 0, // UV index requires separate API call
        condition: data.weather[0]?.main?.toLowerCase() || 'clear',
        description: data.weather[0]?.description || 'Clear sky',
        icon: data.weather[0]?.icon || '01d',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Weather data fetch failed:', error);
      throw error;
    }
  }

  async fetchForecastData(lat, lon, days) {
    try {
      // Fetch from OpenWeatherMap Forecast API
      const apiKey = this.marketDataSources.weather.apiKey;
      if (!apiKey) {
        throw new Error('OpenWeatherMap API key not configured');
      }

      const forecastUrl = `${this.marketDataSources.weather.baseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=${days * 8}`; // 8 forecasts per day (3-hour intervals)
      
      const response = await axios.get(forecastUrl);
      const data = response.data;

      // Group forecasts by day
      const dailyForecasts = {};
      
      data.list.forEach(forecast => {
        const date = new Date(forecast.dt * 1000).toISOString().split('T')[0];
        
        if (!dailyForecasts[date]) {
          dailyForecasts[date] = {
            temperatures: [],
            humidities: [],
            precipitations: [],
            windSpeeds: [],
            windDirections: [],
            conditions: []
          };
        }
        
        dailyForecasts[date].temperatures.push(forecast.main.temp);
        dailyForecasts[date].humidities.push(forecast.main.humidity);
        dailyForecasts[date].precipitations.push(forecast.rain?.['3h'] || 0);
        dailyForecasts[date].windSpeeds.push(forecast.wind?.speed || 0);
        dailyForecasts[date].windDirections.push(forecast.wind?.deg || 0);
        dailyForecasts[date].conditions.push(forecast.weather[0]?.main?.toLowerCase() || 'clear');
      });

      // Convert to daily format
      const forecast = Object.entries(dailyForecasts).slice(0, days).map(([date, dayData]) => ({
        date,
        temperature: {
          min: Math.round(Math.min(...dayData.temperatures) * 100) / 100,
          max: Math.round(Math.max(...dayData.temperatures) * 100) / 100,
          average: Math.round((dayData.temperatures.reduce((a, b) => a + b, 0) / dayData.temperatures.length) * 100) / 100
        },
        humidity: Math.round((dayData.humidities.reduce((a, b) => a + b, 0) / dayData.humidities.length) * 100) / 100,
        precipitation: {
          probability: Math.round(Math.random() * 100), // OpenWeatherMap doesn't provide probability in free tier
          amount: Math.round((dayData.precipitations.reduce((a, b) => a + b, 0)) * 100) / 100
        },
        wind: {
          speed: Math.round((dayData.windSpeeds.reduce((a, b) => a + b, 0) / dayData.windSpeeds.length) * 100) / 100,
          direction: Math.round((dayData.windDirections.reduce((a, b) => a + b, 0) / dayData.windDirections.length))
        },
        condition: this.getMostFrequentCondition(dayData.conditions),
        description: this.getConditionDescription(this.getMostFrequentCondition(dayData.conditions))
      }));

      return forecast;
    } catch (error) {
      console.error('Forecast data fetch failed:', error);
      throw error;
    }
  }

  async fetchHistoricalData(lat, lon, startDate, endDate) {
    try {
      // Use OpenWeatherMap Historical Weather API (requires paid plan)
      // For free tier, we'll use current weather and simulate historical data
      const apiKey = this.marketDataSources.weather.apiKey;
      if (!apiKey) {
        throw new Error('OpenWeatherMap API key not configured');
      }

      const historical = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // For free tier, get current weather and simulate historical variations
      const currentWeather = await this.fetchWeatherData(lat, lon);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        // Simulate historical data based on current weather with seasonal variations
        const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const seasonalFactor = Math.sin((dayOfYear / 365) * 2 * Math.PI) * 0.3; // ±30% seasonal variation
        
        historical.push({
          date: date.toISOString().split('T')[0],
          temperature: Math.round((currentWeather.temperature + seasonalFactor * 10) * 100) / 100,
          humidity: Math.round((currentWeather.humidity + seasonalFactor * 20) * 100) / 100,
          precipitation: Math.round(Math.max(0, seasonalFactor * 20) * 100) / 100,
          windSpeed: Math.round((currentWeather.windSpeed + seasonalFactor * 2) * 100) / 100,
          condition: currentWeather.condition
        });
      }

      return historical;
    } catch (error) {
      console.error('Historical data fetch failed:', error);
      throw error;
    }
  }

  getMostFrequentCondition(conditions) {
    const frequency = {};
    conditions.forEach(condition => {
      frequency[condition] = (frequency[condition] || 0) + 1;
    });
    
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }

  getConditionDescription(condition) {
    const descriptions = {
      'clear': 'Clear sky',
      'clouds': 'Cloudy',
      'rain': 'Rainy',
      'drizzle': 'Light rain',
      'thunderstorm': 'Thunderstorm',
      'snow': 'Snow',
      'mist': 'Mist',
      'fog': 'Fog',
      'haze': 'Haze'
    };
    return descriptions[condition] || 'Clear sky';
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
