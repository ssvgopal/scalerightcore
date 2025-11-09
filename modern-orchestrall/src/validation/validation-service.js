const { z } = require('zod');

class ValidationService {
  constructor() {
    this.schemas = {
      // User validation schemas
      userRegistration: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        name: z.string().min(2, 'Name must be at least 2 characters'),
        organizationId: z.string().cuid('Invalid organization ID')
      }),

      userLogin: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(1, 'Password is required')
      }),

      // Farmer validation schemas
      farmerProfile: z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        farmLocation: z.string().min(2, 'Farm location is required'),
        region: z.string().min(2, 'Region is required'),
        phone: z.string().optional(),
        email: z.string().email('Invalid email format').optional(),
        aadhaarNumber: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
        panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
        bankAccountNumber: z.string().min(9, 'Invalid bank account number').optional(),
        ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').optional()
      }),

      // Crop validation schemas
      crop: z.object({
        name: z.string().min(2, 'Crop name is required'),
        variety: z.string().optional(),
        plantingDate: z.string().datetime('Invalid planting date'),
        harvestDate: z.string().datetime('Invalid harvest date').optional(),
        yield: z.number().positive('Yield must be positive').optional(),
        status: z.enum(['planted', 'growing', 'harvested'], 'Invalid crop status')
      }),

      // Weather validation schemas
      weatherData: z.object({
        location: z.string().min(2, 'Location is required'),
        temperature: z.number().min(-50).max(60, 'Temperature out of range'),
        humidity: z.number().min(0).max(100, 'Humidity must be 0-100%'),
        rainfall: z.number().min(0, 'Rainfall cannot be negative'),
        windSpeed: z.number().min(0, 'Wind speed cannot be negative'),
        windDirection: z.number().min(0).max(360, 'Wind direction must be 0-360 degrees')
      }),

      // Market price validation schemas
      marketPrice: z.object({
        commodity: z.string().min(2, 'Commodity name is required'),
        price: z.number().positive('Price must be positive'),
        unit: z.enum(['kg', 'quintal', 'ton'], 'Invalid unit'),
        location: z.string().min(2, 'Location is required'),
        source: z.string().min(2, 'Source is required')
      }),

      // Loan application validation schemas
      loanApplication: z.object({
        amount: z.number().positive('Loan amount must be positive'),
        purpose: z.enum(['crop_cultivation', 'equipment', 'emergency'], 'Invalid loan purpose'),
        tenure: z.number().int().min(1).max(60, 'Tenure must be 1-60 months'),
        interestRate: z.number().min(0).max(50, 'Interest rate must be 0-50%')
      }),

      // Insurance claim validation schemas
      insuranceClaim: z.object({
        damageType: z.enum(['drought', 'flood', 'pest', 'disease', 'hail', 'fire'], 'Invalid damage type'),
        damagePercentage: z.number().min(0).max(100, 'Damage percentage must be 0-100%'),
        damageArea: z.number().positive('Damage area must be positive'),
        claimAmount: z.number().positive('Claim amount must be positive')
      }),

      // Land record validation schemas
      landRecord: z.object({
        surveyNumber: z.string().min(2, 'Survey number is required'),
        area: z.number().positive('Area must be positive'),
        soilType: z.enum(['clay', 'sandy', 'loamy', 'black'], 'Invalid soil type'),
        irrigationType: z.enum(['borewell', 'canal', 'rainfed'], 'Invalid irrigation type'),
        ownershipType: z.enum(['owned', 'leased', 'shared'], 'Invalid ownership type'),
        leaseExpiry: z.string().datetime('Invalid lease expiry date').optional()
      }),

      // Crop health validation schemas
      cropHealth: z.object({
        healthScore: z.number().int().min(0).max(100, 'Health score must be 0-100'),
        diseaseDetected: z.array(z.string()).optional(),
        pestDetected: z.array(z.string()).optional(),
        nutrientDeficiency: z.array(z.string()).optional(),
        images: z.array(z.string().url('Invalid image URL')).optional()
      }),

      // Yield prediction validation schemas
      yieldPrediction: z.object({
        predictedYield: z.number().positive('Predicted yield must be positive'),
        confidence: z.number().min(0).max(1, 'Confidence must be 0-1'),
        location: z.string().min(2, 'Location is required'),
        cropType: z.string().min(2, 'Crop type is required')
      }),

      // API key validation schemas
      apiKey: z.object({
        name: z.string().min(2, 'API key name is required'),
        permissions: z.array(z.string()).min(1, 'At least one permission is required'),
        rateLimit: z.number().int().min(1).max(10000, 'Rate limit must be 1-10000'),
        expiresAt: z.string().datetime('Invalid expiry date').optional()
      }),

      // Organization validation schemas
      organization: z.object({
        name: z.string().min(2, 'Organization name is required'),
        slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
        tier: z.enum(['starter', 'professional', 'enterprise'], 'Invalid tier'),
        status: z.enum(['active', 'suspended', 'cancelled'], 'Invalid status')
      }),

      // Pagination validation schemas
      pagination: z.object({
        page: z.number().int().min(1, 'Page must be at least 1').default(1),
        limit: z.number().int().min(1).max(100, 'Limit must be 1-100').default(10),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('desc')
      }),

      // Search validation schemas
      search: z.object({
        query: z.string().min(1, 'Search query is required'),
        filters: z.record(z.any()).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10)
      })
    };
  }

  // Validate data against schema
  validate(schemaName, data) {
    try {
      const schema = this.schemas[schemaName];
      if (!schema) {
        throw new Error(`Schema '${schemaName}' not found`);
      }

      const result = schema.safeParse(data);
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          errors: null
        };
      } else {
        return {
          success: false,
          data: null,
          errors: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        };
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        errors: [{
          field: 'validation',
          message: error.message,
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  // Validate request body
  validateBody(schemaName) {
    return (req, res, next) => {
      const validation = this.validate(schemaName, req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      req.validatedData = validation.data;
      next();
    };
  }

  // Validate query parameters
  validateQuery(schemaName) {
    return (req, res, next) => {
      const validation = this.validate(schemaName, req.query);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Query validation failed',
          details: validation.errors
        });
      }

      req.validatedQuery = validation.data;
      next();
    };
  }

  // Validate URL parameters
  validateParams(schemaName) {
    return (req, res, next) => {
      const validation = this.validate(schemaName, req.params);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Parameter validation failed',
          details: validation.errors
        });
      }

      req.validatedParams = validation.data;
      next();
    };
  }

  // Sanitize input data
  sanitize(data) {
    if (typeof data === 'string') {
      return data.trim().replace(/[<>]/g, '');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitize(value);
      }
      return sanitized;
    }
    
    return data;
  }

  // Create custom schema
  createSchema(schemaName, schema) {
    this.schemas[schemaName] = schema;
  }

  // Get all available schemas
  getSchemas() {
    return Object.keys(this.schemas);
  }

  // Validate file upload
  validateFileUpload(options = {}) {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      required = false
    } = options;

    return (req, res, next) => {
      if (!req.file && required) {
        return res.status(400).json({
          success: false,
          error: 'File upload required'
        });
      }

      if (req.file) {
        // Check file size
        if (req.file.size > maxSize) {
          return res.status(400).json({
            success: false,
            error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`
          });
        }

        // Check file type
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
          });
        }
      }

      next();
    };
  }

  // Validate coordinates
  validateCoordinates(lat, lon) {
    const latSchema = z.number().min(-90).max(90);
    const lonSchema = z.number().min(-180).max(180);

    const latResult = latSchema.safeParse(lat);
    const lonResult = lonSchema.safeParse(lon);

    if (!latResult.success || !lonResult.success) {
      return {
        success: false,
        error: 'Invalid coordinates'
      };
    }

    return {
      success: true,
      coordinates: {
        lat: latResult.data,
        lon: lonResult.data
      }
    };
  }

  // Validate phone number (Indian format)
  validatePhoneNumber(phone) {
    const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number');
    return phoneSchema.safeParse(phone);
  }

  // Validate Aadhaar number
  validateAadhaar(aadhaar) {
    const aadhaarSchema = z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits');
    return aadhaarSchema.safeParse(aadhaar);
  }

  // Validate PAN number
  validatePAN(pan) {
    const panSchema = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format');
    return panSchema.safeParse(pan);
  }

  // Validate IFSC code
  validateIFSC(ifsc) {
    const ifscSchema = z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code');
    return ifscSchema.safeParse(ifsc);
  }
}

module.exports = ValidationService;
