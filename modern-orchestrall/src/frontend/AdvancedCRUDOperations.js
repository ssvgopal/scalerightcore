// src/frontend/AdvancedCRUDOperations.js - Advanced CRUD Operations Manager
class AdvancedCRUDOperations {
  constructor(entityName, apiClient, wsManager) {
    this.entityName = entityName;
    this.apiClient = apiClient;
    this.wsManager = wsManager;
    this.operations = {
      create: this.create.bind(this),
      read: this.read.bind(this),
      update: this.update.bind(this),
      delete: this.delete.bind(this),
      bulkCreate: this.bulkCreate.bind(this),
      bulkUpdate: this.bulkUpdate.bind(this),
      bulkDelete: this.bulkDelete.bind(this),
      search: this.search.bind(this),
      filter: this.filter.bind(this),
      sort: this.sort.bind(this),
      paginate: this.paginate.bind(this),
      export: this.export.bind(this),
      import: this.import.bind(this),
      duplicate: this.duplicate.bind(this),
      archive: this.archive.bind(this),
      restore: this.restore.bind(this)
    };
  }

  // Create a new entity
  async create(data, options = {}) {
    try {
      const response = await this.apiClient.post(`/api/${this.entityName}`, data);
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('entity_created', {
          entity: this.entityName,
          data: response.data
        });
        
        return {
          success: true,
          data: response.data,
          message: `${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} created successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to create entity');
      }
    } catch (error) {
      console.error(`❌ Error creating ${this.entityName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to create ${this.entityName}`
      };
    }
  }

  // Read entities with advanced options
  async read(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        sortField = '',
        sortOrder = 'asc',
        filters = {},
        include = [],
        fields = []
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(sortField && { sortField, sortOrder }),
        ...(Object.keys(filters).length && { filter: JSON.stringify(filters) }),
        ...(include.length && { include: include.join(',') }),
        ...(fields.length && { fields: fields.join(',') })
      });

      const response = await this.apiClient.get(`/api/${this.entityName}?${params}`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          pagination: {
            page: response.page,
            limit: response.limit,
            total: response.total,
            totalPages: Math.ceil(response.total / response.limit)
          },
          message: `Retrieved ${response.data.length} ${this.entityName}s`
        };
      } else {
        throw new Error(response.error || 'Failed to read entities');
      }
    } catch (error) {
      console.error(`❌ Error reading ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to read ${this.entityName}s`
      };
    }
  }

  // Update an entity
  async update(id, data, options = {}) {
    try {
      const response = await this.apiClient.put(`/api/${this.entityName}/${id}`, data);
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('entity_updated', {
          entity: this.entityName,
          data: response.data
        });
        
        return {
          success: true,
          data: response.data,
          message: `${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} updated successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to update entity');
      }
    } catch (error) {
      console.error(`❌ Error updating ${this.entityName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to update ${this.entityName}`
      };
    }
  }

  // Delete an entity
  async delete(id, options = {}) {
    try {
      const response = await this.apiClient.delete(`/api/${this.entityName}/${id}`);
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('entity_deleted', {
          entity: this.entityName,
          id: id
        });
        
        return {
          success: true,
          message: `${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} deleted successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to delete entity');
      }
    } catch (error) {
      console.error(`❌ Error deleting ${this.entityName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to delete ${this.entityName}`
      };
    }
  }

  // Bulk create entities
  async bulkCreate(items, options = {}) {
    try {
      const response = await this.apiClient.post(`/api/${this.entityName}/bulk`, { items });
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('bulk_operation', {
          entity: this.entityName,
          operation: 'create',
          data: response.data
        });
        
        return {
          success: true,
          data: response.data,
          message: `Created ${response.data.length} ${this.entityName}s successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to bulk create entities');
      }
    } catch (error) {
      console.error(`❌ Error bulk creating ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to bulk create ${this.entityName}s`
      };
    }
  }

  // Bulk update entities
  async bulkUpdate(updates, options = {}) {
    try {
      const response = await this.apiClient.put(`/api/${this.entityName}/bulk`, { updates });
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('bulk_operation', {
          entity: this.entityName,
          operation: 'update',
          data: response.data
        });
        
        return {
          success: true,
          data: response.data,
          message: `Updated ${response.data.length} ${this.entityName}s successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to bulk update entities');
      }
    } catch (error) {
      console.error(`❌ Error bulk updating ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to bulk update ${this.entityName}s`
      };
    }
  }

  // Bulk delete entities
  async bulkDelete(ids, options = {}) {
    try {
      const response = await this.apiClient.delete(`/api/${this.entityName}/bulk`, { ids });
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('bulk_operation', {
          entity: this.entityName,
          operation: 'delete',
          data: { ids }
        });
        
        return {
          success: true,
          message: `Deleted ${ids.length} ${this.entityName}s successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to bulk delete entities');
      }
    } catch (error) {
      console.error(`❌ Error bulk deleting ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to bulk delete ${this.entityName}s`
      };
    }
  }

  // Advanced search with multiple criteria
  async search(criteria, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortField = '',
        sortOrder = 'asc'
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: JSON.stringify(criteria),
        ...(sortField && { sortField, sortOrder })
      });

      const response = await this.apiClient.get(`/api/${this.entityName}?${params}`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          pagination: {
            page: response.page,
            limit: response.limit,
            total: response.total,
            totalPages: Math.ceil(response.total / response.limit)
          },
          message: `Found ${response.data.length} ${this.entityName}s matching criteria`
        };
      } else {
        throw new Error(response.error || 'Failed to search entities');
      }
    } catch (error) {
      console.error(`❌ Error searching ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to search ${this.entityName}s`
      };
    }
  }

  // Advanced filtering
  async filter(filters, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortField = '',
        sortOrder = 'asc'
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        filter: JSON.stringify(filters),
        ...(sortField && { sortField, sortOrder })
      });

      const response = await this.apiClient.get(`/api/${this.entityName}?${params}`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          pagination: {
            page: response.page,
            limit: response.limit,
            total: response.total,
            totalPages: Math.ceil(response.total / response.limit)
          },
          message: `Filtered ${response.data.length} ${this.entityName}s`
        };
      } else {
        throw new Error(response.error || 'Failed to filter entities');
      }
    } catch (error) {
      console.error(`❌ Error filtering ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to filter ${this.entityName}s`
      };
    }
  }

  // Advanced sorting
  async sort(sortConfig, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        filters = {}
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortField: sortConfig.field,
        sortOrder: sortConfig.order,
        ...(Object.keys(filters).length && { filter: JSON.stringify(filters) })
      });

      const response = await this.apiClient.get(`/api/${this.entityName}?${params}`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          pagination: {
            page: response.page,
            limit: response.limit,
            total: response.total,
            totalPages: Math.ceil(response.total / response.limit)
          },
          message: `Sorted ${response.data.length} ${this.entityName}s`
        };
      } else {
        throw new Error(response.error || 'Failed to sort entities');
      }
    } catch (error) {
      console.error(`❌ Error sorting ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to sort ${this.entityName}s`
      };
    }
  }

  // Advanced pagination
  async paginate(page, limit, options = {}) {
    try {
      const {
        search = '',
        sortField = '',
        sortOrder = 'asc',
        filters = {}
      } = options;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(sortField && { sortField, sortOrder }),
        ...(Object.keys(filters).length && { filter: JSON.stringify(filters) })
      });

      const response = await this.apiClient.get(`/api/${this.entityName}?${params}`);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          pagination: {
            page: response.page,
            limit: response.limit,
            total: response.total,
            totalPages: Math.ceil(response.total / response.limit)
          },
          message: `Retrieved page ${page} of ${this.entityName}s`
        };
      } else {
        throw new Error(response.error || 'Failed to paginate entities');
      }
    } catch (error) {
      console.error(`❌ Error paginating ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to paginate ${this.entityName}s`
      };
    }
  }

  // Export data in various formats
  async export(format = 'csv', options = {}) {
    try {
      const {
        filters = {},
        fields = [],
        filename = null
      } = options;

      const params = new URLSearchParams({
        format,
        ...(Object.keys(filters).length && { filter: JSON.stringify(filters) }),
        ...(fields.length && { fields: fields.join(',') })
      });

      const response = await this.apiClient.get(`/api/${this.entityName}/export?${params}`);
      
      if (response.success) {
        // Create download link
        const blob = new Blob([response.data], { type: this.getMimeType(format) });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${this.entityName}s-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        return {
          success: true,
          message: `Exported ${this.entityName}s successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to export entities');
      }
    } catch (error) {
      console.error(`❌ Error exporting ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to export ${this.entityName}s`
      };
    }
  }

  // Import data from various formats
  async import(file, options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(options));

      const response = await this.apiClient.post(`/api/${this.entityName}/import`, formData);
      
      if (response.success) {
        // Notify WebSocket listeners
        this.wsManager.send('bulk_operation', {
          entity: this.entityName,
          operation: 'import',
          data: response.data
        });
        
        return {
          success: true,
          data: response.data,
          message: `Imported ${response.data.length} ${this.entityName}s successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to import entities');
      }
    } catch (error) {
      console.error(`❌ Error importing ${this.entityName}s:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to import ${this.entityName}s`
      };
    }
  }

  // Duplicate an entity
  async duplicate(id, options = {}) {
    try {
      // First, get the original entity
      const originalResponse = await this.apiClient.get(`/api/${this.entityName}/${id}`);
      
      if (!originalResponse.success) {
        throw new Error('Failed to get original entity');
      }

      // Create a copy with modified data
      const duplicateData = {
        ...originalResponse.data,
        ...options.overrides,
        name: `${originalResponse.data.name} (Copy)`,
        id: undefined // Remove ID to create new entity
      };

      const response = await this.create(duplicateData);
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: `${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} duplicated successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to duplicate entity');
      }
    } catch (error) {
      console.error(`❌ Error duplicating ${this.entityName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to duplicate ${this.entityName}`
      };
    }
  }

  // Archive an entity (soft delete)
  async archive(id, options = {}) {
    try {
      const response = await this.update(id, { 
        status: 'archived',
        archivedAt: new Date().toISOString(),
        ...options.archivedData
      });
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: `${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} archived successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to archive entity');
      }
    } catch (error) {
      console.error(`❌ Error archiving ${this.entityName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to archive ${this.entityName}`
      };
    }
  }

  // Restore an archived entity
  async restore(id, options = {}) {
    try {
      const response = await this.update(id, { 
        status: 'active',
        restoredAt: new Date().toISOString(),
        archivedAt: null,
        ...options.restoredData
      });
      
      if (response.success) {
        return {
          success: true,
          data: response.data,
          message: `${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} restored successfully`
        };
      } else {
        throw new Error(response.error || 'Failed to restore entity');
      }
    } catch (error) {
      console.error(`❌ Error restoring ${this.entityName}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to restore ${this.entityName}`
      };
    }
  }

  // Get MIME type for export format
  getMimeType(format) {
    const mimeTypes = {
      csv: 'text/csv',
      json: 'application/json',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
      xml: 'application/xml'
    };
    return mimeTypes[format] || 'text/plain';
  }

  // Get all available operations
  getOperations() {
    return Object.keys(this.operations);
  }

  // Execute operation by name
  async execute(operationName, ...args) {
    if (this.operations[operationName]) {
      return await this.operations[operationName](...args);
    } else {
      throw new Error(`Operation '${operationName}' not found`);
    }
  }
}

module.exports = AdvancedCRUDOperations;
