// src/frontend/EntityListPanelEnhanced.js - Enhanced EntityListPanel with Complete Integration
const React = require('react');
const { useState, useEffect, useCallback } = require('react');

class EntityListPanelEnhanced {
  constructor(entityName, apiClient) {
    this.entityName = entityName;
    this.apiClient = apiClient;
    this.state = {
      data: [],
      loading: false,
      error: null,
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      },
      filters: {
        search: '',
        sortField: '',
        sortOrder: 'asc'
      },
      selectedItems: [],
      showCreateModal: false,
      showEditModal: false,
      editingItem: null,
      entitySchema: null
    };
  }

  // Generate enhanced HTML for the EntityListPanel
  generateHTML() {
    return `
    <div class="entity-list-panel-enhanced" data-entity="${this.entityName}">
      <div class="panel-header">
        <div class="panel-title-section">
          <h2 class="panel-title">${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} Management</h2>
          <div class="panel-subtitle">Manage ${this.entityName} data and operations</div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary" id="create-${this.entityName}">
            <i class="fas fa-plus"></i> Create New
          </button>
          <button class="btn btn-secondary" id="refresh-${this.entityName}">
            <i class="fas fa-sync"></i> Refresh
          </button>
          <button class="btn btn-info" id="export-${this.entityName}">
            <i class="fas fa-download"></i> Export
          </button>
        </div>
      </div>

      <div class="panel-filters">
        <div class="search-section">
          <div class="search-box">
            <input type="text" id="search-${this.entityName}" placeholder="Search ${this.entityName}..." class="form-control">
            <i class="fas fa-search search-icon"></i>
            <button class="btn btn-sm btn-outline" id="clear-search-${this.entityName}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="filter-controls">
          <select id="sort-field-${this.entityName}" class="form-control">
            <option value="">Sort by...</option>
            <option value="name">Name</option>
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
            <option value="status">Status</option>
          </select>
          <select id="sort-order-${this.entityName}" class="form-control">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <select id="limit-${this.entityName}" class="form-control">
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
      </div>

      <div class="panel-content">
        <div class="data-table-container">
          <div class="table-header">
            <div class="table-info">
              <span id="table-info-${this.entityName}">Loading...</span>
            </div>
            <div class="table-actions">
              <button class="btn btn-sm btn-outline" id="select-all-${this.entityName}">
                <i class="fas fa-check-square"></i> Select All
              </button>
              <button class="btn btn-sm btn-outline" id="deselect-all-${this.entityName}">
                <i class="fas fa-square"></i> Deselect All
              </button>
            </div>
          </div>
          
          <table class="data-table" id="table-${this.entityName}">
            <thead>
              <tr>
                <th class="checkbox-column">
                  <input type="checkbox" id="select-all-checkbox-${this.entityName}">
                </th>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th class="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody id="tbody-${this.entityName}">
              <tr class="loading-row">
                <td colspan="6" class="text-center">
                  <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i> Loading...
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-container">
          <div class="pagination-info">
            <span id="pagination-info-${this.entityName}">Loading...</span>
          </div>
          <div class="pagination-controls">
            <button class="btn btn-sm" id="prev-page-${this.entityName}" disabled>
              <i class="fas fa-chevron-left"></i> Previous
            </button>
            <span class="page-numbers" id="page-numbers-${this.entityName}"></span>
            <button class="btn btn-sm" id="next-page-${this.entityName}" disabled>
              Next <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="bulk-actions" id="bulk-actions-${this.entityName}" style="display: none;">
        <div class="bulk-info">
          <span id="bulk-count-${this.entityName}">0</span> items selected
        </div>
        <div class="bulk-buttons">
          <button class="btn btn-danger btn-sm" id="bulk-delete-${this.entityName}">
            <i class="fas fa-trash"></i> Delete Selected
          </button>
          <button class="btn btn-warning btn-sm" id="bulk-update-${this.entityName}">
            <i class="fas fa-edit"></i> Update Selected
          </button>
          <button class="btn btn-secondary btn-sm" id="bulk-export-${this.entityName}">
            <i class="fas fa-download"></i> Export Selected
          </button>
        </div>
      </div>
    </div>

    <!-- Enhanced Create/Edit Modal -->
    <div class="modal" id="modal-${this.entityName}">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modal-title-${this.entityName}">Create ${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)}</h3>
          <button class="modal-close" id="modal-close-${this.entityName}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="form-${this.entityName}" class="entity-form">
            <div class="form-sections" id="form-sections-${this.entityName}">
              <!-- Dynamic form sections will be generated here -->
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-${this.entityName}">Cancel</button>
          <button class="btn btn-primary" id="modal-save-${this.entityName}">
            <i class="fas fa-save"></i> Save
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Update Modal -->
    <div class="modal" id="bulk-modal-${this.entityName}">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Bulk Update ${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)}</h3>
          <button class="modal-close" id="bulk-modal-close-${this.entityName}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="bulk-form-${this.entityName}" class="bulk-form">
            <div class="bulk-form-content" id="bulk-form-content-${this.entityName}">
              <!-- Bulk update form will be generated here -->
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="bulk-modal-cancel-${this.entityName}">Cancel</button>
          <button class="btn btn-warning" id="bulk-modal-save-${this.entityName}">
            <i class="fas fa-save"></i> Update Selected
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div class="modal" id="confirm-modal-${this.entityName}">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="confirm-title-${this.entityName}">Confirm Action</h3>
          <button class="modal-close" id="confirm-modal-close-${this.entityName}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p id="confirm-message-${this.entityName}">Are you sure you want to perform this action?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirm-cancel-${this.entityName}">Cancel</button>
          <button class="btn btn-danger" id="confirm-proceed-${this.entityName}">Proceed</button>
        </div>
      </div>
    </div>
    `;
  }

  // Generate enhanced CSS for the EntityListPanel
  generateCSS() {
    return `
    .entity-list-panel-enhanced {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    }

    .panel-title-section {
      flex: 1;
    }

    .panel-title {
      margin: 0 0 4px 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #1a202c;
    }

    .panel-subtitle {
      font-size: 0.875rem;
      color: #718096;
      margin: 0;
    }

    .panel-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .panel-filters {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 16px;
    }

    .search-section {
      flex: 1;
      min-width: 300px;
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-box input {
      padding-right: 80px;
      padding-left: 40px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #718096;
      z-index: 2;
    }

    .search-box .btn-outline {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      padding: 4px 8px;
      font-size: 12px;
    }

    .filter-controls {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .data-table-container {
      overflow-x: auto;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .table-info {
      font-size: 0.875rem;
      color: #718096;
    }

    .table-actions {
      display: flex;
      gap: 8px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .data-table th,
    .data-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    .data-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #4a5568;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .data-table tbody tr:hover {
      background: #f7fafc;
    }

    .data-table tbody tr.selected {
      background: #ebf8ff;
    }

    .checkbox-column {
      width: 40px;
    }

    .actions-column {
      width: 120px;
    }

    .loading-spinner {
      padding: 40px;
      color: #718096;
      text-align: center;
    }

    .pagination-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .page-numbers {
      display: flex;
      gap: 4px;
    }

    .page-number {
      padding: 6px 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      cursor: pointer;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }

    .page-number:hover {
      background: #f7fafc;
      border-color: #cbd5e0;
    }

    .page-number.active {
      background: #3182ce;
      color: #ffffff;
      border-color: #3182ce;
    }

    .bulk-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #fef5e7 0%, #fed7aa 100%);
      border-top: 1px solid #f6ad55;
    }

    .bulk-info {
      font-weight: 600;
      color: #c05621;
    }

    .bulk-buttons {
      display: flex;
      gap: 8px;
    }

    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background-color: #ffffff;
      margin: 2% auto;
      padding: 0;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
      animation: modalSlideIn 0.3s ease;
      max-height: 90vh;
      overflow-y: auto;
    }

    @keyframes modalSlideIn {
      from { transform: translateY(-50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #1a202c;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #718096;
      transition: color 0.2s ease;
    }

    .modal-close:hover {
      color: #e53e3e;
    }

    .modal-body {
      padding: 24px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 24px;
      border-top: 1px solid #e2e8f0;
    }

    .form-sections {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-section {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #f8fafc;
    }

    .form-section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #4a5568;
      font-size: 0.875rem;
    }

    .form-control {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }

    .form-control:focus {
      outline: none;
      border-color: #3182ce;
      box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
    }

    .form-control:invalid {
      border-color: #e53e3e;
    }

    .form-control:invalid:focus {
      box-shadow: 0 0 0 3px rgba(229, 62, 62, 0.1);
    }

    .form-control[readonly] {
      background-color: #f7fafc;
      color: #718096;
    }

    .form-control[disabled] {
      background-color: #f7fafc;
      color: #a0aec0;
      cursor: not-allowed;
    }

    .form-help {
      font-size: 0.75rem;
      color: #718096;
      margin-top: 4px;
    }

    .form-error {
      font-size: 0.75rem;
      color: #e53e3e;
      margin-top: 4px;
    }

    .btn {
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(49, 130, 206, 0.3);
    }

    .btn-secondary {
      background: #f7fafc;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #edf2f7;
    }

    .btn-danger {
      background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(229, 62, 62, 0.3);
    }

    .btn-warning {
      background: linear-gradient(135deg, #dd6b20 0%, #c05621 100%);
      color: white;
    }

    .btn-warning:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(221, 107, 32, 0.3);
    }

    .btn-info {
      background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%);
      color: white;
    }

    .btn-info:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(49, 130, 206, 0.3);
    }

    .btn-outline {
      background: transparent;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }

    .btn-outline:hover:not(:disabled) {
      background: #f7fafc;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 0.75rem;
    }

    .text-center {
      text-align: center;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-active {
      background: #c6f6d5;
      color: #22543d;
    }

    .status-inactive {
      background: #fed7d7;
      color: #742a2a;
    }

    .status-pending {
      background: #fef5e7;
      color: #744210;
    }

    .status-draft {
      background: #e6fffa;
      color: #234e52;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .panel-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .panel-filters {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .search-section {
        min-width: auto;
      }

      .filter-controls {
        justify-content: space-between;
      }

      .pagination-container {
        flex-direction: column;
        gap: 16px;
      }

      .bulk-actions {
        flex-direction: column;
        gap: 16px;
      }

      .modal-content {
        width: 95%;
        margin: 5% auto;
      }

      .data-table {
        font-size: 0.75rem;
      }

      .data-table th,
      .data-table td {
        padding: 8px 12px;
      }
    }

    @media (max-width: 480px) {
      .panel-actions {
        flex-direction: column;
      }

      .bulk-buttons {
        flex-direction: column;
      }

      .modal-footer {
        flex-direction: column;
      }
    }
    `;
  }

  // Generate enhanced JavaScript for the EntityListPanel
  generateJavaScript() {
    return `
    (function() {
      const entityName = '${this.entityName}';
      const apiClient = window.apiClient;
      
      let currentData = [];
      let currentPage = 1;
      let currentLimit = 10;
      let currentSearch = '';
      let currentSortField = '';
      let currentSortOrder = 'asc';
      let selectedItems = new Set();
      let entitySchema = null;
      let isInitialized = false;

      // Initialize the panel
      async function initPanel() {
        if (isInitialized) return;
        
        try {
          await loadEntitySchema();
          await loadData();
          setupEventListeners();
          isInitialized = true;
          console.log(\`✅ EntityListPanel \${entityName} initialized\`);
        } catch (error) {
          console.error(\`❌ Failed to initialize EntityListPanel \${entityName}:\`, error);
          showError('Failed to initialize panel: ' + error.message);
        }
      }

      // Load entity schema for dynamic form generation
      async function loadEntitySchema() {
        try {
          // This would typically come from an API endpoint
          // For now, we'll use a predefined schema
          entitySchema = getEntitySchema(entityName);
        } catch (error) {
          console.log('⚠️ Failed to load entity schema:', error.message);
          entitySchema = getDefaultSchema();
        }
      }

      // Get entity schema based on entity name
      function getEntitySchema(entityName) {
        const schemas = {
          organization: {
            fields: [
              { name: 'name', label: 'Organization Name', type: 'text', required: true, help: 'Enter the organization name' },
              { name: 'slug', label: 'Slug', type: 'text', required: true, help: 'URL-friendly identifier' },
              { name: 'description', label: 'Description', type: 'textarea', required: false, help: 'Organization description' },
              { name: 'tier', label: 'Tier', type: 'select', required: true, options: ['basic', 'premium', 'enterprise'] },
              { name: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'inactive', 'pending'] }
            ],
            sections: [
              { title: 'Basic Information', fields: ['name', 'slug', 'description'] },
              { title: 'Configuration', fields: ['tier', 'status'] }
            ]
          },
          user: {
            fields: [
              { name: 'email', label: 'Email', type: 'email', required: true, help: 'User email address' },
              { name: 'firstName', label: 'First Name', type: 'text', required: true },
              { name: 'lastName', label: 'Last Name', type: 'text', required: true },
              { name: 'role', label: 'Role', type: 'select', required: true, options: ['USER', 'ADMIN', 'MANAGER'] },
              { name: 'isActive', label: 'Active', type: 'checkbox', required: false }
            ],
            sections: [
              { title: 'Personal Information', fields: ['email', 'firstName', 'lastName'] },
              { title: 'Account Settings', fields: ['role', 'isActive'] }
            ]
          },
          product: {
            fields: [
              { name: 'name', label: 'Product Name', type: 'text', required: true },
              { name: 'description', label: 'Description', type: 'textarea', required: false },
              { name: 'price', label: 'Price', type: 'number', required: true, min: 0, step: 0.01 },
              { name: 'sku', label: 'SKU', type: 'text', required: true, help: 'Stock Keeping Unit' },
              { name: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'inactive', 'draft'] }
            ],
            sections: [
              { title: 'Product Information', fields: ['name', 'description', 'sku'] },
              { title: 'Pricing & Status', fields: ['price', 'status'] }
            ]
          }
        };
        
        return schemas[entityName] || getDefaultSchema();
      }

      function getDefaultSchema() {
        return {
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'description', label: 'Description', type: 'textarea', required: false },
            { name: 'status', label: 'Status', type: 'select', required: true, options: ['active', 'inactive'] }
          ],
          sections: [
            { title: 'Basic Information', fields: ['name', 'description', 'status'] }
          ]
        };
      }

      // Load data from API
      async function loadData() {
        try {
          showLoading(true);
          
          const params = new URLSearchParams({
            page: currentPage,
            limit: currentLimit,
            ...(currentSearch && { search: currentSearch }),
            ...(currentSortField && { sortField: currentSortField, sortOrder: currentSortOrder })
          });

          const response = await apiClient.get(\`/api/\${entityName}?\${params}\`);
          
          if (response.success) {
            currentData = response.data;
            updateTable();
            updatePagination(response.total, response.page, response.limit);
            updateTableInfo(response.total, response.page, response.limit);
          } else {
            showError('Failed to load data: ' + (response.error || 'Unknown error'));
          }
        } catch (error) {
          console.error('Error loading data:', error);
          showError('Error loading data: ' + error.message);
        } finally {
          showLoading(false);
        }
      }

      // Update table info
      function updateTableInfo(total, page, limit) {
        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);
        const infoElement = document.getElementById(\`table-info-\${entityName}\`);
        if (infoElement) {
          infoElement.textContent = \`Showing \${start} to \${end} of \${total} \${entityName}s\`;
        }
      }

      // Update the table with current data
      function updateTable() {
        const tbody = document.getElementById(\`tbody-\${entityName}\`);
        if (!tbody) return;

        if (currentData.length === 0) {
          tbody.innerHTML = \`
            <tr>
              <td colspan="6" class="text-center">
                <div style="padding: 40px; color: #718096;">
                  <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 16px; display: block;"></i>
                  <div style="font-size: 1rem; font-weight: 500; margin-bottom: 8px;">No \${entityName}s found</div>
                  <div style="font-size: 0.875rem;">Try adjusting your search or filters</div>
                </div>
              </td>
            </tr>
          \`;
          return;
        }

        tbody.innerHTML = currentData.map(item => \`
          <tr data-id="\${item.id}" class="\${selectedItems.has(item.id) ? 'selected' : ''}">
            <td class="checkbox-column">
              <input type="checkbox" class="item-checkbox" value="\${item.id}" \${selectedItems.has(item.id) ? 'checked' : ''}>
            </td>
            <td>
              <span class="font-mono text-sm">\${item.id}</span>
            </td>
            <td>
              <div class="font-medium">\${item.name || item.title || 'N/A'}</div>
              \${item.description ? \`<div class="text-sm text-gray-500 truncate">\${item.description}</div>\` : ''}
            </td>
            <td>
              <span class="status-badge status-\${item.status || 'active'}">
                \${item.status || 'active'}
              </span>
            </td>
            <td>
              <div class="text-sm">\${formatDate(item.createdAt)}</div>
            </td>
            <td class="actions-column">
              <div class="flex gap-1">
                <button class="btn btn-sm btn-outline edit-item" data-id="\${item.id}" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline view-item" data-id="\${item.id}" title="View">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline delete-item" data-id="\${item.id}" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        \`).join('');

        // Re-attach event listeners
        attachRowEventListeners();
      }

      // Update pagination controls
      function updatePagination(total, page, limit) {
        const totalPages = Math.ceil(total / limit);
        
        // Update pagination info
        const infoElement = document.getElementById(\`pagination-info-\${entityName}\`);
        if (infoElement) {
          infoElement.textContent = \`Page \${page} of \${totalPages} (\${total} total)\`;
        }

        // Update page numbers
        const pageNumbersElement = document.getElementById(\`page-numbers-\${entityName}\`);
        if (pageNumbersElement) {
          const pageNumbers = [];
          const startPage = Math.max(1, page - 2);
          const endPage = Math.min(totalPages, page + 2);

          if (startPage > 1) {
            pageNumbers.push(\`<span class="page-number" data-page="1">1</span>\`);
            if (startPage > 2) {
              pageNumbers.push('<span class="page-number disabled">...</span>');
            }
          }

          for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === page ? 'active' : '';
            pageNumbers.push(\`<span class="page-number \${activeClass}" data-page="\${i}">\${i}</span>\`);
          }

          if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
              pageNumbers.push('<span class="page-number disabled">...</span>');
            }
            pageNumbers.push(\`<span class="page-number" data-page="\${totalPages}">\${totalPages}</span>\`);
          }

          pageNumbersElement.innerHTML = pageNumbers.join('');
        }

        // Update prev/next buttons
        const prevButton = document.getElementById(\`prev-page-\${entityName}\`);
        const nextButton = document.getElementById(\`next-page-\${entityName}\`);
        
        if (prevButton) prevButton.disabled = page === 1;
        if (nextButton) nextButton.disabled = page === totalPages;
      }

      // Setup event listeners
      function setupEventListeners() {
        // Search
        const searchInput = document.getElementById(\`search-\${entityName}\`);
        if (searchInput) {
          let searchTimeout;
          searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
              currentSearch = e.target.value;
              currentPage = 1;
              loadData();
            }, 300);
          });
        }

        // Clear search
        const clearSearchButton = document.getElementById(\`clear-search-\${entityName}\`);
        if (clearSearchButton) {
          clearSearchButton.addEventListener('click', () => {
            searchInput.value = '';
            currentSearch = '';
            currentPage = 1;
            loadData();
          });
        }

        // Sort controls
        const sortFieldSelect = document.getElementById(\`sort-field-\${entityName}\`);
        const sortOrderSelect = document.getElementById(\`sort-order-\${entityName}\`);
        const limitSelect = document.getElementById(\`limit-\${entityName}\`);

        if (sortFieldSelect) {
          sortFieldSelect.addEventListener('change', (e) => {
            currentSortField = e.target.value;
            currentPage = 1;
            loadData();
          });
        }

        if (sortOrderSelect) {
          sortOrderSelect.addEventListener('change', (e) => {
            currentSortOrder = e.target.value;
            currentPage = 1;
            loadData();
          });
        }

        if (limitSelect) {
          limitSelect.addEventListener('change', (e) => {
            currentLimit = parseInt(e.target.value);
            currentPage = 1;
            loadData();
          });
        }

        // Pagination
        const prevButton = document.getElementById(\`prev-page-\${entityName}\`);
        const nextButton = document.getElementById(\`next-page-\${entityName}\`);

        if (prevButton) {
          prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
              currentPage--;
              loadData();
            }
          });
        }

        if (nextButton) {
          nextButton.addEventListener('click', () => {
            currentPage++;
            loadData();
          });
        }

        // Create button
        const createButton = document.getElementById(\`create-\${entityName}\`);
        if (createButton) {
          createButton.addEventListener('click', () => {
            showCreateModal();
          });
        }

        // Refresh button
        const refreshButton = document.getElementById(\`refresh-\${entityName}\`);
        if (refreshButton) {
          refreshButton.addEventListener('click', () => {
            loadData();
          });
        }

        // Export button
        const exportButton = document.getElementById(\`export-\${entityName}\`);
        if (exportButton) {
          exportButton.addEventListener('click', () => {
            exportData();
          });
        }

        // Select all buttons
        const selectAllButton = document.getElementById(\`select-all-\${entityName}\`);
        const deselectAllButton = document.getElementById(\`deselect-all-\${entityName}\`);

        if (selectAllButton) {
          selectAllButton.addEventListener('click', () => {
            selectAllItems();
          });
        }

        if (deselectAllButton) {
          deselectAllButton.addEventListener('click', () => {
            deselectAllItems();
          });
        }

        // Modal controls
        setupModalEventListeners();
      }

      // Setup modal event listeners
      function setupModalEventListeners() {
        const modal = document.getElementById(\`modal-\${entityName}\`);
        const closeButton = document.getElementById(\`modal-close-\${entityName}\`);
        const cancelButton = document.getElementById(\`modal-cancel-\${entityName}\`);
        const saveButton = document.getElementById(\`modal-save-\${entityName}\`);

        if (closeButton) {
          closeButton.addEventListener('click', hideModal);
        }

        if (cancelButton) {
          cancelButton.addEventListener('click', hideModal);
        }

        if (saveButton) {
          saveButton.addEventListener('click', saveItem);
        }

        if (modal) {
          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              hideModal();
            }
          });
        }

        // Bulk modal
        const bulkModal = document.getElementById(\`bulk-modal-\${entityName}\`);
        const bulkCloseButton = document.getElementById(\`bulk-modal-close-\${entityName}\`);
        const bulkCancelButton = document.getElementById(\`bulk-modal-cancel-\${entityName}\`);
        const bulkSaveButton = document.getElementById(\`bulk-modal-save-\${entityName}\`);

        if (bulkCloseButton) {
          bulkCloseButton.addEventListener('click', hideBulkModal);
        }

        if (bulkCancelButton) {
          bulkCancelButton.addEventListener('click', hideBulkModal);
        }

        if (bulkSaveButton) {
          bulkSaveButton.addEventListener('click', saveBulkUpdate);
        }

        if (bulkModal) {
          bulkModal.addEventListener('click', (e) => {
            if (e.target === bulkModal) {
              hideBulkModal();
            }
          });
        }

        // Confirmation modal
        const confirmModal = document.getElementById(\`confirm-modal-\${entityName}\`);
        const confirmCloseButton = document.getElementById(\`confirm-modal-close-\${entityName}\`);
        const confirmCancelButton = document.getElementById(\`confirm-cancel-\${entityName}\`);
        const confirmProceedButton = document.getElementById(\`confirm-proceed-\${entityName}\`);

        if (confirmCloseButton) {
          confirmCloseButton.addEventListener('click', hideConfirmModal);
        }

        if (confirmCancelButton) {
          confirmCancelButton.addEventListener('click', hideConfirmModal);
        }

        if (confirmProceedButton) {
          confirmProceedButton.addEventListener('click', () => {
            if (window.pendingAction) {
              window.pendingAction();
              window.pendingAction = null;
            }
            hideConfirmModal();
          });
        }

        if (confirmModal) {
          confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
              hideConfirmModal();
            }
          });
        }
      }

      // Attach row event listeners
      function attachRowEventListeners() {
        // Checkbox selection
        const checkboxes = document.querySelectorAll(\`.item-checkbox\`);
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', handleCheckboxChange);
        });

        // Select all checkbox
        const selectAllCheckbox = document.getElementById(\`select-all-checkbox-\${entityName}\`);
        if (selectAllCheckbox) {
          selectAllCheckbox.addEventListener('change', handleSelectAll);
        }

        // Edit buttons
        const editButtons = document.querySelectorAll(\`.edit-item\`);
        editButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            showEditModal(id);
          });
        });

        // View buttons
        const viewButtons = document.querySelectorAll(\`.view-item\`);
        viewButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            viewItem(id);
          });
        });

        // Delete buttons
        const deleteButtons = document.querySelectorAll(\`.delete-item\`);
        deleteButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            deleteItem(id);
          });
        });

        // Row click for selection
        const rows = document.querySelectorAll(\`tbody tr[data-id]\`);
        rows.forEach(row => {
          row.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox' && !e.target.closest('button')) {
              const checkbox = row.querySelector('.item-checkbox');
              if (checkbox) {
                checkbox.checked = !checkbox.checked;
                handleCheckboxChange({ target: checkbox });
              }
            }
          });
        });
      }

      // Handle checkbox change
      function handleCheckboxChange(e) {
        const id = e.target.value;
        if (e.target.checked) {
          selectedItems.add(id);
        } else {
          selectedItems.delete(id);
        }
        updateBulkActions();
        updateRowSelection();
      }

      // Handle select all
      function handleSelectAll(e) {
        const checkboxes = document.querySelectorAll(\`.item-checkbox\`);
        checkboxes.forEach(checkbox => {
          checkbox.checked = e.target.checked;
          const id = checkbox.value;
          if (e.target.checked) {
            selectedItems.add(id);
          } else {
            selectedItems.delete(id);
          }
        });
        updateBulkActions();
        updateRowSelection();
      }

      // Select all items
      function selectAllItems() {
        const checkboxes = document.querySelectorAll(\`.item-checkbox\`);
        checkboxes.forEach(checkbox => {
          checkbox.checked = true;
          selectedItems.add(checkbox.value);
        });
        updateBulkActions();
        updateRowSelection();
      }

      // Deselect all items
      function deselectAllItems() {
        const checkboxes = document.querySelectorAll(\`.item-checkbox\`);
        checkboxes.forEach(checkbox => {
          checkbox.checked = false;
        });
        selectedItems.clear();
        updateBulkActions();
        updateRowSelection();
      }

      // Update row selection visual state
      function updateRowSelection() {
        const rows = document.querySelectorAll(\`tbody tr[data-id]\`);
        rows.forEach(row => {
          const id = row.dataset.id;
          if (selectedItems.has(id)) {
            row.classList.add('selected');
          } else {
            row.classList.remove('selected');
          }
        });
      }

      // Update bulk actions visibility
      function updateBulkActions() {
        const bulkActions = document.getElementById(\`bulk-actions-\${entityName}\`);
        const bulkCount = document.getElementById(\`bulk-count-\${entityName}\`);
        
        if (bulkActions && bulkCount) {
          if (selectedItems.size > 0) {
            bulkActions.style.display = 'flex';
            bulkCount.textContent = selectedItems.size;
          } else {
            bulkActions.style.display = 'none';
          }
        }
      }

      // Show create modal
      function showCreateModal() {
        const modal = document.getElementById(\`modal-\${entityName}\`);
        const title = document.getElementById(\`modal-title-\${entityName}\`);
        const formSections = document.getElementById(\`form-sections-\${entityName}\`);
        
        if (title) title.textContent = \`Create \${entityName.charAt(0).toUpperCase() + entityName.slice(1)}\`;
        if (formSections) {
          formSections.innerHTML = generateFormHTML();
        }
        
        if (modal) modal.style.display = 'block';
      }

      // Show edit modal
      function showEditModal(id) {
        const item = currentData.find(item => item.id === id);
        if (!item) return;

        const modal = document.getElementById(\`modal-\${entityName}\`);
        const title = document.getElementById(\`modal-title-\${entityName}\`);
        const formSections = document.getElementById(\`form-sections-\${entityName}\`);
        
        if (title) title.textContent = \`Edit \${entityName.charAt(0).toUpperCase() + entityName.slice(1)}\`;
        if (formSections) {
          formSections.innerHTML = generateFormHTML(item);
        }
        
        if (modal) modal.style.display = 'block';
      }

      // View item
      function viewItem(id) {
        const item = currentData.find(item => item.id === id);
        if (!item) return;

        // Show item details in a read-only modal
        const modal = document.getElementById(\`modal-\${entityName}\`);
        const title = document.getElementById(\`modal-title-\${entityName}\`);
        const formSections = document.getElementById(\`form-sections-\${entityName}\`);
        
        if (title) title.textContent = \`View \${entityName.charAt(0).toUpperCase() + entityName.slice(1)}\`;
        if (formSections) {
          formSections.innerHTML = generateFormHTML(item, true);
        }
        
        if (modal) modal.style.display = 'block';
      }

      // Generate form HTML
      function generateFormHTML(data = {}, readOnly = false) {
        if (!entitySchema) return '<div>Loading form...</div>';

        return entitySchema.sections.map(section => \`
          <div class="form-section">
            <div class="form-section-title">\${section.title}</div>
            \${section.fields.map(fieldName => {
              const field = entitySchema.fields.find(f => f.name === fieldName);
              if (!field) return '';
              
              return generateFieldHTML(field, data[field.name], readOnly);
            }).join('')}
          </div>
        \`).join('');
      }

      // Generate field HTML
      function generateFieldHTML(field, value = '', readOnly = false) {
        const fieldId = \`\${field.name}-\${entityName}\`;
        const required = field.required ? 'required' : '';
        const readonly = readOnly ? 'readonly' : '';
        
        let inputHTML = '';
        
        switch (field.type) {
          case 'textarea':
            inputHTML = \`<textarea id="\${fieldId}" name="\${field.name}" class="form-control" \${required} \${readonly}>\${value || ''}</textarea>\`;
            break;
          case 'select':
            const options = field.options.map(option => 
              \`<option value="\${option}" \${value === option ? 'selected' : ''}>\${option.charAt(0).toUpperCase() + option.slice(1)}</option>\`
            ).join('');
            inputHTML = \`<select id="\${fieldId}" name="\${field.name}" class="form-control" \${required} \${readonly}>\${options}</select>\`;
            break;
          case 'checkbox':
            const checked = value ? 'checked' : '';
            inputHTML = \`<input type="checkbox" id="\${fieldId}" name="\${field.name}" class="form-control" \${checked} \${readonly}>\`;
            break;
          case 'number':
            const min = field.min ? \`min="\${field.min}"\` : '';
            const step = field.step ? \`step="\${field.step}"\` : '';
            inputHTML = \`<input type="number" id="\${fieldId}" name="\${field.name}" class="form-control" value="\${value || ''}" \${required} \${readonly} \${min} \${step}>\`;
            break;
          case 'email':
            inputHTML = \`<input type="email" id="\${fieldId}" name="\${field.name}" class="form-control" value="\${value || ''}" \${required} \${readonly}>\`;
            break;
          default:
            inputHTML = \`<input type="text" id="\${fieldId}" name="\${field.name}" class="form-control" value="\${value || ''}" \${required} \${readonly}>\`;
        }
        
        return \`
          <div class="form-group">
            <label for="\${fieldId}">\${field.label}\${field.required ? ' *' : ''}</label>
            \${inputHTML}
            \${field.help ? \`<div class="form-help">\${field.help}</div>\` : ''}
          </div>
        \`;
      }

      // Hide modal
      function hideModal() {
        const modal = document.getElementById(\`modal-\${entityName}\`);
        if (modal) modal.style.display = 'none';
      }

      // Hide bulk modal
      function hideBulkModal() {
        const modal = document.getElementById(\`bulk-modal-\${entityName}\`);
        if (modal) modal.style.display = 'none';
      }

      // Hide confirmation modal
      function hideConfirmModal() {
        const modal = document.getElementById(\`confirm-modal-\${entityName}\`);
        if (modal) modal.style.display = 'none';
      }

      // Show confirmation modal
      function showConfirmModal(title, message, action) {
        const modal = document.getElementById(\`confirm-modal-\${entityName}\`);
        const titleElement = document.getElementById(\`confirm-title-\${entityName}\`);
        const messageElement = document.getElementById(\`confirm-message-\${entityName}\`);
        
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        
        window.pendingAction = action;
        
        if (modal) modal.style.display = 'block';
      }

      // Save item
      async function saveItem() {
        const form = document.getElementById(\`form-\${entityName}\`);
        if (!form) return;

        const formData = new FormData(form);
        const data = {};
        
        // Process form data
        for (const [key, value] of formData.entries()) {
          const field = entitySchema.fields.find(f => f.name === key);
          if (field && field.type === 'checkbox') {
            data[key] = formData.has(key);
          } else {
            data[key] = value;
          }
        }

        try {
          const isEdit = document.getElementById(\`modal-title-\${entityName}\`).textContent.includes('Edit');
          
          if (isEdit) {
            // Find the item being edited
            const editingItem = currentData.find(item => 
              Object.keys(data).some(key => item[key] === data[key])
            );
            
            if (editingItem) {
              await apiClient.put(\`/api/\${entityName}/\${editingItem.id}\`, data);
              showSuccess(\`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} updated successfully\`);
            }
          } else {
            await apiClient.post(\`/api/\${entityName}\`, data);
            showSuccess(\`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} created successfully\`);
          }
          
          hideModal();
          loadData();
        } catch (error) {
          showError('Error saving item: ' + error.message);
        }
      }

      // Delete item
      async function deleteItem(id) {
        const item = currentData.find(item => item.id === id);
        const itemName = item ? (item.name || item.title || 'item') : 'item';
        
        showConfirmModal(
          'Confirm Delete',
          \`Are you sure you want to delete "\${itemName}"? This action cannot be undone.\`,
          async () => {
            try {
              await apiClient.delete(\`/api/\${entityName}/\${id}\`);
              showSuccess(\`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} deleted successfully\`);
              loadData();
            } catch (error) {
              showError('Error deleting item: ' + error.message);
            }
          }
        );
      }

      // Export data
      function exportData() {
        try {
          const csvContent = generateCSV(currentData);
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = \`\${entityName}s-\${new Date().toISOString().split('T')[0]}.csv\`;
          a.click();
          window.URL.revokeObjectURL(url);
          showSuccess('Data exported successfully');
        } catch (error) {
          showError('Error exporting data: ' + error.message);
        }
      }

      // Generate CSV content
      function generateCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        data.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? \`"\${value}"\` : value;
          });
          csvRows.push(values.join(','));
        });
        
        return csvRows.join('\\n');
      }

      // Utility functions
      function showLoading(show) {
        const tbody = document.getElementById(\`tbody-\${entityName}\`);
        if (!tbody) return;

        if (show) {
          tbody.innerHTML = \`
            <tr class="loading-row">
              <td colspan="6" class="text-center">
                <div class="loading-spinner">
                  <i class="fas fa-spinner fa-spin"></i> Loading...
                </div>
              </td>
            </tr>
          \`;
        }
      }

      function showError(message) {
        showNotification(message, 'error');
      }

      function showSuccess(message) {
        showNotification(message, 'success');
      }

      function showNotification(message, type = 'success') {
        // Use global notification system if available
        if (window.showNotification) {
          window.showNotification(message, type);
        } else {
          alert(\`\${type === 'error' ? 'Error' : 'Success'}: \${message}\`);
        }
      }

      function formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
      }

      // Initialize when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPanel);
      } else {
        initPanel();
      }
    })();
    `;
  }

  // Generate complete enhanced EntityListPanel
  generateComplete() {
    return {
      html: this.generateHTML(),
      css: this.generateCSS(),
      javascript: this.generateJavaScript()
    };
  }
}

module.exports = EntityListPanelEnhanced;
