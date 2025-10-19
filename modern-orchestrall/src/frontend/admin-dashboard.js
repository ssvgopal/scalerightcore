// src/frontend/admin-dashboard.js - Professional Admin Dashboard
const path = require('path');
const fs = require('fs');

class AdminDashboard {
  constructor() {
    this.dashboardPath = path.join(__dirname, '../../public/admin');
    this.assetsPath = path.join(__dirname, '../../public/assets');
  }

  async initialize() {
    try {
      // Create directories
      await this.createDirectories();
      
      // Generate dashboard files
      await this.generateDashboardHTML();
      await this.generateDashboardCSS();
      await this.generateDashboardJS();
      
      console.log('Admin Dashboard initialized successfully');
      return true;
    } catch (error) {
      console.error('Admin Dashboard initialization failed:', error.message);
      return false;
    }
  }

  async createDirectories() {
    const dirs = [this.dashboardPath, this.assetsPath];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  async generateDashboardHTML() {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orchestrall Platform - Admin Dashboard</title>
    <link rel="stylesheet" href="/admin/dashboard.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body>
    <div id="app">
        <!-- Header -->
        <header class="header">
            <div class="header-left">
                <div class="logo">
                    <i class="fas fa-cogs"></i>
                    <span>Orchestrall Platform</span>
                </div>
            </div>
            <div class="header-right">
                <div class="user-info">
                    <span id="user-name">Admin User</span>
                    <button id="logout-btn" class="btn btn-outline">Logout</button>
                </div>
            </div>
        </header>

        <!-- Main Layout -->
        <div class="main-layout">
            <!-- Sidebar -->
            <aside class="sidebar">
                <nav class="nav">
                    <div class="nav-section">
                        <h3>Core Entities</h3>
                        <ul>
                            <li><a href="#" data-entity="organizations"><i class="fas fa-building"></i> Organizations</a></li>
                            <li><a href="#" data-entity="users"><i class="fas fa-users"></i> Users</a></li>
                            <li><a href="#" data-entity="teams"><i class="fas fa-user-friends"></i> Teams</a></li>
                        </ul>
                    </div>
                    <div class="nav-section">
                        <h3>Retail Entities</h3>
                        <ul>
                            <li><a href="#" data-entity="products"><i class="fas fa-box"></i> Products</a></li>
                            <li><a href="#" data-entity="orders"><i class="fas fa-shopping-cart"></i> Orders</a></li>
                            <li><a href="#" data-entity="customers"><i class="fas fa-user"></i> Customers</a></li>
                        </ul>
                    </div>
                    <div class="nav-section">
                        <h3>Client Features</h3>
                        <ul>
                            <li><a href="#" data-entity="stories"><i class="fas fa-book"></i> Stories</a></li>
                            <li><a href="#" data-entity="crops"><i class="fas fa-seedling"></i> Crops</a></li>
                            <li><a href="#" data-entity="stores"><i class="fas fa-store"></i> Stores</a></li>
                            <li><a href="#" data-entity="voiceCalls"><i class="fas fa-phone"></i> Voice Calls</a></li>
                        </ul>
                    </div>
                </nav>
            </aside>

            <!-- Main Content -->
            <main class="main-content">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <span id="breadcrumb-text">Dashboard</span>
                </nav>

                <!-- Entity List Panel -->
                <div class="entity-panel" id="entity-panel">
                    <div class="panel-header">
                        <h2 id="entity-title">Select an entity to manage</h2>
                        <div class="panel-actions">
                            <button id="refresh-btn" class="btn btn-outline">
                                <i class="fas fa-sync"></i> Refresh
                            </button>
                            <button id="create-btn" class="btn btn-primary" style="display: none;">
                                <i class="fas fa-plus"></i> Create New
                            </button>
                        </div>
                    </div>

                    <!-- Search and Filters -->
                    <div class="panel-filters" id="panel-filters" style="display: none;">
                        <div class="search-box">
                            <input type="text" id="search-input" placeholder="Search...">
                            <i class="fas fa-search"></i>
                        </div>
                        <div class="filter-controls">
                            <select id="sort-select">
                                <option value="createdAt">Sort by Created Date</option>
                                <option value="name">Sort by Name</option>
                                <option value="updatedAt">Sort by Updated Date</option>
                            </select>
                            <select id="order-select">
                                <option value="desc">Descending</option>
                                <option value="asc">Ascending</option>
                            </select>
                        </div>
                    </div>

                    <!-- Data Table -->
                    <div class="data-table-container" id="data-table-container">
                        <div class="welcome-message">
                            <i class="fas fa-database"></i>
                            <h3>Welcome to Orchestrall Platform Admin</h3>
                            <p>Select an entity from the sidebar to start managing your data</p>
                        </div>
                    </div>

                    <!-- Pagination -->
                    <div class="pagination" id="pagination" style="display: none;">
                        <button id="prev-page" class="btn btn-outline">Previous</button>
                        <span id="page-info">Page 1 of 1</span>
                        <button id="next-page" class="btn btn-outline">Next</button>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- Modal for Create/Edit -->
    <div class="modal" id="entity-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modal-title">Create New Entity</h3>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="modal-body">
                <!-- Dynamic form will be inserted here -->
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="modal-cancel">Cancel</button>
                <button class="btn btn-primary" id="modal-save">Save</button>
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loading-overlay">
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading...</span>
        </div>
    </div>

    <script src="/admin/dashboard.js"></script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.dashboardPath, 'index.html'), html);
  }

  async generateDashboardCSS() {
    const css = `/* Professional Admin Dashboard Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f8fafc;
    color: #334155;
    line-height: 1.6;
}

/* Header */
.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
}

.logo i {
    font-size: 2rem;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

/* Main Layout */
.main-layout {
    display: flex;
    min-height: calc(100vh - 80px);
}

/* Sidebar */
.sidebar {
    width: 280px;
    background: white;
    border-right: 1px solid #e2e8f0;
    padding: 2rem 0;
    overflow-y: auto;
}

.nav-section {
    margin-bottom: 2rem;
}

.nav-section h3 {
    padding: 0 2rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.nav-section ul {
    list-style: none;
}

.nav-section li {
    margin-bottom: 0.25rem;
}

.nav-section a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 2rem;
    color: #475569;
    text-decoration: none;
    transition: all 0.2s;
    border-left: 3px solid transparent;
}

.nav-section a:hover {
    background-color: #f1f5f9;
    color: #667eea;
    border-left-color: #667eea;
}

.nav-section a.active {
    background-color: #eef2ff;
    color: #667eea;
    border-left-color: #667eea;
    font-weight: 500;
}

.nav-section a i {
    width: 20px;
    text-align: center;
}

/* Main Content */
.main-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
}

.breadcrumb {
    margin-bottom: 2rem;
    padding: 1rem 0;
    border-bottom: 1px solid #e2e8f0;
}

.breadcrumb span {
    font-size: 1.125rem;
    font-weight: 500;
    color: #475569;
}

/* Entity Panel */
.entity-panel {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    overflow: hidden;
}

.panel-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.panel-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
}

.panel-actions {
    display: flex;
    gap: 0.75rem;
}

.panel-filters {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e2e8f0;
    background-color: #f8fafc;
    display: flex;
    gap: 1rem;
    align-items: center;
}

.search-box {
    position: relative;
    flex: 1;
    max-width: 400px;
}

.search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
}

.search-box input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-box i {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
}

.filter-controls {
    display: flex;
    gap: 0.75rem;
}

.filter-controls select {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    background: white;
}

/* Data Table */
.data-table-container {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th,
.data-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
}

.data-table th {
    background-color: #f8fafc;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
}

.data-table tbody tr:hover {
    background-color: #f8fafc;
}

.data-table tbody tr:last-child td {
    border-bottom: none;
}

/* Welcome Message */
.welcome-message {
    text-align: center;
    padding: 4rem 2rem;
    color: #64748b;
}

.welcome-message i {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: #cbd5e1;
}

.welcome-message h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #475569;
}

/* Pagination */
.pagination {
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f8fafc;
}

#page-info {
    font-size: 0.875rem;
    color: #64748b;
}

/* Buttons */
.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
}

.btn-primary {
    background-color: #667eea;
    color: white;
}

.btn-primary:hover {
    background-color: #5a67d8;
}

.btn-outline {
    background-color: transparent;
    color: #667eea;
    border: 1px solid #667eea;
}

.btn-outline:hover {
    background-color: #667eea;
    color: white;
}

.btn-danger {
    background-color: #ef4444;
    color: white;
}

.btn-danger:hover {
    background-color: #dc2626;
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    z-index: 1000;
}

.modal.show {
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-content {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
}

.modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
}

.modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #64748b;
}

.modal-body {
    padding: 2rem;
}

.modal-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

/* Form Elements */
.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea {
    resize: vertical;
    min-height: 100px;
}

/* Loading Overlay */
.loading-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255,255,255,0.9);
    z-index: 2000;
}

.loading-overlay.show {
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-spinner {
    text-align: center;
    color: #667eea;
}

.loading-spinner i {
    font-size: 2rem;
    margin-bottom: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
    .main-layout {
        flex-direction: column;
    }
    
    .sidebar {
        width: 100%;
        height: auto;
    }
    
    .panel-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
    }
    
    .panel-filters {
        flex-direction: column;
        align-items: stretch;
    }
    
    .filter-controls {
        flex-direction: column;
    }
}

/* Action Buttons */
.action-buttons {
    display: flex;
    gap: 0.5rem;
}

.action-buttons .btn {
    padding: 0.5rem;
    min-width: auto;
}

/* Status Badges */
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
}

.status-active {
    background-color: #dcfce7;
    color: #166534;
}

.status-inactive {
    background-color: #fef2f2;
    color: #991b1b;
}

.status-pending {
    background-color: #fef3c7;
    color: #92400e;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #64748b;
}

.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #cbd5e1;
}

.empty-state h3 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: #475569;
}

.empty-state p {
    margin-bottom: 1.5rem;
}

/* Success/Error Messages */
.message {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
}

.message-success {
    background-color: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
}

.message-error {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
}

.message-info {
    background-color: #dbeafe;
    color: #1e40af;
    border: 1px solid #bfdbfe;
}
`;

    fs.writeFileSync(path.join(this.dashboardPath, 'dashboard.css'), css);
  }

  async generateDashboardJS() {
    const js = `// Professional Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.currentEntity = null;
        this.currentPage = 1;
        this.pageSize = 20;
        this.searchTerm = '';
        this.sortBy = 'createdAt';
        this.sortOrder = 'desc';
        this.data = [];
        this.totalPages = 1;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUserInfo();
        this.showWelcomeMessage();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-section a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const entity = e.currentTarget.dataset.entity;
                this.loadEntity(entity);
            });
        });

        // Panel actions
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshData();
        });

        document.getElementById('create-btn').addEventListener('click', () => {
            this.showCreateModal();
        });

        // Search and filters
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.debounceSearch();
        });

        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.refreshData();
        });

        document.getElementById('order-select').addEventListener('change', (e) => {
            this.sortOrder = e.target.value;
            this.refreshData();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.refreshData();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.refreshData();
            }
        });

        // Modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('modal-save').addEventListener('click', () => {
            this.saveEntity();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Close modal on outside click
        document.getElementById('entity-modal').addEventListener('click', (e) => {
            if (e.target.id === 'entity-modal') {
                this.hideModal();
            }
        });
    }

    async loadEntity(entityName) {
        this.currentEntity = entityName;
        this.currentPage = 1;
        
        // Update UI
        this.updateNavigation(entityName);
        this.updateBreadcrumb(entityName);
        this.updateTitle(entityName);
        
        // Show filters and create button
        document.getElementById('panel-filters').style.display = 'flex';
        document.getElementById('create-btn').style.display = 'inline-flex';
        
        // Load data
        await this.refreshData();
    }

    updateNavigation(entityName) {
        document.querySelectorAll('.nav-section a').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.entity === entityName) {
                link.classList.add('active');
            }
        });
    }

    updateBreadcrumb(entityName) {
        const breadcrumb = document.getElementById('breadcrumb-text');
        breadcrumb.textContent = \`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} Management\`;
    }

    updateTitle(entityName) {
        const title = document.getElementById('entity-title');
        title.textContent = \`\${entityName.charAt(0).toUpperCase() + entityName.slice(1)} Management\`;
    }

    async refreshData() {
        if (!this.currentEntity) return;
        
        this.showLoading();
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
                search: this.searchTerm
            });
            
            const response = await fetch(\`/api/\${this.currentEntity}?\${params}\`, {
                headers: {
                    'Authorization': \`Bearer \${this.getAuthToken()}\`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            
            const result = await response.json();
            this.data = result.data || [];
            this.totalPages = result.pagination?.pages || 1;
            
            this.renderTable();
            this.updatePagination();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    renderTable() {
        const container = document.getElementById('data-table-container');
        
        if (this.data.length === 0) {
            container.innerHTML = \`
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <h3>No \${this.currentEntity} found</h3>
                    <p>No data available for the current filters.</p>
                    <button class="btn btn-primary" onclick="dashboard.showCreateModal()">
                        <i class="fas fa-plus"></i> Create First \${this.currentEntity.slice(0, -1)}
                    </button>
                </div>
            \`;
            return;
        }
        
        // Get entity schema for column headers
        const schema = this.getEntitySchema();
        const columns = schema.fields.filter(field => 
            !['id', 'createdAt', 'updatedAt', 'organizationId'].includes(field)
        );
        
        let tableHTML = \`
            <table class="data-table">
                <thead>
                    <tr>
                        \${columns.map(col => \`<th>\${this.formatColumnName(col)}</th>\`).join('')}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        \`;
        
        this.data.forEach(item => {
            tableHTML += \`
                <tr>
                    \${columns.map(col => \`<td>\${this.formatCellValue(item[col], col)}</td>\`).join('')}
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="dashboard.editEntity('\${item.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="dashboard.deleteEntity('\${item.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            \`;
        });
        
        tableHTML += \`
                </tbody>
            </table>
        \`;
        
        container.innerHTML = tableHTML;
    }

    formatColumnName(column) {
        return column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1');
    }

    formatCellValue(value, column) {
        if (value === null || value === undefined) return '-';
        
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        
        if (column === 'status') {
            return \`<span class="status-badge status-\${value}">\${value}</span>\`;
        }
        
        if (column.includes('Date') || column.includes('At')) {
            return new Date(value).toLocaleDateString();
        }
        
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        
        return String(value);
    }

    updatePagination() {
        const pagination = document.getElementById('pagination');
        const pageInfo = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (this.totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        pageInfo.textContent = \`Page \${this.currentPage} of \${this.totalPages}\`;
        
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= this.totalPages;
    }

    showCreateModal() {
        const modal = document.getElementById('entity-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = \`Create New \${this.currentEntity.slice(0, -1)}\`;
        modalBody.innerHTML = this.generateForm();
        
        modal.classList.add('show');
    }

    async editEntity(id) {
        const entity = this.data.find(item => item.id === id);
        if (!entity) return;
        
        const modal = document.getElementById('entity-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = \`Edit \${this.currentEntity.slice(0, -1)}\`;
        modalBody.innerHTML = this.generateForm(entity);
        
        modal.classList.add('show');
    }

    generateForm(entity = null) {
        const schema = this.getEntitySchema();
        const fields = schema.fields.filter(field => 
            !['id', 'createdAt', 'updatedAt', 'organizationId'].includes(field)
        );
        
        let formHTML = '';
        
        fields.forEach(field => {
            const value = entity ? entity[field] : '';
            const fieldType = this.getFieldType(field, value);
            
            formHTML += \`
                <div class="form-group">
                    <label for="\${field}">\${this.formatColumnName(field)}</label>
                    \${this.generateFieldInput(field, fieldType, value)}
                </div>
            \`;
        });
        
        return formHTML;
    }

    getFieldType(field, value) {
        if (field.includes('email')) return 'email';
        if (field.includes('password')) return 'password';
        if (field.includes('phone')) return 'tel';
        if (field.includes('url') || field.includes('Url')) return 'url';
        if (field === 'status') return 'select';
        if (field.includes('description') || field.includes('content')) return 'textarea';
        if (typeof value === 'boolean') return 'checkbox';
        if (typeof value === 'number') return 'number';
        return 'text';
    }

    generateFieldInput(field, type, value) {
        switch (type) {
            case 'select':
                return \`
                    <select id="\${field}" name="\${field}">
                        <option value="active" \${value === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" \${value === 'inactive' ? 'selected' : ''}>Inactive</option>
                        <option value="pending" \${value === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                \`;
            case 'textarea':
                return \`<textarea id="\${field}" name="\${field}" rows="4">\${value || ''}</textarea>\`;
            case 'checkbox':
                return \`<input type="checkbox" id="\${field}" name="\${field}" \${value ? 'checked' : ''}>\`;
            default:
                return \`<input type="\${type}" id="\${field}" name="\${field}" value="\${value || ''}">\`;
        }
    }

    async saveEntity() {
        const formData = new FormData();
        const schema = this.getEntitySchema();
        const fields = schema.fields.filter(field => 
            !['id', 'createdAt', 'updatedAt', 'organizationId'].includes(field)
        );
        
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                if (element.type === 'checkbox') {
                    formData.append(field, element.checked);
                } else {
                    formData.append(field, element.value);
                }
            }
        });
        
        const data = Object.fromEntries(formData);
        const isEdit = document.getElementById('modal-title').textContent.includes('Edit');
        const entityId = isEdit ? this.getEditingEntityId() : null;
        
        try {
            const url = isEdit ? \`/api/\${this.currentEntity}/\${entityId}\` : \`/api/\${this.currentEntity}\`;
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': \`Bearer \${this.getAuthToken()}\`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            
            this.hideModal();
            this.showSuccess(\`\${this.currentEntity.slice(0, -1)} \${isEdit ? 'updated' : 'created'} successfully\`);
            this.refreshData();
            
        } catch (error) {
            console.error('Error saving entity:', error);
            this.showError('Failed to save. Please try again.');
        }
    }

    async deleteEntity(id) {
        if (!confirm('Are you sure you want to delete this item?')) return;
        
        try {
            const response = await fetch(\`/api/\${this.currentEntity}/\${id}\`, {
                method: 'DELETE',
                headers: {
                    'Authorization': \`Bearer \${this.getAuthToken()}\`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            
            this.showSuccess(\`\${this.currentEntity.slice(0, -1)} deleted successfully\`);
            this.refreshData();
            
        } catch (error) {
            console.error('Error deleting entity:', error);
            this.showError('Failed to delete. Please try again.');
        }
    }

    getEntitySchema() {
        // Mock schema - in real implementation, this would be fetched from API
        const schemas = {
            organizations: { fields: ['name', 'slug', 'tier', 'status', 'metadata'] },
            users: { fields: ['email', 'name', 'status', 'lastLoginAt'] },
            teams: { fields: ['name', 'description', 'organizationId'] },
            products: { fields: ['name', 'description', 'price', 'sku', 'status'] },
            orders: { fields: ['orderNumber', 'status', 'totalAmount', 'customerId'] },
            customers: { fields: ['name', 'email', 'phone', 'address'] },
            stories: { fields: ['title', 'content', 'status', 'publishedAt'] },
            crops: { fields: ['name', 'variety', 'plantingDate', 'harvestDate', 'status'] },
            stores: { fields: ['name', 'address', 'city', 'state', 'pincode'] },
            voiceCalls: { fields: ['sessionId', 'language', 'duration', 'status'] }
        };
        
        return schemas[this.currentEntity] || { fields: [] };
    }

    getEditingEntityId() {
        // This would be set when opening edit modal
        return this.editingEntityId;
    }

    hideModal() {
        document.getElementById('entity-modal').classList.remove('show');
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('show');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message message-\${type}\`;
        messageDiv.textContent = message;
        
        const panel = document.getElementById('entity-panel');
        panel.insertBefore(messageDiv, panel.firstChild);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    showWelcomeMessage() {
        const container = document.getElementById('data-table-container');
        container.innerHTML = \`
            <div class="welcome-message">
                <i class="fas fa-database"></i>
                <h3>Welcome to Orchestrall Platform Admin</h3>
                <p>Select an entity from the sidebar to start managing your data</p>
            </div>
        \`;
    }

    loadUserInfo() {
        // Mock user info - in real implementation, this would be fetched from API
        document.getElementById('user-name').textContent = 'Admin User';
    }

    getAuthToken() {
        // Mock auth token - in real implementation, this would be from login
        return 'mock-token';
    }

    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.refreshData();
        }, 500);
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            // In real implementation, this would clear auth token and redirect
            window.location.href = '/login';
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard();
});`;

    fs.writeFileSync(path.join(this.dashboardPath, 'dashboard.js'), js);
  }
}

module.exports = AdminDashboard;
