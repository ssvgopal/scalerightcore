const { PrismaClient } = require('@prisma/client');

class AnalyticsService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // ===== FARMER ANALYTICS =====

  async getFarmerAnalytics(organizationId, options = {}) {
    try {
      const dateFrom = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const dateTo = options.dateTo ? new Date(options.dateTo) : new Date();

      // Total farmers
      const totalFarmers = await this.prisma.farmerProfile.count({
        where: { organizationId }
      });

      // New farmers in period
      const newFarmers = await this.prisma.farmerProfile.count({
        where: {
          organizationId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        }
      });

      // Active farmers (with recent activity)
      const activeFarmers = await this.prisma.farmerProfile.count({
        where: {
          organizationId,
          crops: {
            some: {
              updatedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Active in last 7 days
              }
            }
          }
        }
      });

      // Farmers by region
      const farmersByRegion = await this.prisma.farmerProfile.groupBy({
        by: ['region'],
        where: { organizationId },
        _count: {
          id: true
        }
      });

      // Farmers with crops
      const farmersWithCrops = await this.prisma.farmerProfile.count({
        where: {
          organizationId,
          crops: {
            some: {}
          }
        }
      });

      // Farmers with financial services
      const farmersWithLoans = await this.prisma.farmerProfile.count({
        where: {
          organizationId,
          loanApplications: {
            some: {}
          }
        }
      });

      const farmersWithInsurance = await this.prisma.farmerProfile.count({
        where: {
          organizationId,
          insurancePolicies: {
            some: {}
          }
        }
      });

      // Farmer engagement metrics
      const farmerEngagement = await this.prisma.farmerProfile.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          region: true,
          createdAt: true,
          crops: {
            select: {
              id: true,
              name: true,
              status: true,
              updatedAt: true
            }
          },
          loanApplications: {
            select: {
              id: true,
              amount: true,
              status: true,
              createdAt: true
            }
          },
          insurancePolicies: {
            select: {
              id: true,
              sumInsured: true,
              status: true,
              createdAt: true
            }
          }
        }
      });

      // Calculate engagement scores
      const engagementScores = farmerEngagement.map(farmer => {
        const cropCount = farmer.crops.length;
        const activeCrops = farmer.crops.filter(crop => crop.status === 'growing').length;
        const loanCount = farmer.loanApplications.length;
        const insuranceCount = farmer.insurancePolicies.length;
        
        // Simple engagement score calculation
        const score = (cropCount * 2) + (activeCrops * 3) + (loanCount * 1) + (insuranceCount * 1);
        
        return {
          farmerId: farmer.id,
          name: farmer.name,
          region: farmer.region,
          engagementScore: score,
          cropCount,
          activeCrops,
          loanCount,
          insuranceCount,
          joinedAt: farmer.createdAt
        };
      });

      return {
        overview: {
          totalFarmers,
          newFarmers,
          activeFarmers,
          farmersWithCrops,
          farmersWithLoans,
          farmersWithInsurance,
          engagementRate: totalFarmers > 0 ? (activeFarmers / totalFarmers * 100).toFixed(2) : 0
        },
        distribution: {
          byRegion: farmersByRegion.map(item => ({
            region: item.region,
            count: item._count.id,
            percentage: totalFarmers > 0 ? ((item._count.id / totalFarmers) * 100).toFixed(2) : 0
          }))
        },
        engagement: {
          topFarmers: engagementScores
            .sort((a, b) => b.engagementScore - a.engagementScore)
            .slice(0, 10),
          averageEngagement: engagementScores.length > 0 
            ? (engagementScores.reduce((sum, f) => sum + f.engagementScore, 0) / engagementScores.length).toFixed(2)
            : 0
        },
        period: {
          from: dateFrom,
          to: dateTo
        }
      };
    } catch (error) {
      console.error('Failed to get farmer analytics:', error);
      throw error;
    }
  }

  // ===== CROP ANALYTICS =====

  async getCropAnalytics(organizationId, options = {}) {
    try {
      const dateFrom = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = options.dateTo ? new Date(options.dateTo) : new Date();

      // Total crops
      const totalCrops = await this.prisma.crop.count({
        where: {
          farmer: {
            organizationId
          }
        }
      });

      // Crops by status
      const cropsByStatus = await this.prisma.crop.groupBy({
        by: ['status'],
        where: {
          farmer: {
            organizationId
          }
        },
        _count: {
          id: true
        }
      });

      // Crops by type
      const cropsByType = await this.prisma.crop.groupBy({
        by: ['name'],
        where: {
          farmer: {
            organizationId
          }
        },
        _count: {
          id: true
        },
        _avg: {
          yield: true
        }
      });

      // Yield analytics
      const yieldAnalytics = await this.prisma.crop.aggregate({
        where: {
          farmer: {
            organizationId
          },
          yield: {
            not: null
          }
        },
        _avg: {
          yield: true
        },
        _max: {
          yield: true
        },
        _min: {
          yield: true
        },
        _count: {
          yield: true
        }
      });

      // Crop health analytics
      const healthAnalytics = await this.prisma.cropHealthRecord.groupBy({
        by: ['healthScore'],
        where: {
          crop: {
            farmer: {
              organizationId
            }
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        _count: {
          id: true
        }
      });

      // Seasonal trends
      const seasonalTrends = await this.prisma.crop.findMany({
        where: {
          farmer: {
            organizationId
          },
          plantingDate: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        select: {
          name: true,
          plantingDate: true,
          harvestDate: true,
          yield: true,
          status: true
        }
      });

      // Calculate seasonal data
      const monthlyData = {};
      seasonalTrends.forEach(crop => {
        const month = new Date(crop.plantingDate).getMonth();
        if (!monthlyData[month]) {
          monthlyData[month] = {
            planted: 0,
            harvested: 0,
            totalYield: 0,
            crops: []
          };
        }
        monthlyData[month].planted++;
        if (crop.status === 'harvested') {
          monthlyData[month].harvested++;
          if (crop.yield) {
            monthlyData[month].totalYield += crop.yield;
          }
        }
        monthlyData[month].crops.push(crop.name);
      });

      return {
        overview: {
          totalCrops,
          averageYield: yieldAnalytics._avg.yield ? yieldAnalytics._avg.yield.toFixed(2) : 0,
          maxYield: yieldAnalytics._max.yield || 0,
          minYield: yieldAnalytics._min.yield || 0,
          cropsWithYield: yieldAnalytics._count.yield
        },
        distribution: {
          byStatus: cropsByStatus.map(item => ({
            status: item.status,
            count: item._count.id,
            percentage: totalCrops > 0 ? ((item._count.id / totalCrops) * 100).toFixed(2) : 0
          })),
          byType: cropsByType.map(item => ({
            cropType: item.name,
            count: item._count.id,
            averageYield: item._avg.yield ? item._avg.yield.toFixed(2) : 0,
            percentage: totalCrops > 0 ? ((item._count.id / totalCrops) * 100).toFixed(2) : 0
          }))
        },
        health: {
          healthDistribution: healthAnalytics.map(item => ({
            healthScore: item.healthScore,
            count: item._count.id
          })),
          averageHealth: healthAnalytics.length > 0 
            ? (healthAnalytics.reduce((sum, h) => sum + (h.healthScore * h._count.id), 0) / 
               healthAnalytics.reduce((sum, h) => sum + h._count.id, 0)).toFixed(2)
            : 0
        },
        seasonal: {
          monthlyTrends: Object.keys(monthlyData).map(month => ({
            month: parseInt(month),
            monthName: new Date(0, month).toLocaleString('default', { month: 'long' }),
            planted: monthlyData[month].planted,
            harvested: monthlyData[month].harvested,
            totalYield: monthlyData[month].totalYield,
            averageYield: monthlyData[month].harvested > 0 
              ? (monthlyData[month].totalYield / monthlyData[month].harvested).toFixed(2)
              : 0,
            harvestRate: monthlyData[month].planted > 0 
              ? ((monthlyData[month].harvested / monthlyData[month].planted) * 100).toFixed(2)
              : 0
          }))
        },
        period: {
          from: dateFrom,
          to: dateTo
        }
      };
    } catch (error) {
      console.error('Failed to get crop analytics:', error);
      throw error;
    }
  }

  // ===== MARKET ANALYTICS =====

  async getMarketAnalytics(organizationId, options = {}) {
    try {
      const dateFrom = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = options.dateTo ? new Date(options.dateTo) : new Date();

      // Market alerts analytics
      const marketAlerts = await this.prisma.marketAlert.findMany({
        where: {
          farmer: {
            organizationId
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        select: {
          cropType: true,
          alertType: true,
          severity: true,
          currentPrice: true,
          previousPrice: true,
          changePercent: true,
          createdAt: true
        }
      });

      // Selling recommendations analytics
      const sellingRecommendations = await this.prisma.sellingRecommendation.findMany({
        where: {
          farmer: {
            organizationId
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        select: {
          cropType: true,
          recommendedPrice: true,
          market: true,
          confidence: true,
          createdAt: true
        }
      });

      // Price trends by crop type
      const priceTrends = {};
      marketAlerts.forEach(alert => {
        if (!priceTrends[alert.cropType]) {
          priceTrends[alert.cropType] = {
            prices: [],
            alerts: [],
            totalChange: 0,
            alertCount: 0
          };
        }
        priceTrends[alert.cropType].prices.push({
          price: alert.currentPrice,
          date: alert.createdAt
        });
        priceTrends[alert.cropType].alerts.push(alert);
        priceTrends[alert.cropType].totalChange += alert.changePercent;
        priceTrends[alert.cropType].alertCount++;
      });

      // Calculate price analytics
      const cropPriceAnalytics = Object.keys(priceTrends).map(cropType => {
        const data = priceTrends[cropType];
        const prices = data.prices.map(p => p.price);
        const averagePrice = prices.length > 0 ? (prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2) : 0;
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const averageChange = data.alertCount > 0 ? (data.totalChange / data.alertCount).toFixed(2) : 0;

        return {
          cropType,
          averagePrice: parseFloat(averagePrice),
          maxPrice,
          minPrice,
          averageChange: parseFloat(averageChange),
          alertCount: data.alertCount,
          priceVolatility: prices.length > 1 ? ((maxPrice - minPrice) / averagePrice * 100).toFixed(2) : 0
        };
      });

      // Market recommendations analytics
      const recommendationAnalytics = sellingRecommendations.reduce((acc, rec) => {
        if (!acc[rec.cropType]) {
          acc[rec.cropType] = {
            recommendations: [],
            totalConfidence: 0,
            count: 0
          };
        }
        acc[rec.cropType].recommendations.push(rec);
        acc[rec.cropType].totalConfidence += rec.confidence;
        acc[rec.cropType].count++;
        return acc;
      }, {});

      const cropRecommendationAnalytics = Object.keys(recommendationAnalytics).map(cropType => {
        const data = recommendationAnalytics[cropType];
        const averageConfidence = data.count > 0 ? (data.totalConfidence / data.count).toFixed(2) : 0;
        const averageRecommendedPrice = data.recommendations.length > 0 
          ? (data.recommendations.reduce((sum, r) => sum + r.recommendedPrice, 0) / data.recommendations.length).toFixed(2)
          : 0;

        return {
          cropType,
          recommendationCount: data.count,
          averageConfidence: parseFloat(averageConfidence),
          averageRecommendedPrice: parseFloat(averageRecommendedPrice),
          markets: [...new Set(data.recommendations.map(r => r.market))]
        };
      });

      // Alert severity distribution
      const alertSeverityDistribution = marketAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {});

      return {
        overview: {
          totalAlerts: marketAlerts.length,
          totalRecommendations: sellingRecommendations.length,
          cropsTracked: Object.keys(priceTrends).length,
          averagePriceChange: marketAlerts.length > 0 
            ? (marketAlerts.reduce((sum, a) => sum + a.changePercent, 0) / marketAlerts.length).toFixed(2)
            : 0
        },
        priceAnalytics: {
          byCrop: cropPriceAnalytics,
          severityDistribution: Object.keys(alertSeverityDistribution).map(severity => ({
            severity,
            count: alertSeverityDistribution[severity],
            percentage: marketAlerts.length > 0 
              ? ((alertSeverityDistribution[severity] / marketAlerts.length) * 100).toFixed(2)
              : 0
          }))
        },
        recommendations: {
          byCrop: cropRecommendationAnalytics,
          averageConfidence: sellingRecommendations.length > 0 
            ? (sellingRecommendations.reduce((sum, r) => sum + r.confidence, 0) / sellingRecommendations.length).toFixed(2)
            : 0
        },
        trends: {
          priceVolatility: cropPriceAnalytics.length > 0 
            ? (cropPriceAnalytics.reduce((sum, c) => sum + parseFloat(c.priceVolatility), 0) / cropPriceAnalytics.length).toFixed(2)
            : 0,
          recommendationAccuracy: cropRecommendationAnalytics.length > 0 
            ? (cropRecommendationAnalytics.reduce((sum, c) => sum + c.averageConfidence, 0) / cropRecommendationAnalytics.length).toFixed(2)
            : 0
        },
        period: {
          from: dateFrom,
          to: dateTo
        }
      };
    } catch (error) {
      console.error('Failed to get market analytics:', error);
      throw error;
    }
  }

  // ===== FINANCIAL ANALYTICS =====

  async getFinancialAnalytics(organizationId, options = {}) {
    try {
      const dateFrom = options.dateFrom ? new Date(options.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateTo = options.dateTo ? new Date(options.dateTo) : new Date();

      // Loan analytics
      const loanAnalytics = await this.prisma.loanApplication.aggregate({
        where: {
          farmer: {
            organizationId
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        },
        _avg: {
          amount: true,
          interestRate: true
        }
      });

      // Insurance analytics
      const insuranceAnalytics = await this.prisma.insurancePolicy.aggregate({
        where: {
          farmer: {
            organizationId
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        _count: {
          id: true
        },
        _sum: {
          sumInsured: true,
          premium: true
        },
        _avg: {
          sumInsured: true,
          premium: true
        }
      });

      // Payment analytics
      const paymentAnalytics = await this.prisma.payment.aggregate({
        where: {
          organizationId,
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        _count: {
          id: true
        },
        _sum: {
          amount: true
        },
        _avg: {
          amount: true
        }
      });

      // Credit score analytics
      const creditScoreAnalytics = await this.prisma.creditScore.groupBy({
        by: ['score'],
        where: {
          farmer: {
            organizationId
          },
          createdAt: {
            gte: dateFrom,
            lte: dateTo
          }
        },
        _count: {
          id: true
        }
      });

      // Financial health distribution
      const creditRanges = {
        excellent: creditScoreAnalytics.filter(c => c.score >= 800).reduce((sum, c) => sum + c._count.id, 0),
        good: creditScoreAnalytics.filter(c => c.score >= 700 && c.score < 800).reduce((sum, c) => sum + c._count.id, 0),
        fair: creditScoreAnalytics.filter(c => c.score >= 600 && c.score < 700).reduce((sum, c) => sum + c._count.id, 0),
        poor: creditScoreAnalytics.filter(c => c.score < 600).reduce((sum, c) => sum + c._count.id, 0)
      };

      return {
        overview: {
          totalLoans: loanAnalytics._count.id,
          totalLoanAmount: loanAnalytics._sum.amount || 0,
          averageLoanAmount: loanAnalytics._avg.amount ? loanAnalytics._avg.amount.toFixed(2) : 0,
          averageInterestRate: loanAnalytics._avg.interestRate ? loanAnalytics._avg.interestRate.toFixed(2) : 0,
          totalInsurance: insuranceAnalytics._count.id,
          totalSumInsured: insuranceAnalytics._sum.sumInsured || 0,
          totalPremiums: insuranceAnalytics._sum.premium || 0,
          totalPayments: paymentAnalytics._count.id,
          totalPaymentAmount: paymentAnalytics._sum.amount || 0
        },
        loans: {
          totalAmount: loanAnalytics._sum.amount || 0,
          averageAmount: loanAnalytics._avg.amount ? loanAnalytics._avg.amount.toFixed(2) : 0,
          averageInterestRate: loanAnalytics._avg.interestRate ? loanAnalytics._avg.interestRate.toFixed(2) : 0,
          applicationCount: loanAnalytics._count.id
        },
        insurance: {
          totalPolicies: insuranceAnalytics._count.id,
          totalSumInsured: insuranceAnalytics._sum.sumInsured || 0,
          totalPremiums: insuranceAnalytics._sum.premium || 0,
          averageSumInsured: insuranceAnalytics._avg.sumInsured ? insuranceAnalytics._avg.sumInsured.toFixed(2) : 0,
          averagePremium: insuranceAnalytics._avg.premium ? insuranceAnalytics._avg.premium.toFixed(2) : 0
        },
        payments: {
          totalTransactions: paymentAnalytics._count.id,
          totalAmount: paymentAnalytics._sum.amount || 0,
          averageAmount: paymentAnalytics._avg.amount ? paymentAnalytics._avg.amount.toFixed(2) : 0
        },
        creditHealth: {
          distribution: Object.keys(creditRanges).map(range => ({
            range,
            count: creditRanges[range],
            percentage: creditScoreAnalytics.length > 0 
              ? ((creditRanges[range] / creditScoreAnalytics.length) * 100).toFixed(2)
              : 0
          })),
          averageScore: creditScoreAnalytics.length > 0 
            ? (creditScoreAnalytics.reduce((sum, c) => sum + (c.score * c._count.id), 0) / 
               creditScoreAnalytics.reduce((sum, c) => sum + c._count.id, 0)).toFixed(2)
            : 0
        },
        period: {
          from: dateFrom,
          to: dateTo
        }
      };
    } catch (error) {
      console.error('Failed to get financial analytics:', error);
      throw error;
    }
  }

  // ===== CUSTOM REPORTS =====

  async generateCustomReport(organizationId, reportConfig) {
    try {
      const { type, dateFrom, dateTo, filters, groupBy, metrics } = reportConfig;
      
      let reportData = {};

      switch (type) {
        case 'farmer':
          reportData = await this.getFarmerAnalytics(organizationId, { dateFrom, dateTo });
          break;
        case 'crop':
          reportData = await this.getCropAnalytics(organizationId, { dateFrom, dateTo });
          break;
        case 'market':
          reportData = await this.getMarketAnalytics(organizationId, { dateFrom, dateTo });
          break;
        case 'financial':
          reportData = await this.getFinancialAnalytics(organizationId, { dateFrom, dateTo });
          break;
        case 'comprehensive':
          reportData = {
            farmer: await this.getFarmerAnalytics(organizationId, { dateFrom, dateTo }),
            crop: await this.getCropAnalytics(organizationId, { dateFrom, dateTo }),
            market: await this.getMarketAnalytics(organizationId, { dateFrom, dateTo }),
            financial: await this.getFinancialAnalytics(organizationId, { dateFrom, dateTo })
          };
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      // Apply filters if provided
      if (filters && Object.keys(filters).length > 0) {
        reportData = this.applyFilters(reportData, filters);
      }

      // Apply grouping if provided
      if (groupBy) {
        reportData = this.applyGrouping(reportData, groupBy);
      }

      // Select specific metrics if provided
      if (metrics && metrics.length > 0) {
        reportData = this.selectMetrics(reportData, metrics);
      }

      return {
        reportType: type,
        generatedAt: new Date().toISOString(),
        config: reportConfig,
        data: reportData
      };
    } catch (error) {
      console.error('Failed to generate custom report:', error);
      throw error;
    }
  }

  applyFilters(data, filters) {
    // Implement filtering logic based on filter configuration
    // This is a simplified implementation
    return data;
  }

  applyGrouping(data, groupBy) {
    // Implement grouping logic based on groupBy configuration
    // This is a simplified implementation
    return data;
  }

  selectMetrics(data, metrics) {
    // Implement metric selection logic
    // This is a simplified implementation
    return data;
  }

  // ===== DASHBOARD KPIs =====

  async getDashboardKPIs(organizationId) {
    try {
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Quick KPI calculations
      const [
        totalFarmers,
        activeFarmers,
        totalCrops,
        activeCrops,
        totalLoans,
        totalLoanAmount,
        totalPayments,
        totalPaymentAmount,
        recentAlerts
      ] = await Promise.all([
        this.prisma.farmerProfile.count({ where: { organizationId } }),
        this.prisma.farmerProfile.count({
          where: {
            organizationId,
            crops: {
              some: {
                updatedAt: { gte: last7Days }
              }
            }
          }
        }),
        this.prisma.crop.count({
          where: { farmer: { organizationId } }
        }),
        this.prisma.crop.count({
          where: {
            farmer: { organizationId },
            status: 'growing'
          }
        }),
        this.prisma.loanApplication.count({
          where: { farmer: { organizationId } }
        }),
        this.prisma.loanApplication.aggregate({
          where: { farmer: { organizationId } },
          _sum: { amount: true }
        }),
        this.prisma.payment.count({
          where: { organizationId, createdAt: { gte: last30Days } }
        }),
        this.prisma.payment.aggregate({
          where: { organizationId, createdAt: { gte: last30Days } },
          _sum: { amount: true }
        }),
        this.prisma.marketAlert.count({
          where: {
            farmer: { organizationId },
            createdAt: { gte: last7Days }
          }
        })
      ]);

      return {
        farmers: {
          total: totalFarmers,
          active: activeFarmers,
          engagementRate: totalFarmers > 0 ? ((activeFarmers / totalFarmers) * 100).toFixed(2) : 0
        },
        crops: {
          total: totalCrops,
          active: activeCrops,
          growthRate: totalCrops > 0 ? ((activeCrops / totalCrops) * 100).toFixed(2) : 0
        },
        financial: {
          totalLoans: totalLoans,
          totalLoanAmount: totalLoanAmount._sum.amount || 0,
          totalPayments: totalPayments,
          totalPaymentAmount: totalPaymentAmount._sum.amount || 0,
          revenue: totalPaymentAmount._sum.amount || 0
        },
        alerts: {
          recentAlerts,
          alertTrend: recentAlerts > 0 ? 'increasing' : 'stable'
        },
        lastUpdated: now.toISOString()
      };
    } catch (error) {
      console.error('Failed to get dashboard KPIs:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
