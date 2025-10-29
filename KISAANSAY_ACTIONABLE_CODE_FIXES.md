# 🔧 KISAANSAY - ACTIONABLE CODE FIXES

## 📋 CRITICAL FIXES REQUIRED

This document lists **specific code changes** that need to be made to make the Kisaansay platform production-ready.

---

## 🔒 FIX #1: ADD AUTHENTICATION TO AGRICULTURAL ROUTES (P0 - CRITICAL)

**File:** `modern-orchestrall/src/app-zero-config.js`  
**Lines:** 3837-4100  
**Time:** 1-2 days  
**Priority:** P0 - MUST FIX BEFORE PRODUCTION

### **Change Required:**
Add `preHandler` with authentication to all agricultural route definitions (25+ endpoints).

### **Pattern to Follow:**
```javascript
// ❌ BEFORE (Lines 3837-4100 - ALL ROUTES LIKE THIS):
this.app.post('/api/agricultural/farmers/register', async (request, reply) => {
  try {
    const farmerData = request.body;
    const result = await this.farmerManagement.registerFarmer(farmerData);
    return reply.send(result);
  } catch (error) {
    this.app.log.error('Farmer registration error:', error);
    return reply.code(500).send({ success: false, error: error.message });
  }
});

// ✅ AFTER (ADD THIS PATTERN TO ALL AGRICULTURAL ROUTES):
this.app.post('/api/agricultural/farmers/register', {
  preHandler: [
    this.authMiddleware.verifyToken.bind(this.authMiddleware),
    this.authMiddleware.requireRole(['admin', 'field_agent']).bind(this.authMiddleware)
  ],
  handler: async (request, reply) => {
    try {
      const farmerData = {
        ...request.body,
        organizationId: request.user.organizationId,  // Multi-tenant isolation
        createdBy: request.user.userId
      };
      const result = await this.farmerManagement.registerFarmer(farmerData);
      reply.send(this.errorHandler.successResponse(result, 'Farmer registered successfully'));
    } catch (error) {
      throw error;  // Let error handler middleware handle it
    }
  }
});
```

### **Role-Based Access Control (RBAC) for Each Endpoint:**

#### **Farmer Management Routes (6 endpoints):**
```javascript
// POST /api/agricultural/farmers/register
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'field_agent']).bind(this.authMiddleware)
]

// GET /api/agricultural/farmers/:farmerId
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'field_agent', 'farmer', 'analyst']).bind(this.authMiddleware)
]

// PUT /api/agricultural/farmers/:farmerId
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'field_agent']).bind(this.authMiddleware)
]

// POST /api/agricultural/farmers/verify/:farmerId
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'field_agent']).bind(this.authMiddleware)
]

// GET /api/agricultural/farmers (search)
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'field_agent', 'analyst']).bind(this.authMiddleware)
]

// GET /api/agricultural/farmers/statistics
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'analyst']).bind(this.authMiddleware)
]
```

#### **Market Intelligence Routes (5 endpoints):**
```javascript
// All market routes - farmers need to see prices:
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'farmer', 'field_agent', 'analyst']).bind(this.authMiddleware)
]
```

#### **Financial Services Routes (4 endpoints):**
```javascript
// Financial routes - farmers and financial officers only:
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'financial_officer', 'farmer']).bind(this.authMiddleware)
]
```

#### **Crop Monitoring Routes (4 endpoints):**
```javascript
// Crop routes - farmers and field agents:
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware),
  this.authMiddleware.requireRole(['admin', 'farmer', 'field_agent']).bind(this.authMiddleware)
]
```

#### **Weather Routes (6 endpoints):**
```javascript
// Weather routes - accessible to all authenticated users:
preHandler: [
  this.authMiddleware.verifyToken.bind(this.authMiddleware)
  // No role restriction - all users need weather info
]
```

### **Additional Changes for Multi-Tenant Isolation:**

For each route, add organization filtering:

```javascript
// Example for farmer search:
handler: async (request, reply) => {
  try {
    const searchCriteria = {
      ...request.query,
      organizationId: request.user.organizationId  // ✅ Multi-tenant isolation
    };
    const result = await this.farmerManagement.searchFarmers(searchCriteria);
    reply.send(this.errorHandler.successResponse(result));
  } catch (error) {
    throw error;
  }
}
```

---

## 🔌 FIX #2: CONNECT SERVICES TO DATABASE (P0 - CRITICAL)

**Files:**
- `modern-orchestrall/src/agricultural/crop-monitoring-service.js`
- `modern-orchestrall/src/agricultural/farmer-management-service.js`
- `modern-orchestrall/src/agricultural/market-intelligence-service.js`
- `modern-orchestrall/src/agricultural/agricultural-financial-service.js`
- `modern-orchestrall/src/agricultural/weather-integration-service.js`

**Time:** 3-5 days  
**Priority:** P0 - MUST FIX BEFORE PRODUCTION

### **A. Replace Mock Weather Data with Real API Calls**

**File:** `modern-orchestrall/src/agricultural/weather-integration-service.js`

```javascript
// ❌ BEFORE (Mock data):
async getCurrentWeather(location) {
  return {
    location,
    temperature: 28,
    humidity: 65,
    // ... hardcoded mock data
  };
}

// ✅ AFTER (Real API + Database):
async getCurrentWeather(location) {
  try {
    // Get from OpenWeatherMap API
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: location,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric'
      }
    });

    const weatherData = {
      location,
      temperature: response.data.main.temp,
      humidity: response.data.main.humidity,
      rainfall: response.data.rain?.['1h'] || 0,
      windSpeed: response.data.wind.speed,
      metadata: {
        source: 'openweathermap',
        timestamp: new Date().toISOString()
      }
    };

    // Store in database
    await this.prisma.weatherData.create({
      data: {
        location,
        date: new Date(),
        temperature: weatherData.temperature,
        humidity: weatherData.humidity,
        rainfall: weatherData.rainfall,
        windSpeed: weatherData.windSpeed,
        metadata: weatherData.metadata
      }
    });

    return { success: true, data: weatherData };
  } catch (error) {
    this.logger.error('Weather API error:', error);
    
    // Fallback to cached data from database
    const cachedData = await this.prisma.weatherData.findFirst({
      where: { location },
      orderBy: { date: 'desc' }
    });

    if (cachedData) {
      return { success: true, data: cachedData, cached: true };
    }

    throw new Error(`Weather data not available for ${location}`);
  }
}
```

### **B. Replace Mock Market Data with Real API Calls**

**File:** `modern-orchestrall/src/agricultural/market-intelligence-service.js`

```javascript
// ❌ BEFORE (Mock data):
async getCurrentPrices(cropType, location) {
  return {
    cropType,
    location,
    prices: [
      { commodity: 'Rice', price: 2500, unit: 'quintal' }
      // ... hardcoded data
    ]
  };
}

// ✅ AFTER (Real API + Database):
async getCurrentPrices(cropType, location) {
  try {
    // Get from NCDEX/Agmarknet API (example structure)
    const response = await axios.get(process.env.MARKET_DATA_API_URL, {
      params: {
        commodity: cropType,
        market: location,
        apiKey: process.env.MARKET_API_KEY
      }
    });

    const priceData = response.data.prices.map(p => ({
      commodity: p.commodity,
      price: p.modalPrice,
      unit: p.unit,
      location: p.market,
      date: new Date(p.arrivalDate),
      source: 'ncdex',
      metadata: {
        minPrice: p.minPrice,
        maxPrice: p.maxPrice,
        volume: p.arrivals
      }
    }));

    // Store in database
    await this.prisma.marketPrice.createMany({
      data: priceData.map(p => ({
        commodity: p.commodity,
        price: p.price,
        unit: p.unit,
        location: p.location,
        date: p.date,
        source: p.source,
        metadata: p.metadata
      }))
    });

    return { success: true, data: priceData };
  } catch (error) {
    this.logger.error('Market data API error:', error);
    
    // Fallback to database cache
    const cachedPrices = await this.prisma.marketPrice.findMany({
      where: {
        commodity: cropType,
        location: location,
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { date: 'desc' }
    });

    if (cachedPrices.length > 0) {
      return { success: true, data: cachedPrices, cached: true };
    }

    throw new Error(`Market data not available for ${cropType} in ${location}`);
  }
}
```

### **C. Update Farmer Management to Use Database**

**File:** `modern-orchestrall/src/agricultural/farmer-management-service.js`

The file already has database operations, but verify all methods actually use Prisma:

```javascript
// ✅ VERIFY: Methods should look like this (using Prisma):
async registerFarmer(farmerData) {
  const {
    personalInfo,
    contactInfo,
    landInfo,
    bankInfo,
    organizationId,  // ✅ Must have organizationId for multi-tenancy
    createdBy
  } = farmerData;

  // Validate unique constraints
  const existing = await this.prisma.farmerProfile.findFirst({
    where: {
      aadhaarNumber: personalInfo.aadhaarNumber,
      organizationId  // ✅ Check within organization only
    }
  });

  if (existing) {
    throw new Error('Farmer with this Aadhaar number already exists in your organization');
  }

  // Create farmer with all relations
  const farmer = await this.prisma.farmerProfile.create({
    data: {
      name: personalInfo.name,
      phone: contactInfo.mobile,
      email: contactInfo.email,
      aadhaarNumber: personalInfo.aadhaarNumber,
      panNumber: personalInfo.panNumber,
      farmLocation: landInfo[0]?.location || '',
      region: landInfo[0]?.region || '',
      organizationId,  // ✅ Multi-tenant isolation
      verificationStatus: 'pending',
      
      // Create related records
      documents: {
        create: (farmerData.documents || []).map(doc => ({
          documentType: doc.type,
          documentNumber: doc.number,
          documentUrl: doc.url,
          status: 'pending'
        }))
      },
      landRecords: {
        create: (landInfo || []).map(land => ({
          surveyNumber: land.surveyNumber,
          area: land.area,
          soilType: land.soilType,
          irrigationType: land.irrigationType,
          ownershipType: land.ownershipType || 'owned'
        }))
      }
    },
    include: {
      documents: true,
      landRecords: true
    }
  });

  return { success: true, data: farmer };
}
```

---

## ✅ FIX #3: ADD INPUT VALIDATION (P1 - HIGH)

**Files to Create:**
- `modern-orchestrall/src/schemas/farmer-schemas.js`
- `modern-orchestrall/src/schemas/crop-schemas.js`
- `modern-orchestrall/src/schemas/market-schemas.js`
- `modern-orchestrall/src/schemas/financial-schemas.js`
- `modern-orchestrall/src/schemas/common-schemas.js`

**Time:** 2-3 days  
**Priority:** P1 - HIGH

### **A. Create Validation Schemas**

**File:** `modern-orchestrall/src/schemas/farmer-schemas.js` (NEW FILE)

```javascript
const { z } = require('zod');

// Common patterns
const indianPhoneRegex = /^[6-9]\d{9}$/;
const aadhaarRegex = /^\d{12}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const FarmerRegistrationSchema = z.object({
  personalInfo: z.object({
    name: z.string().min(2).max(100),
    aadhaarNumber: z.string().regex(aadhaarRegex, 'Invalid Aadhaar number').optional(),
    panNumber: z.string().regex(panRegex, 'Invalid PAN number').optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(['male', 'female', 'other']).optional()
  }),
  
  contactInfo: z.object({
    mobile: z.string().regex(indianPhoneRegex, 'Invalid mobile number'),
    email: z.string().email().optional(),
    alternatePhone: z.string().regex(indianPhoneRegex).optional(),
    address: z.string().max(500).optional()
  }),
  
  landInfo: z.array(z.object({
    surveyNumber: z.string().min(1).max(50),
    area: z.number().positive(),
    soilType: z.enum(['clay', 'sandy', 'loamy', 'black', 'red', 'laterite', 'alluvial']),
    irrigationType: z.enum(['borewell', 'canal', 'rainfed', 'drip', 'sprinkler']),
    location: z.string().min(1).max(200),
    region: z.string().min(1).max(100),
    ownershipType: z.enum(['owned', 'leased', 'shared']).default('owned'),
    leaseExpiry: z.string().datetime().optional()
  })).min(1, 'At least one land record is required'),
  
  bankInfo: z.object({
    accountNumber: z.string().min(9).max(18),
    ifscCode: z.string().regex(ifscRegex, 'Invalid IFSC code'),
    bankName: z.string().min(1).max(100),
    branchName: z.string().max(100).optional()
  }).optional(),
  
  documents: z.array(z.object({
    type: z.enum(['aadhaar', 'pan', 'land_document', 'bank_passbook', 'crop_insurance', 'government_id']),
    number: z.string().optional(),
    url: z.string().url()
  })).optional()
});

const FarmerUpdateSchema = z.object({
  personalInfo: z.object({
    name: z.string().min(2).max(100).optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(['male', 'female', 'other']).optional()
  }).optional(),
  
  contactInfo: z.object({
    mobile: z.string().regex(indianPhoneRegex).optional(),
    email: z.string().email().optional(),
    alternatePhone: z.string().regex(indianPhoneRegex).optional(),
    address: z.string().max(500).optional()
  }).optional(),
  
  bankInfo: z.object({
    accountNumber: z.string().min(9).max(18).optional(),
    ifscCode: z.string().regex(ifscRegex).optional(),
    bankName: z.string().min(1).max(100).optional(),
    branchName: z.string().max(100).optional()
  }).optional()
});

const FarmerVerificationSchema = z.object({
  verificationType: z.enum(['kyc', 'land_verification', 'bank_verification']),
  status: z.enum(['verified', 'rejected']),
  notes: z.string().max(500).optional()
});

module.exports = {
  FarmerRegistrationSchema,
  FarmerUpdateSchema,
  FarmerVerificationSchema
};
```

**File:** `modern-orchestrall/src/schemas/financial-schemas.js` (NEW FILE)

```javascript
const { z } = require('zod');

const LoanApplicationSchema = z.object({
  farmerId: z.string().cuid(),
  amount: z.number().positive().max(10000000), // Max 1 crore
  purpose: z.enum(['crop_cultivation', 'equipment_purchase', 'irrigation', 'storage', 'emergency']),
  tenure: z.number().int().positive().max(120), // Max 10 years
  cropDetails: z.object({
    cropType: z.string().min(1),
    expectedYield: z.number().positive().optional(),
    marketValue: z.number().positive().optional()
  }).optional()
});

const InsuranceClaimSchema = z.object({
  farmerId: z.string().cuid(),
  policyId: z.string().cuid().optional(),
  damageType: z.enum(['drought', 'flood', 'pest', 'disease', 'hail', 'fire', 'cyclone']),
  damagePercentage: z.number().min(0).max(100),
  damageArea: z.number().positive(),
  description: z.string().max(1000),
  evidenceUrls: z.array(z.string().url()).optional()
});

module.exports = {
  LoanApplicationSchema,
  InsuranceClaimSchema
};
```

### **B. Apply Schemas to Routes**

**File:** `modern-orchestrall/src/app-zero-config.js`

```javascript
// Import schemas at top of file:
const { FarmerRegistrationSchema, FarmerUpdateSchema, FarmerVerificationSchema } = require('./schemas/farmer-schemas');
const { LoanApplicationSchema, InsuranceClaimSchema } = require('./schemas/financial-schemas');

// Apply to routes:
this.app.post('/api/agricultural/farmers/register', {
  preHandler: [
    this.authMiddleware.verifyToken.bind(this.authMiddleware),
    this.authMiddleware.requireRole(['admin', 'field_agent']).bind(this.authMiddleware)
  ],
  schema: {
    body: FarmerRegistrationSchema  // ✅ Automatic validation
  },
  handler: async (request, reply) => {
    // If we reach here, validation passed
    const farmerData = {
      ...request.body,
      organizationId: request.user.organizationId,
      createdBy: request.user.userId
    };
    const result = await this.farmerManagement.registerFarmer(farmerData);
    reply.send(this.errorHandler.successResponse(result, 'Farmer registered successfully'));
  }
});

this.app.post('/api/agricultural/finance/loan-application', {
  preHandler: [
    this.authMiddleware.verifyToken.bind(this.authMiddleware),
    this.authMiddleware.requireRole(['admin', 'financial_officer', 'farmer']).bind(this.authMiddleware)
  ],
  schema: {
    body: LoanApplicationSchema  // ✅ Automatic validation
  },
  handler: async (request, reply) => {
    const loanData = {
      ...request.body,
      organizationId: request.user.organizationId,
      appliedBy: request.user.userId
    };
    const result = await this.agriculturalFinance.processLoanApplication(loanData.farmerId, loanData);
    reply.send(this.errorHandler.successResponse(result, 'Loan application submitted'));
  }
});
```

---

## 🔑 ENVIRONMENT VARIABLES REQUIRED

**File:** `.env.example` (UPDATE)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/orchestrall"

# Authentication
JWT_SECRET="your-secret-key-here"
JWT_EXPIRES_IN="7d"

# Weather API
OPENWEATHER_API_KEY="your-openweathermap-api-key"
WEATHERAPI_KEY="your-weatherapi-key"  # Backup provider

# Market Data APIs
NCDEX_API_KEY="your-ncdex-api-key"
NCDEX_API_URL="https://api.ncdex.com/v1"
AGMARKNET_API_KEY="your-agmarknet-api-key"
AGMARKNET_API_URL="https://agmarknet.gov.in/api/v1"

# Payment Gateway
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-secret"

# Notifications
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@kisaansay.com"

# Voice Services
SARVAM_API_KEY="your-sarvam-api-key"
SARVAM_API_URL="https://api.sarvam.ai/v1"

# Redis
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="production"
PORT=3000
```

---

## ✅ VERIFICATION CHECKLIST

After making all fixes, verify:

- [ ] All 25+ agricultural routes have `preHandler` with authentication
- [ ] All routes use appropriate RBAC roles
- [ ] All routes add `organizationId` from `request.user.organizationId`
- [ ] All services connect to Prisma database
- [ ] Weather service uses OpenWeatherMap API
- [ ] Market service uses real market data API
- [ ] All routes have Zod schema validation
- [ ] All environment variables are configured
- [ ] Error handling works correctly
- [ ] Multi-tenant isolation is enforced
- [ ] Test with authenticated requests
- [ ] Test with invalid inputs (validation should reject)
- [ ] Test with missing authentication (should return 401)
- [ ] Test with wrong role (should return 403)

---

## 📝 TESTING COMMANDS

```bash
# Run database migrations
cd modern-orchestrall
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Start server
npm start

# Test authentication (should fail - 401)
curl -X POST http://localhost:3000/api/agricultural/farmers/register \
  -H "Content-Type: application/json" \
  -d '{"personalInfo":{"name":"Test Farmer"}}'

# Get auth token first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Test with auth token (should succeed)
curl -X POST http://localhost:3000/api/agricultural/farmers/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "personalInfo": {
      "name": "Test Farmer",
      "aadhaarNumber": "123456789012"
    },
    "contactInfo": {
      "mobile": "9876543210",
      "email": "farmer@example.com"
    },
    "landInfo": [{
      "surveyNumber": "123/A",
      "area": 2.5,
      "soilType": "loamy",
      "irrigationType": "borewell",
      "location": "Village X",
      "region": "District Y"
    }]
  }'
```

---

## 🚀 SUMMARY

**3 Critical Fixes:**
1. ✅ Add authentication to all agricultural routes (1-2 days)
2. ✅ Connect services to database and real APIs (3-5 days)
3. ✅ Add input validation with Zod schemas (2-3 days)

**Total Time:** 6-10 days (1.5-2 weeks)  
**Priority:** ALL P0/P1 - Must fix before production deployment

**After these fixes:**
- Platform will be secure ✅
- Platform will use real data ✅
- Platform will validate all inputs ✅
- Platform will be production-ready ✅
