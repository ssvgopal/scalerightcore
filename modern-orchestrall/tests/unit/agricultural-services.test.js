const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

// Mock Prisma
const mockPrisma = {
  farmerProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  crop: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  weatherData: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  marketPrice: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  loanApplication: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  insuranceClaim: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  creditScore: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  yieldPrediction: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  cropHealthRecord: {
    create: jest.fn(),
    findMany: jest.fn()
  }
};

// Mock external APIs
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

describe('Crop Monitoring Service', () => {
  let CropMonitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    CropMonitoringService = require('../../src/agricultural/crop-monitoring-service');
  });

  test('should analyze crop health successfully', async () => {
    const service = new CropMonitoringService(mockPrisma);
    const farmerId = 'farmer-123';
    const cropData = {
      cropType: 'rice',
      variety: 'Basmati',
      plantingDate: '2024-01-01',
      area: 2.5,
      location: 'Delhi'
    };

    const mockHealthData = {
      healthScore: 85,
      diseaseDetected: [],
      pestDetected: [],
      nutrientDeficiency: [],
      recommendations: {
        watering: 'Increase watering frequency',
        fertilization: 'Apply nitrogen fertilizer'
      }
    };

    mockPrisma.cropHealthRecord.findMany.mockResolvedValue([mockHealthData]);

    const result = await service.analyzeCropHealth(farmerId, cropData);

    expect(result.success).toBe(true);
    expect(result.analysis.healthScore).toBe(85);
    expect(result.analysis.recommendations).toBeDefined();
  });

  test('should predict yield accurately', async () => {
    const service = new CropMonitoringService(mockPrisma);
    const farmerId = 'farmer-123';
    const cropData = {
      cropType: 'rice',
      variety: 'Basmati',
      plantingDate: '2024-01-01',
      area: 2.5,
      location: 'Delhi',
      weatherData: {
        temperature: 28,
        humidity: 65,
        rainfall: 100
      }
    };

    const mockPrediction = {
      predictedYield: 2500,
      confidence: 0.85,
      factors: {
        weather: 0.9,
        soil: 0.8,
        management: 0.85
      }
    };

    mockPrisma.yieldPrediction.create.mockResolvedValue({
      id: 'prediction-123',
      ...mockPrediction,
      createdAt: new Date()
    });

    const result = await service.predictYield(farmerId, cropData);

    expect(result.success).toBe(true);
    expect(result.prediction.predictedYield).toBe(2500);
    expect(result.prediction.confidence).toBe(0.85);
  });

  test('should handle crop health analysis errors', async () => {
    const service = new CropMonitoringService(mockPrisma);
    const farmerId = 'farmer-123';
    const cropData = {
      cropType: 'rice',
      variety: 'Basmati',
      plantingDate: '2024-01-01',
      area: 2.5,
      location: 'Delhi'
    };

    mockPrisma.cropHealthRecord.findMany.mockRejectedValue(new Error('Database error'));

    const result = await service.analyzeCropHealth(farmerId, cropData);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });
});

describe('Farmer Management Service', () => {
  let FarmerManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    FarmerManagementService = require('../../src/agricultural/farmer-management-service');
  });

  test('should register farmer successfully', async () => {
    const service = new FarmerManagementService(mockPrisma);
    const farmerData = {
      name: 'John Doe',
      farmLocation: 'Delhi',
      region: 'North India',
      phone: '9876543210',
      email: 'john@example.com',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      bankAccountNumber: '1234567890',
      ifscCode: 'SBIN0001234'
    };

    const mockFarmer = {
      id: 'farmer-123',
      ...farmerData,
      createdAt: new Date()
    };

    mockPrisma.farmerProfile.create.mockResolvedValue(mockFarmer);

    const result = await service.registerFarmer(farmerData);

    expect(result.success).toBe(true);
    expect(result.farmer.id).toBe('farmer-123');
    expect(result.farmer.name).toBe('John Doe');
  });

  test('should get farmer profile successfully', async () => {
    const service = new FarmerManagementService(mockPrisma);
    const farmerId = 'farmer-123';
    const mockFarmer = {
      id: farmerId,
      name: 'John Doe',
      farmLocation: 'Delhi',
      region: 'North India',
      phone: '9876543210',
      email: 'john@example.com'
    };

    mockPrisma.farmerProfile.findUnique.mockResolvedValue(mockFarmer);

    const result = await service.getFarmerProfile(farmerId);

    expect(result.success).toBe(true);
    expect(result.farmer.id).toBe(farmerId);
    expect(result.farmer.name).toBe('John Doe');
  });

  test('should handle farmer not found', async () => {
    const service = new FarmerManagementService(mockPrisma);
    const farmerId = 'non-existent-farmer';

    mockPrisma.farmerProfile.findUnique.mockResolvedValue(null);

    const result = await service.getFarmerProfile(farmerId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Farmer not found');
  });
});

describe('Market Intelligence Service', () => {
  let MarketIntelligenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    MarketIntelligenceService = require('../../src/agricultural/market-intelligence-service');
  });

  test('should get crop prices successfully', async () => {
    const service = new MarketIntelligenceService(mockPrisma);
    const cropType = 'rice';
    const location = 'Delhi';

    const mockPrices = [
      {
        cropType: 'rice',
        variety: 'Basmati',
        price: 2800,
        unit: 'quintal',
        market: 'Delhi',
        location: 'Delhi',
        updatedAt: new Date()
      }
    ];

    mockPrisma.marketPrice.findMany.mockResolvedValue(mockPrices);

    const result = await service.getCropPrices(cropType, location);

    expect(result.success).toBe(true);
    expect(result.prices).toHaveLength(1);
    expect(result.prices[0].price).toBe(2800);
  });

  test('should analyze market trends', async () => {
    const service = new MarketIntelligenceService(mockPrisma);
    const cropType = 'rice';
    const location = 'Delhi';
    const days = 30;

    const mockTrends = {
      trend: 'increasing',
      changePercent: 5.2,
      averagePrice: 2750,
      priceRange: {
        min: 2500,
        max: 3000
      }
    };

    mockPrisma.marketPrice.findMany.mockResolvedValue([
      { price: 2500, date: new Date('2024-01-01') },
      { price: 3000, date: new Date('2024-01-30') }
    ]);

    const result = await service.analyzeMarketTrends(cropType, location, days);

    expect(result.success).toBe(true);
    expect(result.trends).toBeDefined();
  });

  test('should provide selling recommendations', async () => {
    const service = new MarketIntelligenceService(mockPrisma);
    const farmerId = 'farmer-123';
    const cropType = 'rice';
    const quantity = 100;

    const mockRecommendation = {
      recommendedPrice: 2800,
      market: 'Delhi',
      timing: 'Sell within 2 weeks',
      reasoning: 'Prices are expected to increase due to high demand',
      confidence: 0.85
    };

    mockPrisma.sellingRecommendation.create.mockResolvedValue({
      id: 'recommendation-123',
      ...mockRecommendation,
      createdAt: new Date()
    });

    const result = await service.getSellingRecommendation(farmerId, cropType, quantity);

    expect(result.success).toBe(true);
    expect(result.recommendation.recommendedPrice).toBe(2800);
    expect(result.recommendation.confidence).toBe(0.85);
  });
});

describe('Weather Integration Service', () => {
  let WeatherIntegrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    WeatherIntegrationService = require('../../src/agricultural/weather-integration-service');
  });

  test('should get current weather successfully', async () => {
    const service = new WeatherIntegrationService(mockPrisma);
    const location = 'Delhi';

    const mockWeather = {
      temperature: 28.5,
      humidity: 65,
      pressure: 1013,
      windSpeed: 5.2,
      windDirection: 180,
      visibility: 10,
      condition: 'clear',
      description: 'Clear sky',
      timestamp: new Date()
    };

    mockPrisma.weatherData.create.mockResolvedValue({
      id: 'weather-123',
      location,
      ...mockWeather,
      createdAt: new Date()
    });

    const result = await service.getCurrentWeather(location);

    expect(result.success).toBe(true);
    expect(result.weather.temperature).toBe(28.5);
    expect(result.weather.condition).toBe('clear');
  });

  test('should get weather forecast successfully', async () => {
    const service = new WeatherIntegrationService(mockPrisma);
    const location = 'Delhi';
    const days = 7;

    const mockForecast = [
      {
        date: '2024-01-01',
        temperature: { min: 20, max: 30, average: 25 },
        humidity: 65,
        precipitation: { probability: 20, amount: 0 },
        wind: { speed: 5, direction: 180 },
        condition: 'clear',
        description: 'Clear sky'
      }
    ];

    const result = await service.getWeatherForecast(location, days);

    expect(result.success).toBe(true);
    expect(result.forecast.data).toBeDefined();
  });

  test('should handle weather API errors', async () => {
    const service = new WeatherIntegrationService(mockPrisma);
    const location = 'Invalid Location';

    const result = await service.getCurrentWeather(location);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Agricultural Financial Service', () => {
  let AgriculturalFinancialService;

  beforeEach(() => {
    jest.clearAllMocks();
    AgriculturalFinancialService = require('../../src/agricultural/agricultural-financial-service');
  });

  test('should calculate credit score successfully', async () => {
    const service = new AgriculturalFinancialService(mockPrisma);
    const farmerId = 'farmer-123';

    const mockCreditData = {
      paymentHistory: { excellent: true, good: false, fair: false, poor: false },
      loanRepaymentHistory: { excellent: true, good: false, fair: false, poor: false },
      insuranceHistory: { noClaims: true, lowClaims: false, moderateClaims: false, highClaims: false }
    };

    mockPrisma.creditScore.create.mockResolvedValue({
      id: 'credit-123',
      farmerId,
      score: 85,
      factors: mockCreditData,
      calculatedAt: new Date()
    });

    const result = await service.calculateCreditScore(farmerId);

    expect(result.success).toBe(true);
    expect(result.creditScore.score).toBe(85);
    expect(result.creditScore.rating).toBe('good');
  });

  test('should apply for loan successfully', async () => {
    const service = new AgriculturalFinancialService(mockPrisma);
    const farmerId = 'farmer-123';
    const loanData = {
      amount: 50000,
      purpose: 'crop_cultivation',
      tenure: 12,
      interestRate: 12.5
    };

    const mockLoan = {
      id: 'loan-123',
      farmerId,
      ...loanData,
      status: 'pending',
      appliedAt: new Date()
    };

    mockPrisma.loanApplication.create.mockResolvedValue(mockLoan);

    const result = await service.applyForLoan(farmerId, loanData);

    expect(result.success).toBe(true);
    expect(result.loan.id).toBe('loan-123');
    expect(result.loan.status).toBe('pending');
  });

  test('should process insurance claim successfully', async () => {
    const service = new AgriculturalFinancialService(mockPrisma);
    const farmerId = 'farmer-123';
    const claimData = {
      damageType: 'drought',
      damagePercentage: 60,
      damageArea: 5.0,
      claimAmount: 30000
    };

    const mockClaim = {
      id: 'claim-123',
      farmerId,
      ...claimData,
      status: 'filed',
      filedAt: new Date()
    };

    mockPrisma.insuranceClaim.create.mockResolvedValue(mockClaim);

    const result = await service.fileInsuranceClaim(farmerId, claimData);

    expect(result.success).toBe(true);
    expect(result.claim.id).toBe('claim-123');
    expect(result.claim.status).toBe('filed');
  });

  test('should perform automated claim assessment', async () => {
    const service = new AgriculturalFinancialService(mockPrisma);
    const claimId = 'claim-123';
    const mockClaim = {
      id: claimId,
      damageType: 'drought',
      damagePercentage: 60,
      damageArea: 5.0,
      claimAmount: 30000
    };

    mockPrisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
    mockPrisma.insuranceClaim.update.mockResolvedValue({
      ...mockClaim,
      status: 'approved',
      assessmentScore: 75,
      confidence: 0.85,
      assessedAt: new Date()
    });

    const result = await service.performAutomatedAssessment(mockClaim);

    expect(result.success).toBe(true);
    expect(result.assessmentResult).toBe('approved');
    expect(result.assessmentScore).toBeGreaterThan(0);
    expect(result.automated).toBe(true);
  });
});

describe('Validation Service', () => {
  let ValidationService;

  beforeEach(() => {
    ValidationService = require('../../src/validation/validation-service');
  });

  test('should validate farmer profile data correctly', () => {
    const service = new ValidationService();
    const validData = {
      name: 'John Doe',
      farmLocation: 'Delhi',
      region: 'North India',
      phone: '9876543210',
      email: 'john@example.com',
      aadhaarNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      bankAccountNumber: '1234567890',
      ifscCode: 'SBIN0001234'
    };

    const result = service.validate('farmerProfile', validData);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  test('should reject invalid farmer profile data', () => {
    const service = new ValidationService();
    const invalidData = {
      name: 'A', // Too short
      farmLocation: '', // Empty
      email: 'invalid-email', // Invalid email
      aadhaarNumber: '123', // Invalid Aadhaar
      panNumber: 'INVALID', // Invalid PAN
      ifscCode: 'INVALID' // Invalid IFSC
    };

    const result = service.validate('farmerProfile', invalidData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should validate crop data correctly', () => {
    const service = new ValidationService();
    const validData = {
      name: 'Rice',
      variety: 'Basmati',
      plantingDate: '2024-01-01T00:00:00Z',
      harvestDate: '2024-06-01T00:00:00Z',
      status: 'planted'
    };

    const result = service.validate('crop', validData);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  test('should validate loan application data correctly', () => {
    const service = new ValidationService();
    const validData = {
      amount: 50000,
      purpose: 'crop_cultivation',
      tenure: 12,
      interestRate: 12.5
    };

    const result = service.validate('loanApplication', validData);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  test('should sanitize malicious input', () => {
    const service = new ValidationService();
    const maliciousData = {
      name: '<script>alert("xss")</script>John Doe',
      farmLocation: 'Delhi',
      region: 'North India'
    };

    const sanitized = service.sanitize(maliciousData);

    expect(sanitized.name).not.toContain('<script>');
    expect(sanitized.name).toBe('John Doe');
  });

  test('should validate coordinates correctly', () => {
    const service = new ValidationService();
    const validCoords = service.validateCoordinates(28.6139, 77.2090);

    expect(validCoords.success).toBe(true);
    expect(validCoords.coordinates.lat).toBe(28.6139);
    expect(validCoords.coordinates.lon).toBe(77.2090);

    const invalidCoords = service.validateCoordinates(200, 200);

    expect(invalidCoords.success).toBe(false);
    expect(invalidCoords.error).toBe('Invalid coordinates');
  });

  test('should validate phone number correctly', () => {
    const service = new ValidationService();
    const validPhone = service.validatePhoneNumber('9876543210');

    expect(validPhone.success).toBe(true);

    const invalidPhone = service.validatePhoneNumber('1234567890');

    expect(invalidPhone.success).toBe(false);
  });

  test('should validate Aadhaar number correctly', () => {
    const service = new ValidationService();
    const validAadhaar = service.validateAadhaar('123456789012');

    expect(validAadhaar.success).toBe(true);

    const invalidAadhaar = service.validateAadhaar('123');

    expect(invalidAadhaar.success).toBe(false);
  });

  test('should validate PAN number correctly', () => {
    const service = new ValidationService();
    const validPAN = service.validatePAN('ABCDE1234F');

    expect(validPAN.success).toBe(true);

    const invalidPAN = service.validatePAN('INVALID');

    expect(invalidPAN.success).toBe(false);
  });

  test('should validate IFSC code correctly', () => {
    const service = new ValidationService();
    const validIFSC = service.validateIFSC('SBIN0001234');

    expect(validIFSC.success).toBe(true);

    const invalidIFSC = service.validateIFSC('INVALID');

    expect(invalidIFSC.success).toBe(false);
  });
});
