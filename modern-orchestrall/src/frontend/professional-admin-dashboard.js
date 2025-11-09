// src/frontend/professional-admin-dashboard.js - Professional Admin Dashboard with EntityListPanel
const EntityListPanel = require('./EntityListPanel');

const getProfessionalAdminDashboardHtml = (entities) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Orchestrall AI - Professional Admin Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        background-color: #f8fafc; 
      }
      
      .sidebar { 
        width: 280px; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #ffffff; 
        box-shadow: 2px 0 10px rgba(0,0,0,0.1);
      }
      
      .sidebar a { 
        padding: 15px 20px; 
        display: block; 
        color: rgba(255,255,255,0.9); 
        text-decoration: none; 
        transition: all 0.3s ease;
        border-left: 3px solid transparent;
      }
      
      .sidebar a:hover { 
        background-color: rgba(255,255,255,0.1); 
        border-left-color: #ffffff;
        color: #ffffff;
      }
      
      .sidebar a.active {
        background-color: rgba(255,255,255,0.15);
        border-left-color: #ffffff;
        color: #ffffff;
      }
      
      .header { 
        background-color: #ffffff; 
        border-bottom: 1px solid #e2e8f0; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      
      .card { 
        background-color: #ffffff; 
        border-radius: 12px; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
        border: 1px solid #e2e8f0;
      }
      
      .stats-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      
      .stats-card h3 {
        font-size: 14px;
        font-weight: 500;
        opacity: 0.9;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .stats-card .number {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      
      .stats-card .change {
        font-size: 12px;
        opacity: 0.8;
      }
      
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
      }
      
      .btn-secondary {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
      }
      
      .btn-secondary:hover {
        background: #e2e8f0;
      }
      
      .btn-danger {
        background: #ef4444;
        color: white;
      }
      
      .btn-danger:hover {
        background: #dc2626;
        transform: translateY(-1px);
      }
      
      .loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideInRight 0.3s ease;
      }
      
      .notification.success {
        background: #10b981;
      }
      
      .notification.error {
        background: #ef4444;
      }
      
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .entity-panel {
        display: none;
      }
      
      .entity-panel.active {
        display: block;
      }
      
      .dashboard-overview {
        display: block;
      }
      
      .dashboard-overview.hidden {
        display: none;
      }
    </style>
  </head>
  <body class="flex h-screen">
    <!-- Sidebar -->
    <aside class="sidebar flex flex-col h-full">
      <div class="p-6 text-center border-b border-white border-opacity-20">
        <div class="text-2xl font-bold mb-2">🚀 Orchestrall AI</div>
        <div class="text-sm opacity-80">Professional Platform</div>
      </div>
      
      <nav class="flex-grow mt-6">
        <div class="px-6 py-3 text-xs font-semibold text-white text-opacity-60 uppercase tracking-wider">
          Dashboard
        </div>
        <a href="#" class="nav-link active" data-section="overview">
          <i class="fas fa-tachometer-alt w-5"></i>
          <span>Overview</span>
        </a>
        
        <div class="px-6 py-3 text-xs font-semibold text-white text-opacity-60 uppercase tracking-wider mt-6">
          Data Management
        </div>
        ${entities.map(entity => `
          <a href="#" class="nav-link entity-nav-link" data-entity="${entity}">
            <i class="fas fa-database w-5"></i>
            <span>${entity.charAt(0).toUpperCase() + entity.slice(1)}</span>
          </a>
        `).join('')}
        
        <div class="px-6 py-3 text-xs font-semibold text-white text-opacity-60 uppercase tracking-wider mt-6">
          System
        </div>
        <a href="#" class="nav-link" data-section="settings">
          <i class="fas fa-cogs w-5"></i>
          <span>Settings</span>
        </a>
        <a href="#" class="nav-link" data-section="users">
          <i class="fas fa-users-cog w-5"></i>
          <span>User Management</span>
        </a>
        <a href="#" class="nav-link" data-section="logs">
          <i class="fas fa-file-alt w-5"></i>
          <span>System Logs</span>
        </a>
      </nav>
      
      <div class="p-6 text-center text-sm text-white text-opacity-60 border-t border-white border-opacity-20">
        <div class="mb-2">Version 2.0.0</div>
        <div>&copy; 2025 Orchestrall AI</div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-grow flex flex-col bg-gray-50">
      <!-- Header -->
      <header class="header p-6 flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-gray-800" id="page-title">Dashboard Overview</h1>
          <p class="text-gray-600 mt-1" id="page-subtitle">Welcome to your Orchestrall AI platform</p>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-right">
            <div class="text-sm text-gray-600">Welcome back,</div>
            <div class="font-semibold text-gray-800">Admin User</div>
          </div>
          <button class="btn btn-danger" id="logout-button">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      </header>

      <!-- Content Area -->
      <section class="flex-grow p-6 overflow-auto">
        <!-- Dashboard Overview -->
        <div id="dashboard-overview" class="dashboard-overview">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div class="stats-card">
              <h3>Total Organizations</h3>
              <div class="number" id="total-orgs">-</div>
              <div class="change">+12% from last month</div>
            </div>
            <div class="stats-card">
              <h3>Active Users</h3>
              <div class="number" id="total-users">-</div>
              <div class="change">+8% from last month</div>
            </div>
            <div class="stats-card">
              <h3>Total Products</h3>
              <div class="number" id="total-products">-</div>
              <div class="change">+15% from last month</div>
            </div>
            <div class="stats-card">
              <h3>System Health</h3>
              <div class="number" id="system-health">-</div>
              <div class="change">All systems operational</div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="card p-6">
              <h3 class="text-xl font-semibold mb-4">Recent Activity</h3>
              <div class="space-y-3" id="recent-activity">
                <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div class="flex-grow">
                    <div class="text-sm font-medium">System started successfully</div>
                    <div class="text-xs text-gray-500">2 minutes ago</div>
                  </div>
                </div>
                <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div class="flex-grow">
                    <div class="text-sm font-medium">Database connected</div>
                    <div class="text-xs text-gray-500">5 minutes ago</div>
                  </div>
                </div>
                <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div class="flex-grow">
                    <div class="text-sm font-medium">Admin dashboard loaded</div>
                    <div class="text-xs text-gray-500">Just now</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card p-6">
              <h3 class="text-xl font-semibold mb-4">Quick Actions</h3>
              <div class="space-y-3">
                <button class="btn btn-primary w-full justify-center" onclick="showEntityPanel('organization')">
                  <i class="fas fa-building"></i>
                  Manage Organizations
                </button>
                <button class="btn btn-primary w-full justify-center" onclick="showEntityPanel('user')">
                  <i class="fas fa-users"></i>
                  Manage Users
                </button>
                <button class="btn btn-primary w-full justify-center" onclick="showEntityPanel('product')">
                  <i class="fas fa-box"></i>
                  Manage Products
                </button>
                <button class="btn btn-secondary w-full justify-center" onclick="checkSystemHealth()">
                  <i class="fas fa-heartbeat"></i>
                  Check System Health
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Entity Panels -->
        ${entities.map(entity => `
          <div id="panel-${entity}" class="entity-panel">
            <div id="entity-list-${entity}"></div>
          </div>
        `).join('')}
      </section>
    </main>

    <!-- Notification Container -->
    <div id="notification-container"></div>

    <script>
      // Global API Client
      window.apiClient = {
        baseURL: window.location.origin,
        token: localStorage.getItem('authToken'),
        
        async request(method, url, data = null) {
          const options = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...(this.token && { 'Authorization': \`Bearer \${this.token}\` })
            }
          };
          
          if (data) {
            options.body = JSON.stringify(data);
          }
          
          const response = await fetch(\`\${this.baseURL}\${url}\`, options);
          
          if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
          }
          
          return response.json();
        },
        
        async get(url) {
          return this.request('GET', url);
        },
        
        async post(url, data) {
          return this.request('POST', url, data);
        },
        
        async put(url, data) {
          return this.request('PUT', url, data);
        },
        
        async delete(url) {
          return this.request('DELETE', url);
        }
      };

      // Global state
      let currentEntity = null;
      let entityPanels = {};

      // Initialize dashboard
      document.addEventListener('DOMContentLoaded', async () => {
        await initializeDashboard();
        setupEventListeners();
        loadDashboardData();
      });

      // Initialize dashboard
      async function initializeDashboard() {
        try {
          // Load entities for navigation
          const { data: entities } = await window.apiClient.get('/api/entities');
          
          // Initialize EntityListPanels for each entity
          entities.forEach(entity => {
            const entityListPanel = new EntityListPanel(entity, window.apiClient);
            const panelData = entityListPanel.generateComplete();
            
            // Inject CSS
            const style = document.createElement('style');
            style.textContent = panelData.css;
            document.head.appendChild(style);
            
            // Inject HTML
            const panelElement = document.getElementById(\`entity-list-\${entity}\`);
            if (panelElement) {
              panelElement.innerHTML = panelData.html;
            }
            
            // Store panel reference
            entityPanels[entity] = entityListPanel;
          });
          
          console.log('✅ Dashboard initialized successfully');
        } catch (error) {
          console.error('❌ Dashboard initialization failed:', error);
          showNotification('Failed to initialize dashboard', 'error');
        }
      }

      // Setup event listeners
      function setupEventListeners() {
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.currentTarget.dataset.section;
            const entity = e.currentTarget.dataset.entity;
            
            // Update active state
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            if (section === 'overview') {
              showDashboardOverview();
            } else if (entity) {
              showEntityPanel(entity);
            } else {
              showNotification(\`\${section} section coming soon\`, 'error');
            }
          });
        });

        // Logout button
        document.getElementById('logout-button').addEventListener('click', () => {
          localStorage.removeItem('authToken');
          window.location.href = '/';
        });
      }

      // Show dashboard overview
      function showDashboardOverview() {
        document.getElementById('page-title').textContent = 'Dashboard Overview';
        document.getElementById('page-subtitle').textContent = 'Welcome to your Orchestrall AI platform';
        
        document.getElementById('dashboard-overview').classList.remove('hidden');
        document.querySelectorAll('.entity-panel').forEach(panel => {
          panel.classList.remove('active');
        });
      }

      // Show entity panel
      function showEntityPanel(entity) {
        currentEntity = entity;
        
        document.getElementById('page-title').textContent = \`\${entity.charAt(0).toUpperCase() + entity.slice(1)} Management\`;
        document.getElementById('page-subtitle').textContent = \`Manage \${entity} data and operations\`;
        
        document.getElementById('dashboard-overview').classList.add('hidden');
        document.querySelectorAll('.entity-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        
        const panel = document.getElementById(\`panel-\${entity}\`);
        if (panel) {
          panel.classList.add('active');
        }
      }

      // Load dashboard data
      async function loadDashboardData() {
        try {
          // Load system stats
          const [orgsResponse, usersResponse, productsResponse, healthResponse] = await Promise.allSettled([
            window.apiClient.get('/api/organization?limit=1'),
            window.apiClient.get('/api/user?limit=1'),
            window.apiClient.get('/api/product?limit=1'),
            window.apiClient.get('/health')
          ]);

          // Update stats
          if (orgsResponse.status === 'fulfilled') {
            document.getElementById('total-orgs').textContent = orgsResponse.value.total || 0;
          }
          
          if (usersResponse.status === 'fulfilled') {
            document.getElementById('total-users').textContent = usersResponse.value.total || 0;
          }
          
          if (productsResponse.status === 'fulfilled') {
            document.getElementById('total-products').textContent = productsResponse.value.total || 0;
          }
          
          if (healthResponse.status === 'fulfilled') {
            document.getElementById('system-health').textContent = healthResponse.value.status === 'healthy' ? '100%' : 'Error';
          }
        } catch (error) {
          console.error('Failed to load dashboard data:', error);
        }
      }

      // Check system health
      async function checkSystemHealth() {
        try {
          const health = await window.apiClient.get('/health/full');
          showNotification(\`System Health: \${health.status}\`, health.status === 'healthy' ? 'success' : 'error');
        } catch (error) {
          showNotification('Failed to check system health', 'error');
        }
      }

      // Show notification
      function showNotification(message, type = 'success') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = \`notification \${type}\`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
      }

      // EntityListPanel class (simplified for this context)
      class EntityListPanel {
        constructor(entityName, apiClient) {
          this.entityName = entityName;
          this.apiClient = apiClient;
        }

        generateComplete() {
          return {
            html: \`<div class="entity-list-panel" data-entity="\${this.entityName}">
              <div class="panel-header">
                <h2 class="panel-title">\${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)} Management</h2>
                <div class="panel-actions">
                  <button class="btn btn-primary" onclick="create\${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)}()">
                    <i class="fas fa-plus"></i> Create New
                  </button>
                  <button class="btn btn-secondary" onclick="refresh\${this.entityName.charAt(0).toUpperCase() + this.entityName.slice(1)}()">
                    <i class="fas fa-sync"></i> Refresh
                  </button>
                </div>
              </div>
              <div class="panel-content">
                <div class="text-center p-8">
                  <div class="loading-spinner mx-auto mb-4"></div>
                  <p>Loading \${this.entityName} data...</p>
                </div>
              </div>
            </div>\`,
            css: '',
            javascript: ''
          };
        }
      }

      // Global functions for entity operations
      ${entities.map(entity => `
        function create${entity.charAt(0).toUpperCase() + entity.slice(1)}() {
          showNotification('Create ${entity} functionality coming soon', 'error');
        }
        
        function refresh${entity.charAt(0).toUpperCase() + entity.slice(1)}() {
          showNotification('Refresh ${entity} functionality coming soon', 'error');
        }
      `).join('')}
    </script>
  </body>
</html>
`;

module.exports = getProfessionalAdminDashboardHtml;
