class InventoryTransferService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async createTransfer(transferData) {
    try {
      const {
        fromStoreId,
        toStoreId,
        productId,
        quantity,
        reason,
        requestedBy,
        organizationId
      } = transferData;

      // Validate stores exist
      const fromStore = await this.prisma.store.findUnique({
        where: { id: fromStoreId }
      });
      const toStore = await this.prisma.store.findUnique({
        where: { id: toStoreId }
      });

      if (!fromStore || !toStore) {
        throw new Error('Invalid store IDs');
      }

      // Check available inventory
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          storeId: fromStoreId,
          productId,
          organizationId
        }
      });

      if (!inventory || inventory.quantity < quantity) {
        throw new Error('Insufficient inventory for transfer');
      }

      // Create transfer record
      const transfer = await this.prisma.inventoryTransfer.create({
        data: {
          fromStoreId,
          toStoreId,
          productId,
          quantity,
          reason,
          requestedBy,
          organizationId,
          status: 'pending',
          createdAt: new Date()
        }
      });

      // Create audit log
      await this.createAuditLog({
        entityType: 'inventory_transfer',
        entityId: transfer.id,
        action: 'created',
        details: {
          fromStore: fromStore.name,
          toStore: toStore.name,
          productId,
          quantity,
          reason
        },
        userId: requestedBy,
        organizationId
      });

      return {
        success: true,
        transfer: {
          id: transfer.id,
          fromStoreId,
          toStoreId,
          productId,
          quantity,
          status: transfer.status,
          createdAt: transfer.createdAt
        }
      };
    } catch (error) {
      console.error('Transfer creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async approveTransfer(transferId, approvedBy) {
    try {
      const transfer = await this.prisma.inventoryTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromStore: true,
          toStore: true,
          product: true
        }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.status !== 'pending') {
        throw new Error('Transfer is not in pending status');
      }

      // Update inventory quantities
      await this.prisma.$transaction(async (tx) => {
        // Reduce from source store
        await tx.inventory.updateMany({
          where: {
            storeId: transfer.fromStoreId,
            productId: transfer.productId,
            organizationId: transfer.organizationId
          },
          data: {
            quantity: {
              decrement: transfer.quantity
            }
          }
        });

        // Add to destination store
        await tx.inventory.upsert({
          where: {
            storeId_productId_organizationId: {
              storeId: transfer.toStoreId,
              productId: transfer.productId,
              organizationId: transfer.organizationId
            }
          },
          update: {
            quantity: {
              increment: transfer.quantity
            }
          },
          create: {
            storeId: transfer.toStoreId,
            productId: transfer.productId,
            organizationId: transfer.organizationId,
            quantity: transfer.quantity,
            reorderLevel: 0,
            maxLevel: 1000
          }
        });

        // Update transfer status
        await tx.inventoryTransfer.update({
          where: { id: transferId },
          data: {
            status: 'approved',
            approvedBy,
            approvedAt: new Date()
          }
        });
      });

      // Create audit log
      await this.createAuditLog({
        entityType: 'inventory_transfer',
        entityId: transferId,
        action: 'approved',
        details: {
          fromStore: transfer.fromStore.name,
          toStore: transfer.toStore.name,
          product: transfer.product.name,
          quantity: transfer.quantity
        },
        userId: approvedBy,
        organizationId: transfer.organizationId
      });

      return {
        success: true,
        message: 'Transfer approved successfully'
      };
    } catch (error) {
      console.error('Transfer approval failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async rejectTransfer(transferId, rejectedBy, reason) {
    try {
      const transfer = await this.prisma.inventoryTransfer.findUnique({
        where: { id: transferId }
      });

      if (!transfer) {
        throw new Error('Transfer not found');
      }

      if (transfer.status !== 'pending') {
        throw new Error('Transfer is not in pending status');
      }

      await this.prisma.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'rejected',
          rejectedBy,
          rejectionReason: reason,
          rejectedAt: new Date()
        }
      });

      // Create audit log
      await this.createAuditLog({
        entityType: 'inventory_transfer',
        entityId: transferId,
        action: 'rejected',
        details: {
          reason,
          originalQuantity: transfer.quantity
        },
        userId: rejectedBy,
        organizationId: transfer.organizationId
      });

      return {
        success: true,
        message: 'Transfer rejected successfully'
      };
    } catch (error) {
      console.error('Transfer rejection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTransfers(organizationId, filters = {}) {
    try {
      const where = {
        organizationId,
        ...(filters.status && { status: filters.status }),
        ...(filters.fromStoreId && { fromStoreId: filters.fromStoreId }),
        ...(filters.toStoreId && { toStoreId: filters.toStoreId }),
        ...(filters.productId && { productId: filters.productId })
      };

      const transfers = await this.prisma.inventoryTransfer.findMany({
        where,
        include: {
          fromStore: true,
          toStore: true,
          product: true,
          requestedByUser: {
            select: { id: true, name: true, email: true }
          },
          approvedByUser: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 100
      });

      return {
        success: true,
        transfers
      };
    } catch (error) {
      console.error('Transfers fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createAuditLog(auditData) {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          entityType: auditData.entityType,
          entityId: auditData.entityId,
          action: auditData.action,
          details: auditData.details,
          userId: auditData.userId,
          organizationId: auditData.organizationId,
          timestamp: new Date()
        }
      });

      return auditLog;
    } catch (error) {
      console.error('Audit log creation failed:', error);
      // Don't throw error for audit log failures
      return null;
    }
  }

  async getAuditLogs(organizationId, filters = {}) {
    try {
      const where = {
        organizationId,
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.entityId && { entityId: filters.entityId }),
        ...(filters.action && { action: filters.action }),
        ...(filters.userId && { userId: filters.userId })
      };

      const auditLogs = await this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100
      });

      return {
        success: true,
        auditLogs
      };
    } catch (error) {
      console.error('Audit logs fetch failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = InventoryTransferService;
