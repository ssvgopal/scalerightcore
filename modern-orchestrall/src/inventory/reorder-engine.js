class ReorderRulesEngine {
  constructor(prisma) {
    this.prisma = prisma;
    this.rules = new Map();
  }

  async createReorderRule(ruleData) {
    try {
      const {
        productId,
        storeId,
        organizationId,
        reorderLevel,
        reorderQuantity,
        maxLevel,
        conditions = {},
        isActive = true
      } = ruleData;

      const rule = await this.prisma.reorderRule.create({
        data: {
          productId,
          storeId,
          organizationId,
          reorderLevel,
          reorderQuantity,
          maxLevel,
          conditions,
          isActive,
          createdAt: new Date()
        }
      });

      // Cache rule for faster execution
      this.rules.set(rule.id, rule);

      return {
        success: true,
        rule: {
          id: rule.id,
          productId,
          storeId,
          reorderLevel,
          reorderQuantity,
          maxLevel,
          isActive
        }
      };
    } catch (error) {
      console.error('Reorder rule creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeReorderRules(organizationId, storeId = null) {
    try {
      const where = {
        organizationId,
        isActive: true,
        ...(storeId && { storeId })
      };

      const rules = await this.prisma.reorderRule.findMany({
        where,
        include: {
          product: true,
          store: true
        }
      });

      const results = {
        triggered: [],
        skipped: [],
        errors: []
      };

      for (const rule of rules) {
        try {
          const result = await this.evaluateRule(rule);
          if (result.shouldReorder) {
            results.triggered.push({
              ruleId: rule.id,
              productId: rule.productId,
              storeId: rule.storeId,
              currentQuantity: result.currentQuantity,
              reorderQuantity: rule.reorderQuantity,
              reason: result.reason
            });

            // Create reorder request
            await this.createReorderRequest(rule, result);
          } else {
            results.skipped.push({
              ruleId: rule.id,
              productId: rule.productId,
              storeId: rule.storeId,
              currentQuantity: result.currentQuantity,
              reason: result.reason
            });
          }
        } catch (error) {
          results.errors.push({
            ruleId: rule.id,
            productId: rule.productId,
            storeId: rule.storeId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results,
        summary: {
          totalRules: rules.length,
          triggered: results.triggered.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        }
      };
    } catch (error) {
      console.error('Reorder rules execution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async evaluateRule(rule) {
    try {
      // Get current inventory
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          productId: rule.productId,
          storeId: rule.storeId,
          organizationId: rule.organizationId
        }
      });

      if (!inventory) {
        return {
          shouldReorder: true,
          currentQuantity: 0,
          reason: 'No inventory record found'
        };
      }

      const currentQuantity = inventory.quantity;

      // Check basic reorder level
      if (currentQuantity <= rule.reorderLevel) {
        return {
          shouldReorder: true,
          currentQuantity,
          reason: `Quantity (${currentQuantity}) below reorder level (${rule.reorderLevel})`
        };
      }

      // Check additional conditions
      if (rule.conditions && Object.keys(rule.conditions).length > 0) {
        const conditionResult = await this.evaluateConditions(rule.conditions, inventory);
        if (conditionResult.shouldReorder) {
          return {
            shouldReorder: true,
            currentQuantity,
            reason: conditionResult.reason
          };
        }
      }

      return {
        shouldReorder: false,
        currentQuantity,
        reason: `Quantity (${currentQuantity}) above reorder level (${rule.reorderLevel})`
      };
    } catch (error) {
      console.error('Rule evaluation failed:', error);
      return {
        shouldReorder: false,
        currentQuantity: 0,
        reason: `Evaluation error: ${error.message}`
      };
    }
  }

  async evaluateConditions(conditions, inventory) {
    try {
      // Example conditions evaluation
      // In production, this would be more sophisticated
      
      if (conditions.salesVelocity) {
        const salesVelocity = await this.calculateSalesVelocity(
          inventory.productId,
          inventory.storeId,
          inventory.organizationId,
          conditions.salesVelocity.period || 7
        );

        if (salesVelocity > conditions.salesVelocity.threshold) {
          return {
            shouldReorder: true,
            reason: `High sales velocity: ${salesVelocity}`
          };
        }
      }

      if (conditions.seasonalDemand) {
        const seasonalMultiplier = this.getSeasonalMultiplier(
          inventory.productId,
          conditions.seasonalDemand.season
        );

        if (seasonalMultiplier > 1.5) {
          return {
            shouldReorder: true,
            reason: `Seasonal demand increase: ${seasonalMultiplier}x`
          };
        }
      }

      if (conditions.supplierLeadTime) {
        const leadTimeDays = conditions.supplierLeadTime.days || 7;
        const projectedStockout = await this.calculateProjectedStockout(
          inventory.productId,
          inventory.storeId,
          inventory.organizationId,
          leadTimeDays
        );

        if (projectedStockout <= 0) {
          return {
            shouldReorder: true,
            reason: `Projected stockout in ${leadTimeDays} days`
          };
        }
      }

      return {
        shouldReorder: false,
        reason: 'No conditions triggered'
      };
    } catch (error) {
      console.error('Conditions evaluation failed:', error);
      return {
        shouldReorder: false,
        reason: `Condition evaluation error: ${error.message}`
      };
    }
  }

  async calculateSalesVelocity(productId, storeId, organizationId, periodDays) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const sales = await this.prisma.orderItem.aggregate({
        where: {
          productId,
          order: {
            storeId,
            organizationId,
            status: 'completed',
            createdAt: {
              gte: startDate
            }
          }
        },
        _sum: {
          quantity: true
        }
      });

      return sales._sum.quantity || 0;
    } catch (error) {
      console.error('Sales velocity calculation failed:', error);
      return 0;
    }
  }

  getSeasonalMultiplier(productId, season) {
    // Simple seasonal multiplier logic
    // In production, this would be based on historical data
    const seasonalMultipliers = {
      'summer': 1.2,
      'winter': 1.5,
      'spring': 1.0,
      'fall': 1.1
    };

    return seasonalMultipliers[season] || 1.0;
  }

  async calculateProjectedStockout(productId, storeId, organizationId, leadTimeDays) {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          productId,
          storeId,
          organizationId
        }
      });

      if (!inventory) return 0;

      const dailyConsumption = await this.calculateDailyConsumption(
        productId,
        storeId,
        organizationId
      );

      const projectedStockout = inventory.quantity - (dailyConsumption * leadTimeDays);
      return projectedStockout;
    } catch (error) {
      console.error('Projected stockout calculation failed:', error);
      return 0;
    }
  }

  async calculateDailyConsumption(productId, storeId, organizationId, periodDays = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const totalSales = await this.prisma.orderItem.aggregate({
        where: {
          productId,
          order: {
            storeId,
            organizationId,
            status: 'completed',
            createdAt: {
              gte: startDate
            }
          }
        },
        _sum: {
          quantity: true
        }
      });

      return (totalSales._sum.quantity || 0) / periodDays;
    } catch (error) {
      console.error('Daily consumption calculation failed:', error);
      return 0;
    }
  }

  async createReorderRequest(rule, evaluationResult) {
    try {
      const reorderRequest = await this.prisma.reorderRequest.create({
        data: {
          productId: rule.productId,
          storeId: rule.storeId,
          organizationId: rule.organizationId,
          requestedQuantity: rule.reorderQuantity,
          currentQuantity: evaluationResult.currentQuantity,
          reason: evaluationResult.reason,
          ruleId: rule.id,
          status: 'pending',
          createdAt: new Date()
        }
      });

      return {
        success: true,
        reorderRequest: {
          id: reorderRequest.id,
          productId: rule.productId,
          storeId: rule.storeId,
          requestedQuantity: rule.reorderQuantity,
          status: reorderRequest.status
        }
      };
    } catch (error) {
      console.error('Reorder request creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getReorderRequests(organizationId, filters = {}) {
    try {
      const where = {
        organizationId,
        ...(filters.status && { status: filters.status }),
        ...(filters.storeId && { storeId: filters.storeId }),
        ...(filters.productId && { productId: filters.productId })
      };

      const requests = await this.prisma.reorderRequest.findMany({
        where,
        include: {
          product: true,
          store: true,
          rule: true
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100
      });

      return {
        success: true,
        requests
      };
    } catch (error) {
      console.error('Reorder requests fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateReorderRule(ruleId, updateData) {
    try {
      const rule = await this.prisma.reorderRule.update({
        where: { id: ruleId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      // Update cache
      this.rules.set(ruleId, rule);

      return {
        success: true,
        rule
      };
    } catch (error) {
      console.error('Reorder rule update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteReorderRule(ruleId) {
    try {
      await this.prisma.reorderRule.delete({
        where: { id: ruleId }
      });

      // Remove from cache
      this.rules.delete(ruleId);

      return {
        success: true,
        message: 'Reorder rule deleted successfully'
      };
    } catch (error) {
      console.error('Reorder rule deletion failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ReorderRulesEngine;
