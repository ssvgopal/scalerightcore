// src/frontend/EntityListPanel.js - Professional EntityListPanel Component
const React = require('react');
const { useState, useEffect, useCallback } = require('react');

class EntityListPanel {
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
      editingItem: null
    };
  }

  // Generate HTML for the EntityListPanel
  generateHTML() {
    return `
    <div class="entity-list-panel" data-entity="${this.entityName}">
      <div class="panel-header">
        <h2 class="panel-title">${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} Management</h2>
        <div class="panel-actions">
          <button class="btn btn-primary" id="create-${this.entityName}">
            <i class="fas fa-plus"></i> Create New
          </button>
          <button class="btn btn-secondary" id="refresh-${this.entityName}">
            <i class="fas fa-sync"></i> Refresh
          </button>
        </div>
      </div>

      <div class="panel-filters">
        <div class="search-box">
          <input type="text" id="search-${this.entityName}" placeholder="Search..." class="form-control">
          <i class="fas fa-search search-icon"></i>
        </div>
        <div class="filter-controls">
          <select id="sort-field-${this.entityName}" class="form-control">
            <option value="">Sort by...</option>
            <option value="name">Name</option>
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
          </select>
          <select id="sort-order-${this.entityName}" class="form-control">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div class="panel-content">
        <div class="data-table-container">
          <table class="data-table" id="table-${this.entityName}">
            <thead>
              <tr>
                <th class="checkbox-column">
                  <input type="checkbox" id="select-all-${this.entityName}">
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
          <button class="btn btn-secondary btn-sm" id="bulk-export-${this.entityName}">
            <i class="fas fa-download"></i> Export Selected
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div class="modal" id="modal-${this.entityName}">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modal-title-${this.entityName}">Create ${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)}</h3>
          <button class="modal-close" id="modal-close-${this.entityName}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="form-${this.entityName}">
            <div class="form-group">
              <label for="name-${this.entityName}">Name</label>
              <input type="text" id="name-${this.entityName}" name="name" class="form-control" required>
            </div>
            <div class="form-group">
              <label for="description-${this.entityName}">Description</label>
              <textarea id="description-${this.entityName}" name="description" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label for="status-${this.entityName}">Status</label>
              <select id="status-${this.entityName}" name="status" class="form-control">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-${this.entityName}">Cancel</button>
          <button class="btn btn-primary" id="modal-save-${this.entityName}">Save</button>
        </div>
      </div>
    </div>
    `;
  }

  // Generate CSS for the EntityListPanel
  generateCSS() {
    return `
    .entity-list-panel {
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .panel-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: #2c3e50;
    }

    .panel-actions {
      display: flex;
      gap: 10px;
    }

    .panel-filters {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .search-box {
      position: relative;
      width: 300px;
    }

    .search-box input {
      padding-right: 40px;
    }

    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #6c757d;
    }

    .filter-controls {
      display: flex;
      gap: 10px;
    }

    .data-table-container {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .data-table th,
    .data-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .data-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #495057;
    }

    .data-table tbody tr:hover {
      background: #f8f9fa;
    }

    .checkbox-column {
      width: 40px;
    }

    .actions-column {
      width: 120px;
    }

    .loading-spinner {
      padding: 20px;
      color: #6c757d;
    }

    .pagination-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .page-numbers {
      display: flex;
      gap: 5px;
    }

    .page-number {
      padding: 5px 10px;
      border: 1px solid #dee2e6;
      background: #ffffff;
      cursor: pointer;
      border-radius: 4px;
    }

    .page-number.active {
      background: #007bff;
      color: #ffffff;
      border-color: #007bff;
    }

    .bulk-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: #e3f2fd;
      border-top: 1px solid #bbdefb;
    }

    .bulk-buttons {
      display: flex;
      gap: 10px;
    }

    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
    }

    .modal-content {
      background-color: #ffffff;
      margin: 5% auto;
      padding: 0;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6c757d;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 20px;
      border-top: 1px solid #e0e0e0;
    }

    .form-group {
      margin-bottom: 15px;
    }

    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #495057;
    }

    .form-control {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
    }

    .form-control:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .btn-primary {
      background: #007bff;
      color: #ffffff;
    }

    .btn-primary:hover {
      background: #0056b3;
    }

    .btn-secondary {
      background: #6c757d;
      color: #ffffff;
    }

    .btn-secondary:hover {
      background: #545b62;
    }

    .btn-danger {
      background: #dc3545;
      color: #ffffff;
    }

    .btn-danger:hover {
      background: #c82333;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .text-center {
      text-align: center;
    }

    @media (max-width: 768px) {
      .panel-header {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
      }

      .panel-filters {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
      }

      .search-box {
        width: 100%;
      }

      .filter-controls {
        justify-content: space-between;
      }

      .pagination-container {
        flex-direction: column;
        gap: 15px;
      }

      .bulk-actions {
        flex-direction: column;
        gap: 15px;
      }
    }
    `;
  }

  // Generate JavaScript for the EntityListPanel
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

      // Initialize the panel
      function initPanel() {
        loadData();
        setupEventListeners();
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
          } else {
            showError('Failed to load data');
          }
        } catch (error) {
          showError('Error loading data: ' + error.message);
        } finally {
          showLoading(false);
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
                <div style="padding: 20px; color: #6c757d;">
                  <i class="fas fa-inbox"></i> No data found
                </div>
              </td>
            </tr>
          \`;
          return;
        }

        tbody.innerHTML = currentData.map(item => \`
          <tr data-id="\${item.id}">
            <td class="checkbox-column">
              <input type="checkbox" class="item-checkbox" value="\${item.id}">
            </td>
            <td>\${item.id}</td>
            <td>\${item.name || item.title || 'N/A'}</td>
            <td>
              <span class="status-badge status-\${item.status || 'active'}">
                \${item.status || 'active'}
              </span>
            </td>
            <td>\${formatDate(item.createdAt)}</td>
            <td class="actions-column">
              <button class="btn btn-sm btn-secondary edit-item" data-id="\${item.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger delete-item" data-id="\${item.id}">
                <i class="fas fa-trash"></i>
              </button>
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
          infoElement.textContent = \`Showing \${(page - 1) * limit + 1} to \${Math.min(page * limit, total)} of \${total} entries\`;
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
              pageNumbers.push('<span class="page-number">...</span>');
            }
          }

          for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === page ? 'active' : '';
            pageNumbers.push(\`<span class="page-number \${activeClass}" data-page="\${i}">\${i}</span>\`);
          }

          if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
              pageNumbers.push('<span class="page-number">...</span>');
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

        // Sort controls
        const sortFieldSelect = document.getElementById(\`sort-field-\${entityName}\`);
        const sortOrderSelect = document.getElementById(\`sort-order-\${entityName}\`);

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
      }

      // Attach row event listeners
      function attachRowEventListeners() {
        // Checkbox selection
        const checkboxes = document.querySelectorAll(\`.item-checkbox\`);
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', handleCheckboxChange);
        });

        // Select all checkbox
        const selectAllCheckbox = document.getElementById(\`select-all-\${entityName}\`);
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

        // Delete buttons
        const deleteButtons = document.querySelectorAll(\`.delete-item\`);
        deleteButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            deleteItem(id);
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
        const form = document.getElementById(\`form-\${entityName}\`);
        
        if (title) title.textContent = \`Create \${entityName.charAt(0).toUpperCase() + entityName.slice(1)}\`;
        if (form) form.reset();
        
        if (modal) modal.style.display = 'block';
      }

      // Show edit modal
      function showEditModal(id) {
        const item = currentData.find(item => item.id === id);
        if (!item) return;

        const modal = document.getElementById(\`modal-\${entityName}\`);
        const title = document.getElementById(\`modal-title-\${entityName}\`);
        const form = document.getElementById(\`form-\${entityName}\`);
        
        if (title) title.textContent = \`Edit \${entityName.charAt(0).toUpperCase() + entityName.slice(1)}\`;
        if (form) {
          form.reset();
          // Populate form with item data
          Object.keys(item).forEach(key => {
            const input = form.querySelector(\`[name="\${key}"]\`);
            if (input) {
              input.value = item[key] || '';
            }
          });
        }
        
        if (modal) modal.style.display = 'block';
      }

      // Hide modal
      function hideModal() {
        const modal = document.getElementById(\`modal-\${entityName}\`);
        if (modal) modal.style.display = 'none';
      }

      // Save item
      async function saveItem() {
        const form = document.getElementById(\`form-\${entityName}\`);
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
          const isEdit = document.getElementById(\`modal-title-\${entityName}\`).textContent.includes('Edit');
          
          if (isEdit) {
            const id = currentData.find(item => 
              Object.keys(data).every(key => item[key] === data[key])
            )?.id;
            
            if (id) {
              await apiClient.put(\`/api/\${entityName}/\${id}\`, data);
            }
          } else {
            await apiClient.post(\`/api/\${entityName}\`, data);
          }
          
          hideModal();
          loadData();
          showSuccess(\`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} saved successfully\`);
        } catch (error) {
          showError('Error saving item: ' + error.message);
        }
      }

      // Delete item
      async function deleteItem(id) {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
          await apiClient.delete(\`/api/\${entityName}/\${id}\`);
          loadData();
          showSuccess(\`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} deleted successfully\`);
        } catch (error) {
          showError('Error deleting item: ' + error.message);
        }
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
        // Simple error display - in production, use a proper notification system
        alert('Error: ' + message);
      }

      function showSuccess(message) {
        // Simple success display - in production, use a proper notification system
        alert('Success: ' + message);
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

  // Generate complete EntityListPanel
  generateComplete() {
    return {
      html: this.generateHTML(),
      css: this.generateCSS(),
      javascript: this.generateJavaScript()
    };
  }
}

module.exports = EntityListPanel;
