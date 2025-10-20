const axios = require('axios');

class AgriculturalFinancialService {
  constructor(prisma) {
    this.prisma = prisma;
    this.creditScoringFactors = {
      personal: ['age', 'education', 'experience'],
      financial: ['income', 'assets', 'liabilities', 'credit_history'],
      agricultural: ['land_area', 'crop_yield', 'irrigation_facility', 'equipment'],
      behavioral: ['payment_history', 'loan_repayment', 'insurance_claims']
    };
    
    this.loanProducts = {
      'crop_loan': {
        name: 'Crop Loan',
        maxAmount: 500000,
        interestRate: 7.5,
        tenure: 12,
        purpose: 'Seasonal agricultural activities'
      },
      'equipment_loan': {
        name: 'Equipment Loan',
        maxAmount: 2000000,
        interestRate: 9.0,
        tenure: 36,
        purpose: 'Purchase of agricultural equipment'
      },
      'irrigation_loan': {
        name: 'Irrigation Loan',
        maxAmount: 1000000,
        interestRate: 8.0,
        tenure: 24,
        purpose: 'Irrigation infrastructure development'
      },
      'storage_loan': {
        name: 'Storage Loan',
        maxAmount: 1500000,
        interestRate: 8.5,
        tenure: 30,
        purpose: 'Storage facility construction'
      }
    };
  }

  async calculateCreditScore(farmerId) {
    try {
      const farmer = await this.prisma.farmer.findUnique({
        where: { id: farmerId },
        include: {
          landRecords: true,
          cropRecords: true,
          loanApplications: true,
          insuranceClaims: true
        }
      });

      if (!farmer) {
        throw new Error('Farmer not found');
      }

      let totalScore = 0;
      const scoreBreakdown = {};

      // Personal factors (20 points)
      const personalScore = this.calculatePersonalScore(farmer);
      totalScore += personalScore;
      scoreBreakdown.personal = personalScore;

      // Financial factors (30 points)
      const financialScore = await this.calculateFinancialScore(farmer);
      totalScore += financialScore;
      scoreBreakdown.financial = financialScore;

      // Agricultural factors (30 points)
      const agriculturalScore = this.calculateAgriculturalScore(farmer);
      totalScore += agriculturalScore;
      scoreBreakdown.agricultural = agriculturalScore;

      // Behavioral factors (20 points)
      const behavioralScore = await this.calculateBehavioralScore(farmer);
      totalScore += behavioralScore;
      scoreBreakdown.behavioral = behavioralScore;

      // Determine credit rating
      const creditRating = this.determineCreditRating(totalScore);

      // Store credit score
      const creditScore = await this.prisma.creditScore.create({
        data: {
          farmerId,
          score: totalScore,
          rating: creditRating,
          breakdown: scoreBreakdown,
          calculatedAt: new Date(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }
      });

      return {
        success: true,
        creditScore: {
          id: creditScore.id,
          farmerId,
          score: totalScore,
          rating: creditRating,
          breakdown: scoreBreakdown,
          calculatedAt: creditScore.calculatedAt,
          validUntil: creditScore.validUntil
        }
      };
    } catch (error) {
      console.error('Credit score calculation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculatePersonalScore(farmer) {
    let score = 0;

    // Age factor (0-5 points)
    if (farmer.dateOfBirth) {
      const age = new Date().getFullYear() - new Date(farmer.dateOfBirth).getFullYear();
      if (age >= 25 && age <= 55) score += 5;
      else if (age >= 20 && age <= 60) score += 3;
      else score += 1;
    }

    // Education factor (0-5 points)
    // Assuming education level is stored in farmer profile
    const educationLevel = farmer.educationLevel || 'primary';
    const educationScores = {
      'post_graduate': 5,
      'graduate': 4,
      'higher_secondary': 3,
      'secondary': 2,
      'primary': 1,
      'illiterate': 0
    };
    score += educationScores[educationLevel] || 0;

    // Experience factor (0-10 points)
    const experienceYears = farmer.farmingExperience || 0;
    if (experienceYears >= 10) score += 10;
    else if (experienceYears >= 5) score += 7;
    else if (experienceYears >= 2) score += 4;
    else score += 1;

    return Math.min(20, score);
  }

  async calculateFinancialScore(farmer) {
    let score = 0;

    // Income factor (0-10 points)
    const annualIncome = farmer.annualIncome || 0;
    if (annualIncome >= 500000) score += 10;
    else if (annualIncome >= 300000) score += 7;
    else if (annualIncome >= 150000) score += 4;
    else if (annualIncome >= 50000) score += 2;

    // Asset factor (0-10 points)
    const totalAssets = farmer.totalAssets || 0;
    if (totalAssets >= 1000000) score += 10;
    else if (totalAssets >= 500000) score += 7;
    else if (totalAssets >= 200000) score += 4;
    else if (totalAssets >= 50000) score += 2;

    // Liability factor (0-5 points)
    const totalLiabilities = farmer.totalLiabilities || 0;
    const debtToIncomeRatio = annualIncome > 0 ? totalLiabilities / annualIncome : 1;
    if (debtToIncomeRatio <= 0.3) score += 5;
    else if (debtToIncomeRatio <= 0.5) score += 3;
    else if (debtToIncomeRatio <= 0.7) score += 1;

    // Credit history factor (0-5 points)
    const creditHistory = await this.getCreditHistory(farmer.id);
    if (creditHistory.excellent) score += 5;
    else if (creditHistory.good) score += 3;
    else if (creditHistory.fair) score += 1;

    return Math.min(30, score);
  }

  calculateAgriculturalScore(farmer) {
    let score = 0;

    // Land area factor (0-10 points)
    const landArea = farmer.landArea || 0;
    if (landArea >= 10) score += 10;
    else if (landArea >= 5) score += 7;
    else if (landArea >= 2) score += 4;
    else if (landArea >= 1) score += 2;

    // Crop yield factor (0-10 points)
    const averageYield = this.calculateAverageYield(farmer.cropRecords);
    if (averageYield >= 3000) score += 10;
    else if (averageYield >= 2000) score += 7;
    else if (averageYield >= 1500) score += 4;
    else if (averageYield >= 1000) score += 2;

    // Irrigation factor (0-5 points)
    const irrigationType = farmer.irrigationType;
    const irrigationScores = {
      'canal': 5,
      'tube_well': 4,
      'well': 3,
      'rainfed': 1
    };
    score += irrigationScores[irrigationType] || 0;

    // Equipment factor (0-5 points)
    const equipmentValue = farmer.equipmentValue || 0;
    if (equipmentValue >= 200000) score += 5;
    else if (equipmentValue >= 100000) score += 3;
    else if (equipmentValue >= 50000) score += 1;

    return Math.min(30, score);
  }

  async calculateBehavioralScore(farmer) {
    let score = 0;

    // Payment history factor (0-10 points)
    const paymentHistory = await this.getPaymentHistory(farmer.id);
    if (paymentHistory.excellent) score += 10;
    else if (paymentHistory.good) score += 7;
    else if (paymentHistory.fair) score += 4;
    else if (paymentHistory.poor) score += 1;

    // Loan repayment factor (0-5 points)
    const loanRepayment = await this.getLoanRepaymentHistory(farmer.id);
    if (loanRepayment.excellent) score += 5;
    else if (loanRepayment.good) score += 3;
    else if (loanRepayment.fair) score += 1;

    // Insurance claims factor (0-5 points)
    const insuranceHistory = await this.getInsuranceHistory(farmer.id);
    if (insuranceHistory.noClaims) score += 5;
    else if (insuranceHistory.lowClaims) score += 3;
    else if (insuranceHistory.moderateClaims) score += 1;

    return Math.min(20, score);
  }

  calculateAverageYield(cropRecords) {
    if (!cropRecords || cropRecords.length === 0) return 0;
    
    const yieldsWithData = cropRecords.filter(crop => crop.actualYield && crop.area);
    if (yieldsWithData.length === 0) return 0;
    
    const totalYield = yieldsWithData.reduce((sum, crop) => sum + crop.actualYield, 0);
    const totalArea = yieldsWithData.reduce((sum, crop) => sum + crop.area, 0);
    
    return totalArea > 0 ? totalYield / totalArea : 0;
  }

  async getCreditHistory(farmerId) {
    // Mock credit history - in production, this would fetch from credit bureau
    return {
      excellent: Math.random() > 0.7,
      good: Math.random() > 0.5,
      fair: Math.random() > 0.3,
      poor: Math.random() > 0.1
    };
  }

  async getPaymentHistory(farmerId) {
    // Mock payment history
    return {
      excellent: Math.random() > 0.6,
      good: Math.random() > 0.4,
      fair: Math.random() > 0.2,
      poor: Math.random() > 0.1
    };
  }

  async getLoanRepaymentHistory(farmerId) {
    // Mock loan repayment history
    return {
      excellent: Math.random() > 0.7,
      good: Math.random() > 0.5,
      fair: Math.random() > 0.3,
      poor: Math.random() > 0.1
    };
  }

  async getInsuranceHistory(farmerId) {
    // Mock insurance history
    return {
      noClaims: Math.random() > 0.5,
      lowClaims: Math.random() > 0.3,
      moderateClaims: Math.random() > 0.1,
      highClaims: Math.random() > 0.05
    };
  }

  determineCreditRating(score) {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 35) return 'poor';
    return 'very_poor';
  }

  async processLoanApplication(farmerId, loanData) {
    try {
      const {
        loanType,
        amount,
        purpose,
        tenure,
        collateral = {}
      } = loanData;

      // Validate loan type
      if (!this.loanProducts[loanType]) {
        throw new Error('Invalid loan type');
      }

      const loanProduct = this.loanProducts[loanType];
      
      // Validate amount
      if (amount > loanProduct.maxAmount) {
        throw new Error(`Amount exceeds maximum limit of ${loanProduct.maxAmount}`);
      }

      // Get farmer's credit score
      const creditScoreResult = await this.calculateCreditScore(farmerId);
      if (!creditScoreResult.success) {
        throw new Error('Failed to calculate credit score');
      }

      const creditScore = creditScoreResult.creditScore;

      // Determine loan eligibility
      const eligibility = this.determineLoanEligibility(creditScore, amount, loanType);

      if (!eligibility.eligible) {
        return {
          success: false,
          error: eligibility.reason,
          creditScore: creditScore.score,
          rating: creditScore.rating
        };
      }

      // Calculate loan terms
      const loanTerms = this.calculateLoanTerms(creditScore, amount, loanType, tenure);

      // Create loan application
      const loanApplication = await this.prisma.loanApplication.create({
        data: {
          farmerId,
          loanType,
          amount,
          purpose,
          tenure: tenure || loanTerms.tenure,
          interestRate: loanTerms.interestRate,
          monthlyEMI: loanTerms.monthlyEMI,
          collateral: collateral,
          status: 'pending_approval',
          creditScore: creditScore.score,
          creditRating: creditScore.rating,
          appliedAt: new Date()
        }
      });

      return {
        success: true,
        loanApplication: {
          id: loanApplication.id,
          loanType,
          amount,
          tenure: loanApplication.tenure,
          interestRate: loanApplication.interestRate,
          monthlyEMI: loanApplication.monthlyEMI,
          status: loanApplication.status,
          creditScore: creditScore.score,
          rating: creditScore.rating,
          appliedAt: loanApplication.appliedAt
        }
      };
    } catch (error) {
      console.error('Loan application processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  determineLoanEligibility(creditScore, amount, loanType) {
    const { score, rating } = creditScore;
    
    // Base eligibility criteria
    if (score < 30) {
      return { eligible: false, reason: 'Credit score too low (minimum 30 required)' };
    }

    // Loan type specific criteria
    const loanProduct = this.loanProducts[loanType];
    
    if (rating === 'very_poor' && amount > loanProduct.maxAmount * 0.3) {
      return { eligible: false, reason: 'High risk borrower - amount limit exceeded' };
    }

    if (rating === 'poor' && amount > loanProduct.maxAmount * 0.5) {
      return { eligible: false, reason: 'Poor credit rating - amount limit exceeded' };
    }

    return { eligible: true, reason: 'Loan application eligible for processing' };
  }

  calculateLoanTerms(creditScore, amount, loanType, requestedTenure) {
    const loanProduct = this.loanProducts[loanType];
    const { score, rating } = creditScore;
    
    // Calculate interest rate based on credit score
    let interestRate = loanProduct.interestRate;
    
    if (rating === 'excellent') {
      interestRate -= 1.0; // 1% discount
    } else if (rating === 'good') {
      interestRate -= 0.5; // 0.5% discount
    } else if (rating === 'poor') {
      interestRate += 1.0; // 1% premium
    } else if (rating === 'very_poor') {
      interestRate += 2.0; // 2% premium
    }

    // Determine tenure
    const tenure = requestedTenure || loanProduct.tenure;
    
    // Calculate monthly EMI
    const monthlyEMI = this.calculateEMI(amount, interestRate, tenure);

    return {
      interestRate: Math.round(interestRate * 100) / 100,
      tenure,
      monthlyEMI: Math.round(monthlyEMI * 100) / 100
    };
  }

  calculateEMI(principal, annualRate, tenureMonths) {
    const monthlyRate = annualRate / 100 / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / 
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return emi;
  }

  async processInsuranceClaim(farmerId, claimData) {
    try {
      const {
        policyNumber,
        cropType,
        damageType,
        damageArea,
        damagePercentage,
        incidentDate,
        description,
        supportingDocuments = []
      } = claimData;

      // Validate claim data
      if (!policyNumber || !cropType || !damageType || !damageArea || !damagePercentage) {
        throw new Error('Missing required claim information');
      }

      // Get policy details
      const policy = await this.prisma.insurancePolicy.findFirst({
        where: { policyNumber, farmerId }
      });

      if (!policy) {
        throw new Error('Insurance policy not found');
      }

      if (policy.status !== 'active') {
        throw new Error('Insurance policy is not active');
      }

      // Calculate claim amount
      const claimAmount = this.calculateClaimAmount(policy, damageArea, damagePercentage);

      // Create insurance claim
      const insuranceClaim = await this.prisma.insuranceClaim.create({
        data: {
          farmerId,
          policyNumber,
          cropType,
          damageType,
          damageArea,
          damagePercentage,
          claimAmount,
          incidentDate: new Date(incidentDate),
          description,
          supportingDocuments,
          status: 'pending_assessment',
          filedAt: new Date()
        }
      });

      // Trigger automated assessment
      const assessment = await this.performAutomatedAssessment(insuranceClaim);

      return {
        success: true,
        claim: {
          id: insuranceClaim.id,
          policyNumber,
          cropType,
          damageType,
          damageArea,
          damagePercentage,
          claimAmount,
          status: insuranceClaim.status,
          filedAt: insuranceClaim.filedAt
        },
        assessment
      };
    } catch (error) {
      console.error('Insurance claim processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateClaimAmount(policy, damageArea, damagePercentage) {
    const insuredAmount = policy.sumInsured;
    const areaCovered = policy.areaCovered;
    
    // Calculate proportional damage
    const proportionalDamage = (damageArea / areaCovered) * (damagePercentage / 100);
    
    // Calculate claim amount
    const claimAmount = insuredAmount * proportionalDamage;
    
    return Math.round(claimAmount * 100) / 100;
  }

  async performAutomatedAssessment(claim) {
    try {
      // Mock automated assessment using AI/satellite data
      const assessmentScore = Math.random() * 100;
      
      let assessmentResult = 'approved';
      let confidence = 85;
      
      if (assessmentScore < 30) {
        assessmentResult = 'rejected';
        confidence = 90;
      } else if (assessmentScore < 60) {
        assessmentResult = 'requires_manual_review';
        confidence = 70;
      }

      // Update claim status
      await this.prisma.insuranceClaim.update({
        where: { id: claim.id },
        data: {
          status: assessmentResult,
          assessmentScore,
          confidence,
          assessedAt: new Date()
        }
      });

      return {
        assessmentResult,
        assessmentScore: Math.round(assessmentScore * 100) / 100,
        confidence,
        automated: true
      };
    } catch (error) {
      console.error('Automated assessment failed:', error);
      return {
        assessmentResult: 'requires_manual_review',
        assessmentScore: 0,
        confidence: 0,
        automated: false,
        error: error.message
      };
    }
  }

  async getFinancialDashboard(farmerId) {
    try {
      // Get farmer's financial summary
      const farmer = await this.prisma.farmer.findUnique({
        where: { id: farmerId },
        include: {
          creditScores: {
            orderBy: { calculatedAt: 'desc' },
            take: 1
          },
          loanApplications: {
            orderBy: { appliedAt: 'desc' },
            take: 5
          },
          insuranceClaims: {
            orderBy: { filedAt: 'desc' },
            take: 5
          }
        }
      });

      if (!farmer) {
        throw new Error('Farmer not found');
      }

      // Calculate financial metrics
      const totalLoans = farmer.loanApplications.reduce((sum, loan) => sum + loan.amount, 0);
      const activeLoans = farmer.loanApplications.filter(loan => 
        ['approved', 'disbursed'].includes(loan.status)
      );
      const totalActiveLoanAmount = activeLoans.reduce((sum, loan) => sum + loan.amount, 0);

      const totalClaims = farmer.insuranceClaims.reduce((sum, claim) => sum + claim.claimAmount, 0);
      const approvedClaims = farmer.insuranceClaims.filter(claim => claim.status === 'approved');
      const totalApprovedClaimAmount = approvedClaims.reduce((sum, claim) => sum + claim.claimAmount, 0);

      const currentCreditScore = farmer.creditScores[0];

      return {
        success: true,
        dashboard: {
          farmer: {
            id: farmer.id,
            name: farmer.name,
            annualIncome: farmer.annualIncome,
            totalAssets: farmer.totalAssets,
            totalLiabilities: farmer.totalLiabilities
          },
          creditScore: currentCreditScore ? {
            score: currentCreditScore.score,
            rating: currentCreditScore.rating,
            calculatedAt: currentCreditScore.calculatedAt,
            validUntil: currentCreditScore.validUntil
          } : null,
          loans: {
            totalApplications: farmer.loanApplications.length,
            totalAmount: totalLoans,
            activeLoans: activeLoans.length,
            activeAmount: totalActiveLoanAmount,
            recentApplications: farmer.loanApplications.slice(0, 3)
          },
          insurance: {
            totalClaims: farmer.insuranceClaims.length,
            totalClaimAmount: totalClaims,
            approvedClaims: approvedClaims.length,
            approvedAmount: totalApprovedClaimAmount,
            recentClaims: farmer.insuranceClaims.slice(0, 3)
          }
        }
      };
    } catch (error) {
      console.error('Financial dashboard fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AgriculturalFinancialService;
