const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class FarmerManagementService {
  constructor(prisma) {
    this.prisma = prisma;
    this.documentTypes = [
      'aadhaar_card',
      'pan_card',
      'land_document',
      'bank_account',
      'crop_insurance',
      'government_id',
      'income_certificate',
      'caste_certificate'
    ];
  }

  async registerFarmer(farmerData) {
    try {
      const {
        personalInfo,
        contactInfo,
        landInfo,
        bankInfo,
        documents = []
      } = farmerData;

      // Validate required fields
      if (!personalInfo.name || !personalInfo.aadhaarNumber || !contactInfo.mobile) {
        throw new Error('Name, Aadhaar number, and mobile number are required');
      }

      // Check if farmer already exists
      const existingFarmer = await this.prisma.farmer.findFirst({
        where: {
          OR: [
            { aadhaarNumber: personalInfo.aadhaarNumber },
            { mobileNumber: contactInfo.mobile }
          ]
        }
      });

      if (existingFarmer) {
        throw new Error('Farmer with this Aadhaar number or mobile number already exists');
      }

      // Create farmer record
      const farmer = await this.prisma.farmer.create({
        data: {
          name: personalInfo.name,
          aadhaarNumber: personalInfo.aadhaarNumber,
          panNumber: personalInfo.panNumber,
          dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : null,
          gender: personalInfo.gender,
          fatherName: personalInfo.fatherName,
          motherName: personalInfo.motherName,
          mobileNumber: contactInfo.mobile,
          email: contactInfo.email,
          address: contactInfo.address,
          village: contactInfo.village,
          district: contactInfo.district,
          state: contactInfo.state,
          pincode: contactInfo.pincode,
          landArea: landInfo.totalArea,
          landType: landInfo.type,
          irrigationType: landInfo.irrigationType,
          bankAccountNumber: bankInfo.accountNumber,
          bankName: bankInfo.bankName,
          ifscCode: bankInfo.ifscCode,
          registrationDate: new Date(),
          status: 'pending_verification',
          verificationToken: uuidv4()
        }
      });

      // Process documents if provided
      if (documents.length > 0) {
        await this.processFarmerDocuments(farmer.id, documents);
      }

      // Create land records
      if (landInfo.landRecords && landInfo.landRecords.length > 0) {
        await this.createLandRecords(farmer.id, landInfo.landRecords);
      }

      return {
        success: true,
        farmer: {
          id: farmer.id,
          name: farmer.name,
          mobileNumber: farmer.mobileNumber,
          status: farmer.status,
          registrationDate: farmer.registrationDate
        }
      };
    } catch (error) {
      console.error('Farmer registration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processFarmerDocuments(farmerId, documents) {
    try {
      const documentRecords = documents.map(doc => ({
        farmerId,
        documentType: doc.type,
        documentNumber: doc.number,
        fileName: doc.fileName,
        filePath: doc.filePath,
        uploadedAt: new Date(),
        status: 'pending_verification'
      }));

      await this.prisma.farmerDocument.createMany({
        data: documentRecords
      });

      return {
        success: true,
        message: `${documents.length} documents processed successfully`
      };
    } catch (error) {
      console.error('Document processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createLandRecords(farmerId, landRecords) {
    try {
      const records = landRecords.map(land => ({
        farmerId,
        surveyNumber: land.surveyNumber,
        area: land.area,
        unit: land.unit || 'acres',
        soilType: land.soilType,
        irrigationSource: land.irrigationSource,
        ownershipType: land.ownershipType,
        coordinates: land.coordinates,
        createdAt: new Date()
      }));

      await this.prisma.landRecord.createMany({
        data: records
      });

      return {
        success: true,
        message: `${landRecords.length} land records created successfully`
      };
    } catch (error) {
      console.error('Land record creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async verifyFarmer(farmerId, verificationData) {
    try {
      const {
        documentsVerified = false,
        landVerified = false,
        bankVerified = false,
        verificationNotes = '',
        verifiedBy
      } = verificationData;

      // Update farmer status
      const farmer = await this.prisma.farmer.update({
        where: { id: farmerId },
        data: {
          status: documentsVerified && landVerified && bankVerified ? 'verified' : 'pending_verification',
          verifiedAt: new Date(),
          verifiedBy
        }
      });

      // Update document verification status
      if (documentsVerified) {
        await this.prisma.farmerDocument.updateMany({
          where: { farmerId },
          data: { 
            status: 'verified',
            verifiedAt: new Date(),
            verifiedBy
          }
        });
      }

      // Create verification record
      await this.prisma.farmerVerification.create({
        data: {
          farmerId,
          documentsVerified,
          landVerified,
          bankVerified,
          verificationNotes,
          verifiedBy,
          verifiedAt: new Date()
        }
      });

      return {
        success: true,
        farmer: {
          id: farmer.id,
          name: farmer.name,
          status: farmer.status,
          verifiedAt: farmer.verifiedAt
        }
      };
    } catch (error) {
      console.error('Farmer verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getFarmerProfile(farmerId) {
    try {
      const farmer = await this.prisma.farmer.findUnique({
        where: { id: farmerId },
        include: {
          documents: true,
          landRecords: true,
          verifications: {
            orderBy: { verifiedAt: 'desc' },
            take: 1
          }
        }
      });

      if (!farmer) {
        throw new Error('Farmer not found');
      }

      return {
        success: true,
        farmer: {
          id: farmer.id,
          personalInfo: {
            name: farmer.name,
            aadhaarNumber: farmer.aadhaarNumber,
            panNumber: farmer.panNumber,
            dateOfBirth: farmer.dateOfBirth,
            gender: farmer.gender,
            fatherName: farmer.fatherName,
            motherName: farmer.motherName
          },
          contactInfo: {
            mobileNumber: farmer.mobileNumber,
            email: farmer.email,
            address: farmer.address,
            village: farmer.village,
            district: farmer.district,
            state: farmer.state,
            pincode: farmer.pincode
          },
          landInfo: {
            totalArea: farmer.landArea,
            landType: farmer.landType,
            irrigationType: farmer.irrigationType,
            landRecords: farmer.landRecords
          },
          bankInfo: {
            accountNumber: farmer.bankAccountNumber,
            bankName: farmer.bankName,
            ifscCode: farmer.ifscCode
          },
          status: farmer.status,
          registrationDate: farmer.registrationDate,
          verifiedAt: farmer.verifiedAt,
          documents: farmer.documents,
          verification: farmer.verifications[0] || null
        }
      };
    } catch (error) {
      console.error('Farmer profile fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateFarmerProfile(farmerId, updateData) {
    try {
      const {
        personalInfo,
        contactInfo,
        landInfo,
        bankInfo
      } = updateData;

      const updateFields = {};

      if (personalInfo) {
        Object.assign(updateFields, {
          name: personalInfo.name,
          panNumber: personalInfo.panNumber,
          dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : undefined,
          gender: personalInfo.gender,
          fatherName: personalInfo.fatherName,
          motherName: personalInfo.motherName
        });
      }

      if (contactInfo) {
        Object.assign(updateFields, {
          mobileNumber: contactInfo.mobile,
          email: contactInfo.email,
          address: contactInfo.address,
          village: contactInfo.village,
          district: contactInfo.district,
          state: contactInfo.state,
          pincode: contactInfo.pincode
        });
      }

      if (landInfo) {
        Object.assign(updateFields, {
          landArea: landInfo.totalArea,
          landType: landInfo.type,
          irrigationType: landInfo.irrigationType
        });
      }

      if (bankInfo) {
        Object.assign(updateFields, {
          bankAccountNumber: bankInfo.accountNumber,
          bankName: bankInfo.bankName,
          ifscCode: bankInfo.ifscCode
        });
      }

      updateFields.updatedAt = new Date();

      const farmer = await this.prisma.farmer.update({
        where: { id: farmerId },
        data: updateFields
      });

      return {
        success: true,
        farmer: {
          id: farmer.id,
          name: farmer.name,
          updatedAt: farmer.updatedAt
        }
      };
    } catch (error) {
      console.error('Farmer profile update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchFarmers(searchCriteria) {
    try {
      const {
        name,
        mobileNumber,
        aadhaarNumber,
        village,
        district,
        state,
        status,
        limit = 50,
        offset = 0
      } = searchCriteria;

      const where = {};

      if (name) {
        where.name = { contains: name, mode: 'insensitive' };
      }
      if (mobileNumber) {
        where.mobileNumber = { contains: mobileNumber };
      }
      if (aadhaarNumber) {
        where.aadhaarNumber = { contains: aadhaarNumber };
      }
      if (village) {
        where.village = { contains: village, mode: 'insensitive' };
      }
      if (district) {
        where.district = { contains: district, mode: 'insensitive' };
      }
      if (state) {
        where.state = { contains: state, mode: 'insensitive' };
      }
      if (status) {
        where.status = status;
      }

      const farmers = await this.prisma.farmer.findMany({
        where,
        select: {
          id: true,
          name: true,
          mobileNumber: true,
          aadhaarNumber: true,
          village: true,
          district: true,
          state: true,
          status: true,
          registrationDate: true,
          landArea: true
        },
        orderBy: { registrationDate: 'desc' },
        take: limit,
        skip: offset
      });

      const totalCount = await this.prisma.farmer.count({ where });

      return {
        success: true,
        farmers,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      };
    } catch (error) {
      console.error('Farmer search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getFarmerStatistics() {
    try {
      const totalFarmers = await this.prisma.farmer.count();
      const verifiedFarmers = await this.prisma.farmer.count({ where: { status: 'verified' } });
      const pendingFarmers = await this.prisma.farmer.count({ where: { status: 'pending_verification' } });

      // Get farmers by state
      const farmersByState = await this.prisma.farmer.groupBy({
        by: ['state'],
        _count: { state: true },
        orderBy: { _count: { state: 'desc' } }
      });

      // Get farmers by district
      const farmersByDistrict = await this.prisma.farmer.groupBy({
        by: ['district'],
        _count: { district: true },
        orderBy: { _count: { district: 'desc' } },
        take: 10
      });

      // Get registration trends (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const registrationTrends = await this.prisma.farmer.groupBy({
        by: ['registrationDate'],
        _count: { registrationDate: true },
        where: {
          registrationDate: { gte: twelveMonthsAgo }
        },
        orderBy: { registrationDate: 'asc' }
      });

      return {
        success: true,
        statistics: {
          totalFarmers,
          verifiedFarmers,
          pendingFarmers,
          verificationRate: totalFarmers > 0 ? Math.round((verifiedFarmers / totalFarmers) * 100) : 0,
          farmersByState: farmersByState.map(item => ({
            state: item.state,
            count: item._count.state
          })),
          farmersByDistrict: farmersByDistrict.map(item => ({
            district: item.district,
            count: item._count.district
          })),
          registrationTrends: registrationTrends.map(item => ({
            month: item.registrationDate.toISOString().substring(0, 7),
            count: item._count.registrationDate
          }))
        }
      };
    } catch (error) {
      console.error('Farmer statistics fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addCropRecord(farmerId, cropData) {
    try {
      const {
        cropType,
        variety,
        plantingDate,
        area,
        location,
        expectedHarvestDate,
        soilData = {},
        irrigationData = {}
      } = cropData;

      const cropRecord = await this.prisma.cropRecord.create({
        data: {
          farmerId,
          cropType,
          variety,
          plantingDate: new Date(plantingDate),
          area,
          location,
          expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : null,
          soilData,
          irrigationData,
          status: 'planted',
          createdAt: new Date()
        }
      });

      return {
        success: true,
        cropRecord: {
          id: cropRecord.id,
          cropType: cropRecord.cropType,
          variety: cropRecord.variety,
          area: cropRecord.area,
          status: cropRecord.status,
          plantingDate: cropRecord.plantingDate
        }
      };
    } catch (error) {
      console.error('Crop record creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getFarmerCrops(farmerId, status = null) {
    try {
      const where = { farmerId };
      if (status) {
        where.status = status;
      }

      const crops = await this.prisma.cropRecord.findMany({
        where,
        orderBy: { plantingDate: 'desc' }
      });

      return {
        success: true,
        crops: crops.map(crop => ({
          id: crop.id,
          cropType: crop.cropType,
          variety: crop.variety,
          area: crop.area,
          location: crop.location,
          plantingDate: crop.plantingDate,
          expectedHarvestDate: crop.expectedHarvestDate,
          status: crop.status,
          createdAt: crop.createdAt
        }))
      };
    } catch (error) {
      console.error('Farmer crops fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateCropStatus(cropId, status, updateData = {}) {
    try {
      const updateFields = {
        status,
        updatedAt: new Date()
      };

      if (updateData.harvestDate) {
        updateFields.harvestDate = new Date(updateData.harvestDate);
      }
      if (updateData.yield) {
        updateFields.actualYield = updateData.yield;
      }
      if (updateData.notes) {
        updateFields.notes = updateData.notes;
      }

      const crop = await this.prisma.cropRecord.update({
        where: { id: cropId },
        data: updateFields
      });

      return {
        success: true,
        crop: {
          id: crop.id,
          cropType: crop.cropType,
          status: crop.status,
          updatedAt: crop.updatedAt
        }
      };
    } catch (error) {
      console.error('Crop status update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = FarmerManagementService;
